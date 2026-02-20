/**
 * API service for ZkCircles backend
 * Falls back to localStorage when backend is unavailable
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
const LOCAL_STORAGE_KEY = 'zkcircles_local_data'

interface LocalStorageData {
  circles: CircleData[]
  memberships: { [circleId: string]: string[] }
  contributions: { circleId: string; memberAddress: string; cycle: number; amount: number }[]
  payouts: { circleId: string; memberAddress: string; cycle: number; amount: number }[]
}

// Local storage helpers
function getLocalData(): LocalStorageData {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY)
    const parsed = data ? JSON.parse(data) : {}
    return {
      circles: parsed.circles || [],
      memberships: parsed.memberships || {},
      contributions: parsed.contributions || [],
      payouts: parsed.payouts || [],
    }
  } catch {
    return { circles: [], memberships: {}, contributions: [], payouts: [] }
  }
}

function saveLocalData(data: LocalStorageData) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
}

export interface CircleData {
  id: string
  name?: string
  nameHash?: string
  creator: string
  contributionAmount: number
  maxMembers: number
  cycleDurationBlocks: number
  totalCycles: number
  status: number // 0: Forming, 1: Active, 2: Completed, 3: Cancelled
  currentCycle: number
  membersJoined: number
  startBlock?: number
  createdAt: string
  // User-specific data
  totalContributed?: number
  isYourTurn?: boolean
  needsContribution?: boolean
}

export interface MemberData {
  address: string
  joinOrder: number
  totalContributed: number
  hasReceivedPayout: boolean
  active: boolean
  contributedCycles?: number[]
}

export interface CircleStats {
  totalCircles: number
  activeMembers: number
  totalVolume: number
  completedCircles: number
}

interface FetchCirclesResponse {
  circles: CircleData[]
  stats: CircleStats
}

export interface CircleDetailResponse {
  circle: CircleData
  members: MemberData[]
}

/**
 * Fetch circles from the backend
 */
export async function fetchCircles(options: {
  status?: string
  limit?: number
} = {}): Promise<FetchCirclesResponse> {
  const params = new URLSearchParams()
  if (options.status) params.append('status', options.status)
  if (options.limit) params.append('limit', options.limit.toString())

  try {
    const response = await fetch(`${BACKEND_URL}/api/circles?${params}`)
    if (!response.ok) {
      throw new Error('Failed to fetch circles')
    }
    return await response.json()
  } catch (error) {
    console.error('API Error:', error)
    // Return local data + mock data for development
    const localData = getLocalData()
    const mockData = getMockCirclesData()
    const allCircles = [...localData.circles, ...mockData.circles]
    
    // Calculate stats from actual circles data
    const stats: CircleStats = {
      totalCircles: allCircles.length,
      activeMembers: allCircles.reduce((sum, c) => sum + (c.membersJoined || 0), 0),
      totalVolume: allCircles.reduce((sum, c) => sum + ((c.contributionAmount || 0) * (c.membersJoined || 0) * (c.currentCycle || 0)), 0),
      completedCircles: allCircles.filter(c => c.status === 2).length,
    }
    
    return {
      circles: allCircles,
      stats
    }
  }
}

/**
 * Fetch user's circles
 */
export async function fetchMyCircles(address: string): Promise<CircleData[]> {
  // Always try backend first for consistent data across browsers
  try {
    const response = await fetch(`${BACKEND_URL}/api/circles/member/${address}`)
    if (!response.ok) {
      throw new Error('Failed to fetch my circles')
    }
    const circles = await response.json()
    
    // Update local storage with backend data
    if (circles.length > 0) {
      const localData = getLocalData()
      for (const circle of circles) {
        const existingIndex = localData.circles.findIndex(c => c.id === circle.id)
        if (existingIndex >= 0) {
          localData.circles[existingIndex] = circle
        } else {
          localData.circles.push(circle)
        }
        // Mark user as member
        if (!localData.memberships[circle.id]) {
          localData.memberships[circle.id] = []
        }
        if (!localData.memberships[circle.id].includes(address)) {
          localData.memberships[circle.id].push(address)
        }
      }
      saveLocalData(localData)
    }
    
    return circles
  } catch (error) {
    console.error('API Error:', error)
    // Fallback to local storage only if backend fails
    const localData = getLocalData()
    return localData.circles.filter(c => {
      const isCreator = c.creator === address
      const isMember = localData.memberships[c.id] && localData.memberships[c.id].includes(address)
      return isCreator || isMember
    })
  }
}

/**
 * Get circle details
 */
export async function getCircleDetail(circleId: string): Promise<CircleDetailResponse> {
  // Always try backend first for consistent data across browsers
  try {
    const response = await fetch(`${BACKEND_URL}/api/circles/${circleId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch circle detail')
    }
    const data = await response.json()
    
    // Update local storage with backend data
    if (data.circle) {
      const localData = getLocalData()
      const existingIndex = localData.circles.findIndex(c => c.id === data.circle.id)
      if (existingIndex >= 0) {
        localData.circles[existingIndex] = data.circle
      } else {
        localData.circles.push(data.circle)
      }
      // Update memberships from backend members list
      if (data.members && data.members.length > 0) {
        localData.memberships[circleId] = data.members.map((m: MemberData) => m.address)
      }
      saveLocalData(localData)
    }
    
    return data
  } catch (error) {
    console.error('API Error:', error)
    // Fallback to localStorage only if backend fails
    const localData = getLocalData()
    const localCircle = localData.circles.find(c => c.id === circleId)
    const localMembers = localData.memberships[circleId] || []
    
    if (localCircle) {
      return {
        circle: localCircle,
        members: localMembers.map((address, index) => ({
          address,
          joinOrder: index + 1,
          totalContributed: 0,
          hasReceivedPayout: false,
          active: true,
        })),
      }
    }
    
    // Return mock data as last resort
    return getMockCircleDetail(circleId)
  }
}

/**
 * Save a new circle to the backend
 */
export async function saveCircleToBackend(data: {
  circleId: string
  name: string
  nameHash: string
  creator: string
  contributionAmount: number
  maxMembers: number
  cycleDurationBlocks: number
  salt: string
  transactionId: string
  status: number
}): Promise<void> {
  // Always save to local storage as backup
  const localData = getLocalData()
  
  const newCircle: CircleData = {
    id: data.circleId,
    name: data.name,
    nameHash: data.nameHash,
    creator: data.creator,
    contributionAmount: data.contributionAmount,
    maxMembers: data.maxMembers,
    cycleDurationBlocks: data.cycleDurationBlocks,
    totalCycles: data.maxMembers,
    status: data.status,
    currentCycle: 0,
    membersJoined: 1,
    createdAt: new Date().toISOString(),
  }
  
  // Check if circle already exists
  const existingIndex = localData.circles.findIndex(c => c.id === data.circleId)
  if (existingIndex >= 0) {
    localData.circles[existingIndex] = newCircle
  } else {
    localData.circles.push(newCircle)
  }
  
  // Add creator as member
  if (!localData.memberships[data.circleId]) {
    localData.memberships[data.circleId] = []
  }
  if (!localData.memberships[data.circleId].includes(data.creator)) {
    localData.memberships[data.circleId].push(data.creator)
  }
  
  saveLocalData(localData)
  
  // Also try to save to backend
  try {
    const response = await fetch(`${BACKEND_URL}/api/circles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to save circle')
    }
  } catch (error) {
    console.warn('Backend save failed, using local storage:', error)
  }
}

/**
 * Update circle membership
 */
export async function updateCircleMembershipBackend(data: {
  circleId: string
  memberAddress: string
  transactionId: string
  salt: string
}): Promise<void> {
  // Always save to local storage as backup
  const localData = getLocalData()
  
  // Add to memberships
  if (!localData.memberships[data.circleId]) {
    localData.memberships[data.circleId] = []
  }
  if (!localData.memberships[data.circleId].includes(data.memberAddress)) {
    localData.memberships[data.circleId].push(data.memberAddress)
  }
  
  // Update circle members count
  const circleIndex = localData.circles.findIndex(c => c.id === data.circleId)
  if (circleIndex >= 0) {
    localData.circles[circleIndex].membersJoined = localData.memberships[data.circleId].length
  }
  
  saveLocalData(localData)
  
  // Also try to save to backend
  try {
    const response = await fetch(`${BACKEND_URL}/api/circles/${data.circleId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to update membership')
    }
  } catch (error) {
    console.warn('Backend membership update failed, using local storage:', error)
  }
}

/**
 * Record a contribution
 */
export async function recordContributionBackend(data: {
  circleId: string
  memberAddress: string
  cycle: number
  amount: number
  transactionId: string
}): Promise<void> {
  // Save to localStorage first
  const localData = getLocalData()
  const exists = localData.contributions.some(
    c => c.circleId === data.circleId && c.memberAddress === data.memberAddress && c.cycle === data.cycle
  )
  if (!exists) {
    localData.contributions.push({
      circleId: data.circleId,
      memberAddress: data.memberAddress,
      cycle: data.cycle,
      amount: data.amount,
    })
    saveLocalData(localData)
  }

  // Also try backend
  try {
    const response = await fetch(`${BACKEND_URL}/api/contributions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to record contribution')
    }
  } catch (error) {
    console.warn('Backend contribution record failed:', error)
  }
}

/**
 * Record a payout
 */
export async function recordPayoutBackend(data: {
  circleId: string
  memberAddress: string
  cycle: number
  amount: number
  transactionId: string
}): Promise<void> {
  // Save to localStorage first
  const localData = getLocalData()
  const exists = localData.payouts.some(
    p => p.circleId === data.circleId && p.cycle === data.cycle
  )
  if (!exists) {
    localData.payouts.push({
      circleId: data.circleId,
      memberAddress: data.memberAddress,
      cycle: data.cycle,
      amount: data.amount,
    })
    saveLocalData(localData)
  }

  // Also try backend
  try {
    const response = await fetch(`${BACKEND_URL}/api/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to record payout')
    }
  } catch (error) {
    console.warn('Backend payout record failed:', error)
  }
}

/**
 * Dissolve/delete a circle (only creator, only forming circles)
 */
export async function dissolveCircle(circleId: string, creatorAddress: string): Promise<{ success: boolean; error?: string }> {
  // Remove from local storage
  const localData = getLocalData()
  const index = localData.circles.findIndex(c => c.id === circleId)
  if (index >= 0) {
    localData.circles.splice(index, 1)
  }
  delete localData.memberships[circleId]
  saveLocalData(localData)

  // Delete from backend
  try {
    const response = await fetch(`${BACKEND_URL}/api/circles/${circleId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ creatorAddress }),
    })
    
    if (!response.ok) {
      const data = await response.json()
      return { success: false, error: data.error || 'Failed to dissolve circle' }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Failed to dissolve circle:', error)
    return { success: false, error: 'Network error' }
  }
}

/**
 * Check transaction status on Aleo explorer
 */
export async function checkTransactionStatus(txId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.explorer.aleo.org/v1/testnet/transaction/${txId}`
    )
    if (response.ok) {
      const data = await response.json()
      if (data.execution) {
        return 'Completed'
      } else if (data.status === 'rejected') {
        return 'Failed'
      }
    }
    return 'Pending'
  } catch {
    return 'Pending'
  }
}

// Mock data for development when backend is not available
function getMockCirclesData(): FetchCirclesResponse {
  return {
    circles: [
      {
        id: '123456789012345678901234567890123456789012345678901234567890field',
        name: 'Neighborhood Fund',
        creator: 'aleo1abc...xyz',
        contributionAmount: 10_000_000, // 10 ALEO
        maxMembers: 6,
        cycleDurationBlocks: 168000, // 7 days
        totalCycles: 6,
        status: 0,
        currentCycle: 0,
        membersJoined: 3,
        createdAt: new Date().toISOString(),
      },
      {
        id: '234567890123456789012345678901234567890123456789012345678901field',
        name: 'Family Savings',
        creator: 'aleo1def...uvw',
        contributionAmount: 5_000_000, // 5 ALEO
        maxMembers: 4,
        cycleDurationBlocks: 24000, // 1 day
        totalCycles: 4,
        status: 1,
        currentCycle: 2,
        membersJoined: 4,
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: '345678901234567890123456789012345678901234567890123456789012field',
        name: 'Community Investment',
        creator: 'aleo1ghi...rst',
        contributionAmount: 25_000_000, // 25 ALEO
        maxMembers: 8,
        cycleDurationBlocks: 672000, // 28 days
        totalCycles: 8,
        status: 1,
        currentCycle: 5,
        membersJoined: 8,
        createdAt: new Date(Date.now() - 86400000 * 90).toISOString(),
      },
    ],
    stats: {
      totalCircles: 156,
      activeMembers: 843,
      totalVolume: 125_000_000_000, // 125,000 ALEO
      completedCircles: 89,
    },
  }
}

function getMockCircleDetail(circleId: string): CircleDetailResponse {
  return {
    circle: {
      id: circleId,
      name: 'Sample Circle',
      creator: 'aleo1abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ab',
      contributionAmount: 10_000_000,
      maxMembers: 6,
      cycleDurationBlocks: 168000,
      totalCycles: 6,
      status: 1,
      currentCycle: 3,
      membersJoined: 6,
      startBlock: 100000,
      createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    },
    members: [
      {
        address: 'aleo1abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ab',
        joinOrder: 1,
        totalContributed: 30_000_000,
        hasReceivedPayout: true,
        active: true,
      },
      {
        address: 'aleo1def456ghi789jkl012mno345pqr678stu901vwx234yz567abc123de',
        joinOrder: 2,
        totalContributed: 30_000_000,
        hasReceivedPayout: true,
        active: true,
      },
      {
        address: 'aleo1ghi789jkl012mno345pqr678stu901vwx234yz567abc123def456gh',
        joinOrder: 3,
        totalContributed: 30_000_000,
        hasReceivedPayout: false,
        active: true,
      },
      {
        address: 'aleo1jkl012mno345pqr678stu901vwx234yz567abc123def456ghi789jk',
        joinOrder: 4,
        totalContributed: 20_000_000,
        hasReceivedPayout: false,
        active: true,
      },
      {
        address: 'aleo1mno345pqr678stu901vwx234yz567abc123def456ghi789jkl012mn',
        joinOrder: 5,
        totalContributed: 20_000_000,
        hasReceivedPayout: false,
        active: true,
      },
      {
        address: 'aleo1pqr678stu901vwx234yz567abc123def456ghi789jkl012mno345pq',
        joinOrder: 6,
        totalContributed: 20_000_000,
        hasReceivedPayout: false,
        active: true,
      },
    ],
  }
}
