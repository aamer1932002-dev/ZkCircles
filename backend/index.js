/**
 * ZkCircles Backend API
 * Provides off-chain indexing and encrypted storage for circle data
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')

// Validate encryption key early
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
if (ENCRYPTION_KEY && ENCRYPTION_KEY.length !== 64) {
  console.error('❌ ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  console.error(`   Current length: ${ENCRYPTION_KEY.length}`)
}

const { encrypt, decrypt } = require('./encryption')

const app = express()
const PORT = process.env.PORT || 3001

// Check if Supabase is configured
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY
const USE_MOCK = !SUPABASE_URL || !SUPABASE_KEY

let supabase = null
if (!USE_MOCK) {
  const { createClient } = require('@supabase/supabase-js')
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  console.log('✅ Supabase client created — testing connection...')
  // Test the connection at startup
  supabase.from('circles').select('count', { count: 'exact', head: true })
    .then(({ count, error }) => {
      if (error) {
        console.error('❌ Supabase connection test FAILED:', error.message)
        console.error('   Code:', error.code, '| Details:', error.details)
        console.error('   Hint:', error.hint)
        console.warn('⚠️  Falling back to MOCK MODE due to DB error')
      } else {
        console.log(`✅ Supabase connected — circles table has ${count ?? 0} row(s)`)
      }
    })
    .catch(err => {
      console.error('❌ Supabase connection error:', err.message)
    })
} else {
  console.log('⚠️  Running in MOCK MODE - Supabase not configured')
  console.log('   Set SUPABASE_URL and SUPABASE_ANON_KEY in Render environment variables')
}

// In-memory mock data store
const mockData = {
  circles: [
    {
      circle_id: 'mock_circle_1',
      name: 'Community Savings Pool',
      creator: 'aleo1mock...abc',
      contribution_amount: 10000000,
      max_members: 6,
      cycle_duration_blocks: 168000,
      total_cycles: 6,
      status: 0,
      current_cycle: 0,
      members_joined: 2,
      created_at: new Date().toISOString(),
    },
    {
      circle_id: 'mock_circle_2',
      name: 'Weekly Tanda',
      creator: 'aleo1mock...def',
      contribution_amount: 5000000,
      max_members: 4,
      cycle_duration_blocks: 168000,
      total_cycles: 4,
      status: 1,
      current_cycle: 2,
      members_joined: 4,
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
  ],
  members: [],
  contributions: [],
  payouts: [],
}

// Middleware
app.use(cors())
app.use(express.json())

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'ZkCircles API',
    version: '1.0.0',
    status: 'running',
    program: 'zk_circles_v14.aleo',
    network: 'testnet',
    mode: USE_MOCK ? 'mock' : 'production',
    endpoints: [
      'GET  /health',
      'GET  /api/circles',
      'GET  /api/circles/:circleId',
      'GET  /api/circles/member/:address',
      'POST /api/circles',
      'POST /api/circles/batch',
      'POST /api/circles/:circleId/members',
      'POST /api/contributions',
      'POST /api/payouts',
      'POST /api/invites',
      'GET  /api/invites/:code',
      'GET  /api/disputes/:circleId',
      'POST /api/disputes',
      'POST /api/disputes/:disputeId/vote',
      'POST /api/disputes/:disputeId/resolve',
      'GET  /api/schedules/:address',
      'POST /api/schedules',
      'DELETE /api/schedules/:circleId/:address',
      'POST /api/email/register',
      'POST /api/email/send-code',
      'POST /api/email/verify',
      'GET  /api/email/status/:address',
    ]
  })
})

// Health check — performs a real DB ping
app.get('/health', async (req, res) => {
  const base = {
    status: 'ok',
    service: 'zk-circles-backend',
    mode: USE_MOCK ? 'mock' : 'production',
    encryptionKey: !!process.env.ENCRYPTION_KEY,
  }

  if (!supabase) {
    return res.json({ ...base, supabase: false, db: 'not configured' })
  }

  try {
    const { count, error } = await supabase
      .from('circles')
      .select('count', { count: 'exact', head: true })

    if (error) {
      console.error('[health] Supabase ping error:', error.message)
      return res.status(500).json({
        ...base,
        supabase: false,
        db: 'error',
        error: error.message,
        code: error.code,
        hint: error.hint,
      })
    }

    return res.json({ ...base, supabase: true, db: 'connected', circleCount: count ?? 0 })
  } catch (err) {
    console.error('[health] Unexpected error:', err.message)
    return res.status(500).json({ ...base, supabase: false, db: 'error', error: err.message })
  }
})

// ==================== CIRCLES ENDPOINTS ====================

/**
 * GET /api/circles
 * Fetch all circles with optional filtering
 */
app.get('/api/circles', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query

    // Mock mode
    if (USE_MOCK) {
      let circles = [...mockData.circles]
      if (status && status !== 'all') {
        const statusMap = { forming: 0, active: 1, completed: 2, cancelled: 3 }
        circles = circles.filter(c => c.status === statusMap[status])
      }
      return res.json({
        circles: circles.slice(0, parseInt(limit)).map(c => ({
          id: c.circle_id,
          name: c.name,
          creator: c.creator,
          contributionAmount: c.contribution_amount,
          maxMembers: c.max_members,
          cycleDurationBlocks: c.cycle_duration_blocks,
          totalCycles: c.total_cycles,
          status: c.status,
          currentCycle: c.current_cycle,
          membersJoined: c.members_joined,
          createdAt: c.created_at,
          tokenId: c.token_id || '0field',
        })),
        stats: {
          totalCircles: mockData.circles.length,
          activeMembers: 12,
          totalVolume: 150000000,
          completedCircles: 5,
        },
      })
    }
    
    let query = supabase
      .from('circles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    if (status && status !== 'all') {
      const statusMap = { forming: 0, active: 1, completed: 2, cancelled: 3 }
      query = query.eq('status', statusMap[status] ?? 0)
    }

    const { data: circles, error } = await query

    if (error) throw error

    // Get actual member counts from members table
    const { data: memberCounts } = await supabase
      .from('members')
      .select('circle_id')
    
    // Count members per circle
    const memberCountMap = {}
    if (memberCounts) {
      for (const m of memberCounts) {
        memberCountMap[m.circle_id] = (memberCountMap[m.circle_id] || 0) + 1
      }
    }

    // Get stats - compute from actual member counts
    const totalActiveMembers = Object.values(memberCountMap).reduce((sum, count) => sum + count, 0)
    
    const computedStats = {
      totalCircles: circles.length,
      activeMembers: totalActiveMembers,
      totalVolume: circles.reduce((sum, c) => sum + ((c.contribution_amount || 0) * (memberCountMap[c.circle_id] || c.members_joined || 0) * Math.max(c.current_cycle || 0, 1)), 0),
      completedCircles: circles.filter(c => c.status === 2).length,
    }

    // Decrypt sensitive fields and use actual member counts
    const decryptedCircles = circles.map(circle => ({
      id: circle.circle_id,
      name: circle.name ? decrypt(circle.name) : null,
      creator: decrypt(circle.creator),
      contributionAmount: circle.contribution_amount,
      maxMembers: circle.max_members,
      cycleDurationBlocks: circle.cycle_duration_blocks,
      totalCycles: circle.total_cycles,
      status: circle.status,
      currentCycle: circle.current_cycle,
      membersJoined: memberCountMap[circle.circle_id] || circle.members_joined || 0,
      startBlock: circle.start_block,
      createdAt: circle.created_at,
      tokenId: circle.token_id || '0field',
    }))

    res.json({
      circles: decryptedCircles,
      stats: computedStats,
    })
  } catch (error) {
    console.error('Error fetching circles:', error)
    res.status(500).json({ error: 'Failed to fetch circles', details: error.message })
  }
})

/**
 * GET /api/circles/:circleId
 * Get circle details with members
 */
app.get('/api/circles/:circleId', async (req, res) => {
  try {
    const { circleId } = req.params

    // Mock mode
    if (USE_MOCK) {
      const circle = mockData.circles.find(c => c.circle_id === circleId)
      if (!circle) {
        return res.status(404).json({ error: 'Circle not found' })
      }
      return res.json({
        circle: {
          id: circle.circle_id,
          name: circle.name,
          creator: circle.creator,
          contributionAmount: circle.contribution_amount,
          maxMembers: circle.max_members,
          cycleDurationBlocks: circle.cycle_duration_blocks,
          totalCycles: circle.total_cycles,
          status: circle.status,
          currentCycle: circle.current_cycle,
          membersJoined: circle.members_joined,
          createdAt: circle.created_at,
          tokenId: circle.token_id || '0field',
        },
        members: [
          { address: 'aleo1mock...abc', joinOrder: 1, totalContributed: 10000000, hasReceivedPayout: false, active: true },
          { address: 'aleo1mock...def', joinOrder: 2, totalContributed: 10000000, hasReceivedPayout: false, active: true },
        ],
      })
    }

    // Get circle
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('*')
      .eq('circle_id', circleId)
      .single()

    if (circleError || !circle) {
      return res.status(404).json({ error: 'Circle not found' })
    }

    // Get members
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('*')
      .eq('circle_id', circleId)
      .order('join_order', { ascending: true })

    if (membersError) throw membersError

    // Sync members_joined count if it's out of sync
    const actualMemberCount = members.length
    if (circle.members_joined !== actualMemberCount) {
      console.log(`Syncing members_joined for circle ${circleId}: ${circle.members_joined} -> ${actualMemberCount}`)
      await supabase
        .from('circles')
        .update({ members_joined: actualMemberCount })
        .eq('circle_id', circleId)
    }

    // Auto-activate circle if full but still showing as "Forming"
    let circleStatus = circle.status
    if (circle.status === 0 && actualMemberCount >= circle.max_members) {
      console.log(`Auto-activating circle ${circleId}: members ${actualMemberCount}/${circle.max_members}`)
      circleStatus = 1 // Active
      await supabase
        .from('circles')
        .update({ 
          status: 1, 
          current_cycle: 1,
          start_block: Date.now()
        })
        .eq('circle_id', circleId)
    }

    // Get contributions for current cycle
    const { data: contributions } = await supabase
      .from('contributions')
      .select('member_address, cycle')
      .eq('circle_id', circleId)

    // Decrypt and format data
    const decryptedCircle = {
      id: circle.circle_id,
      name: circle.name ? decrypt(circle.name) : null,
      creator: decrypt(circle.creator),
      contributionAmount: circle.contribution_amount,
      maxMembers: circle.max_members,
      cycleDurationBlocks: circle.cycle_duration_blocks,
      totalCycles: circle.total_cycles,
      status: circleStatus, // Use potentially updated status
      currentCycle: circleStatus === 1 ? Math.max(circle.current_cycle, 1) : circle.current_cycle,
      membersJoined: actualMemberCount, // Use actual count from members table
      startBlock: circle.start_block,
      createdAt: circle.created_at,
      tokenId: circle.token_id || '0field',
    }

    const decryptedMembers = members.map(member => {
      const memberContributions = contributions
        ?.filter(c => decrypt(c.member_address) === decrypt(member.member_address))
        .map(c => c.cycle) || []

      return {
        address: decrypt(member.member_address),
        joinOrder: member.join_order,
        totalContributed: member.total_contributed,
        hasReceivedPayout: member.has_received_payout,
        active: member.active,
        contributedCycles: memberContributions,
      }
    })

    res.json({
      circle: decryptedCircle,
      members: decryptedMembers,
    })
  } catch (error) {
    console.error('Error fetching circle detail:', error)
    res.status(500).json({ error: 'Failed to fetch circle', details: error.message })
  }
})

/**
 * GET /api/circles/member/:address
 * Get circles for a specific member
 */
app.get('/api/circles/member/:address', async (req, res) => {
  try {
    const { address } = req.params

    // Mock mode
    if (USE_MOCK) {
      return res.json(mockData.circles.map(c => ({
        id: c.circle_id,
        name: c.name,
        creator: c.creator,
        contributionAmount: c.contribution_amount,
        maxMembers: c.max_members,
        cycleDurationBlocks: c.cycle_duration_blocks,
        totalCycles: c.total_cycles,
        status: c.status,
        currentCycle: c.current_cycle,
        membersJoined: c.members_joined,
        createdAt: c.created_at,
        totalContributed: 10000000,
        isYourTurn: c.current_cycle === 1,
        needsContribution: true,
        tokenId: c.token_id || '0field',
      })))
    }

    // Get ALL circles first, then filter by decrypted creator
    const { data: allCircles, error: allCirclesError } = await supabase
      .from('circles')
      .select('*')
      .order('created_at', { ascending: false })

    if (allCirclesError) throw allCirclesError

    // Get ALL members to find matching address
    const { data: allMembers, error: allMembersError } = await supabase
      .from('members')
      .select('circle_id, member_address')

    if (allMembersError) throw allMembersError

    // Find circles where user is creator or member
    const userCircleIds = new Set()
    
    // Check creators
    for (const circle of allCircles) {
      try {
        const decryptedCreator = decrypt(circle.creator)
        if (decryptedCreator === address) {
          userCircleIds.add(circle.circle_id)
        }
      } catch (e) {
        // Skip if decryption fails
      }
    }

    // Check members
    for (const member of allMembers) {
      try {
        const decryptedAddress = decrypt(member.member_address)
        if (decryptedAddress === address) {
          userCircleIds.add(member.circle_id)
        }
      } catch (e) {
        // Skip if decryption fails
      }
    }

    // Filter circles to only user's circles
    const userCircles = allCircles.filter(c => userCircleIds.has(c.circle_id))

    // Decrypt circles
    const decryptedCircles = userCircles.map(circle => ({
      id: circle.circle_id,
      name: circle.name ? decrypt(circle.name) : null,
      creator: decrypt(circle.creator),
      contributionAmount: circle.contribution_amount,
      maxMembers: circle.max_members,
      cycleDurationBlocks: circle.cycle_duration_blocks,
      totalCycles: circle.total_cycles,
      status: circle.status,
      currentCycle: circle.current_cycle,
      membersJoined: circle.members_joined,
      startBlock: circle.start_block,
      createdAt: circle.created_at,
      totalContributed: 0, // Will be calculated
      isYourTurn: false,
      needsContribution: false,
      tokenId: circle.token_id || '0field',
    }))

    res.json(decryptedCircles)
  } catch (error) {
    console.error('Error fetching member circles:', error)
    res.status(500).json({ error: 'Failed to fetch circles', details: error.message })
  }
})

/**
 * POST /api/circles/batch
 * Fetch multiple circles by ID in a single request.
 * Body: { circleIds: string[] }
 */
app.post('/api/circles/batch', async (req, res) => {
  try {
    const { circleIds } = req.body
    if (!Array.isArray(circleIds) || circleIds.length === 0) {
      return res.status(400).json({ error: 'circleIds must be a non-empty array' })
    }
    // Cap to prevent abuse
    const ids = circleIds.slice(0, 50)

    if (USE_MOCK) {
      const found = mockData.circles
        .filter(c => ids.includes(c.circle_id))
        .map(c => ({
          id: c.circle_id,
          name: c.name,
          creator: c.creator,
          contributionAmount: c.contribution_amount,
          maxMembers: c.max_members,
          cycleDurationBlocks: c.cycle_duration_blocks,
          totalCycles: c.total_cycles,
          status: c.status,
          currentCycle: c.current_cycle,
          membersJoined: c.members_joined,
          createdAt: c.created_at,
          tokenId: c.token_id || '0field',
        }))
      return res.json({ circles: found })
    }

    const { data: circles, error } = await supabase
      .from('circles')
      .select('*')
      .in('circle_id', ids)

    if (error) throw error

    const decrypted = (circles || []).map(circle => ({
      id: circle.circle_id,
      name: circle.name ? decrypt(circle.name) : null,
      creator: decrypt(circle.creator),
      contributionAmount: circle.contribution_amount,
      maxMembers: circle.max_members,
      cycleDurationBlocks: circle.cycle_duration_blocks,
      totalCycles: circle.total_cycles,
      status: circle.status,
      currentCycle: circle.current_cycle,
      membersJoined: circle.members_joined,
      startBlock: circle.start_block,
      createdAt: circle.created_at,
      tokenId: circle.token_id || '0field',
    }))

    res.json({ circles: decrypted })
  } catch (error) {
    console.error('Error fetching batch circles:', error)
    res.status(500).json({ error: 'Failed to fetch circles', details: error.message })
  }
})

/**
 * POST /api/circles
 * Create a new circle entry
 */
app.post('/api/circles', async (req, res) => {
  try {
    const {
      circleId,
      name,
      creator,
      contributionAmount,
      maxMembers,
      totalCycles,
      transactionId,
      status,
      // optional / legacy fields — may not be sent by the frontend
      nameHash = null,
      cycleDurationBlocks = 0,
      salt = null,
      tokenId = '0field',
    } = req.body

    const resolvedTotalCycles = totalCycles || maxMembers || 0

    // Mock mode
    if (USE_MOCK) {
      const newCircle = {
        circle_id: circleId,
        name: name,
        creator: creator,
        contribution_amount: contributionAmount,
        max_members: maxMembers,
        cycle_duration_blocks: cycleDurationBlocks,
        total_cycles: resolvedTotalCycles,
        status: status,
        current_cycle: 1,
        members_joined: 1,
        created_at: new Date().toISOString(),
        token_id: tokenId || '0field',
      }
      mockData.circles.push(newCircle)
      return res.json({ success: true, circleId })
    }

    // Build insert object — omit nullable optional columns when not provided
    const circleInsert = {
      circle_id: circleId,
      name: name ? encrypt(name) : null,
      creator: encrypt(creator),
      contribution_amount: contributionAmount,
      max_members: maxMembers,
      cycle_duration_blocks: cycleDurationBlocks,
      total_cycles: resolvedTotalCycles,
      transaction_id: transactionId,
      status: status ?? 0,
      current_cycle: 1,
      members_joined: 1,
    }
    // Always include token_id so USDCx/USAD circles persist to DB
    circleInsert.token_id = tokenId || '0field'
    // Only include nullable columns when the caller actually sends them
    if (nameHash != null) circleInsert.name_hash = nameHash
    if (salt != null) circleInsert.salt = salt

    // Insert circle
    const { error: circleError } = await supabase
      .from('circles')
      .insert(circleInsert)

    if (circleError) {
      console.error('[POST /api/circles] Supabase insert error:', circleError)
      throw circleError
    }

    // Add creator as first member
    const memberInsert = {
      circle_id: circleId,
      member_address: encrypt(creator),
      join_order: 1,
      total_contributed: 0,
      has_received_payout: false,
      active: true,
      transaction_id: transactionId,
    }
    if (salt != null) memberInsert.salt = salt

    const { error: memberError } = await supabase
      .from('members')
      .insert(memberInsert)

    if (memberError) {
      console.error('[POST /api/circles] Member insert error:', memberError)
      throw memberError
    }

    res.json({ success: true, circleId })
  } catch (error) {
    console.error('Error creating circle:', error)
    res.status(500).json({ error: 'Failed to create circle' })
  }
})

/**
 * POST /api/circles/:circleId/members
 * Add a new member to a circle
 */
app.post('/api/circles/:circleId/members', async (req, res) => {
  try {
    const { circleId } = req.params
    const { memberAddress, transactionId, salt } = req.body

    // Mock mode
    if (USE_MOCK) {
      const circle = mockData.circles.find(c => c.circle_id === circleId)
      if (circle) {
        circle.members_joined++
      }
      return res.json({ success: true })
    }

    // Get current member count
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('members_joined, max_members')
      .eq('circle_id', circleId)
      .single()

    if (circleError || !circle) {
      return res.status(404).json({ error: 'Circle not found' })
    }

    const newJoinOrder = circle.members_joined + 1

    // Add member
    const { error: memberError } = await supabase
      .from('members')
      .insert({
        circle_id: circleId,
        member_address: encrypt(memberAddress),
        join_order: newJoinOrder,
        total_contributed: 0,
        has_received_payout: false,
        active: true,
        salt: salt || null,
        transaction_id: transactionId,
      })

    if (memberError) throw memberError

    // Update circle member count
    const updateData = { members_joined: newJoinOrder }
    
    // If circle is now full, activate it
    if (newJoinOrder === circle.max_members) {
      updateData.status = 1 // Active
      updateData.current_cycle = 1
      updateData.start_block = Date.now() // Use timestamp as placeholder
    }

    await supabase
      .from('circles')
      .update(updateData)
      .eq('circle_id', circleId)

    res.json({ success: true, joinOrder: newJoinOrder })
  } catch (error) {
    console.error('Error adding member:', error)
    res.status(500).json({ error: 'Failed to add member' })
  }
})

/**
 * PUT /api/circles/:circleId/members/transfer
 * Update member address after an on-chain transfer_membership transaction
 */
app.put('/api/circles/:circleId/members/transfer', async (req, res) => {
  try {
    const { circleId } = req.params
    const { oldAddress, newAddress, transactionId } = req.body

    if (!oldAddress || !newAddress) {
      return res.status(400).json({ error: 'oldAddress and newAddress are required' })
    }

    if (USE_MOCK) {
      const idx = (mockData.members || []).findIndex(m => m.circle_id === circleId && m.member_address === oldAddress)
      if (idx >= 0) mockData.members[idx].member_address = newAddress
      return res.json({ success: true })
    }

    // Find the member row by decrypting each address for this circle (AES-GCM random IV)
    const { data: allMembers, error: fetchError } = await supabase
      .from('members')
      .select('id, member_address')
      .eq('circle_id', circleId)

    if (fetchError) throw fetchError

    let memberId = null
    for (const m of (allMembers || [])) {
      try {
        if (decrypt(m.member_address) === oldAddress) { memberId = m.id; break }
      } catch { /* skip unreadable rows */ }
    }

    if (!memberId) {
      return res.status(404).json({ error: 'Member not found in this circle' })
    }

    const { error: updateError } = await supabase
      .from('members')
      .update({ member_address: encrypt(newAddress) })
      .eq('id', memberId)

    if (updateError) throw updateError

    console.log(`[Transfer] circle ${circleId}: ${oldAddress.slice(0, 10)}… → ${newAddress.slice(0, 10)}… tx:${transactionId}`)
    res.json({ success: true })
  } catch (error) {
    console.error('Error transferring membership:', error)
    res.status(500).json({ error: 'Failed to transfer membership' })
  }
})

// ==================== CONTRIBUTIONS ENDPOINTS ====================

/**
 * POST /api/contributions
 * Record a contribution
 */
app.post('/api/contributions', async (req, res) => {
  try {
    const { circleId, memberAddress, cycle, amount, transactionId } = req.body

    // Mock mode
    if (USE_MOCK) {
      mockData.contributions.push({ circleId, memberAddress, cycle, amount, transactionId })
      return res.json({ success: true })
    }

    // Insert contribution
    const { error: contribError } = await supabase
      .from('contributions')
      .insert({
        circle_id: circleId,
        member_address: encrypt(memberAddress),
        cycle: cycle,
        amount: amount,
        transaction_id: transactionId,
      })

    if (contribError) throw contribError

    // Update member's total contributed
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('total_contributed')
      .eq('circle_id', circleId)
      .eq('member_address', encrypt(memberAddress))
      .single()

    if (!memberError && member) {
      await supabase
        .from('members')
        .update({ total_contributed: member.total_contributed + amount })
        .eq('circle_id', circleId)
        .eq('member_address', encrypt(memberAddress))
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error recording contribution:', error)
    res.status(500).json({ error: 'Failed to record contribution' })
  }
})

// ==================== ANALYTICS ENDPOINTS ====================

/**
 * GET /api/circles/:circleId/analytics
 * Returns aggregated analytics for a circle
 */
app.get('/api/circles/:circleId/analytics', async (req, res) => {
  try {
    const { circleId } = req.params

    if (USE_MOCK) {
      const circle = mockData.circles.find(c => c.id === circleId)
      if (!circle) return res.status(404).json({ error: 'Circle not found' })
      const totalCycles = circle.total_cycles || 6
      const cycleHistory = Array.from({ length: totalCycles }, (_, i) => ({
        cycle: i + 1,
        expected: circle.contribution_amount || 10,
        actual: i < (circle.current_cycle || 1) ? (circle.contribution_amount || 10) : 0,
        completionRate: i < (circle.current_cycle || 1) ? 100 : 0,
      }))
      const members = mockData.members.filter(m => m.circle_id === circleId)
      const memberContributions = members.map(m => ({
        address: m.member_address,
        contributed: (circle.contribution_amount || 10) * (circle.current_cycle || 1),
        expected: (circle.contribution_amount || 10) * totalCycles,
        missedCycles: 0,
      }))
      const payoutSchedule = members.map((m, i) => ({
        cycle: i + 1,
        recipient: m.member_address,
        amount: (circle.contribution_amount || 10) * members.length,
        status: i + 1 < (circle.current_cycle || 1) ? 'completed' : i + 1 === (circle.current_cycle || 1) ? 'current' : 'upcoming',
        expectedDate: null,
      }))
      return res.json({
        circleId,
        circleName: circle.name,
        totalContributed: (circle.contribution_amount || 10) * members.length * (circle.current_cycle || 1),
        totalPaidOut: (circle.contribution_amount || 10) * members.length * Math.max(0, (circle.current_cycle || 1) - 1),
        activeMembers: members.length,
        completionPercentage: Math.round(((circle.current_cycle || 1) / totalCycles) * 100),
        healthScore: 85,
        cycleHistory,
        memberContributions,
        payoutSchedule,
      })
    }

    // Real Supabase mode
    const { data: circle, error: circleErr } = await supabase
      .from('circles')
      .select('*')
      .eq('circle_id', circleId)
      .single()
    if (circleErr || !circle) return res.status(404).json({ error: 'Circle not found' })

    const { data: members } = await supabase.from('members').select('*').eq('circle_id', circleId)
    const { data: contributions } = await supabase.from('contributions').select('*').eq('circle_id', circleId)
    const { data: payouts } = await supabase.from('payouts').select('*').eq('circle_id', circleId)

    const memberList = members || []
    const contribs = contributions || []
    const payoutList = payouts || []
    const totalCycles = circle.total_cycles || 6
    const contribAmount = Number(circle.contribution_amount) || 10

    const cycleHistory = Array.from({ length: totalCycles }, (_, i) => {
      const cycleNum = i + 1
      const cycleContribs = contribs.filter(c => c.cycle === cycleNum)
      const actual = cycleContribs.reduce((sum, c) => sum + Number(c.amount), 0)
      const expected = contribAmount * memberList.length
      return {
        cycle: cycleNum,
        expected,
        actual,
        completionRate: expected > 0 ? Math.round((actual / expected) * 100) : 0,
      }
    })

    const memberContributions = memberList.map(m => {
      const mc = contribs.filter(c => c.member_address === m.member_address)
      const contributed = mc.reduce((sum, c) => sum + Number(c.amount), 0)
      const expected = contribAmount * totalCycles
      const missedCycles = totalCycles - mc.length
      return { address: m.member_address, contributed, expected, missedCycles: Math.max(0, missedCycles) }
    })

    const payoutSchedule = memberList.map((m, i) => {
      const payout = payoutList.find(p => p.member_address === m.member_address)
      const cycle = m.payout_cycle || i + 1
      return {
        cycle,
        recipient: m.member_address,
        amount: contribAmount * memberList.length,
        status: payout ? 'completed' : cycle === circle.current_cycle ? 'current' : 'upcoming',
        expectedDate: m.expected_payout_date || null,
      }
    })

    const totalContributed = contribs.reduce((sum, c) => sum + Number(c.amount), 0)
    const totalPaidOut = payoutList.reduce((sum, p) => sum + Number(p.amount), 0)
    const currentCycle = circle.current_cycle || 0
    // completedCycles = cycles that have fully finished (current cycle is still running)
    const completedCycles = Math.max(currentCycle - 1, 0)
    const completionPercentage = totalCycles > 0 ? Math.round((completedCycles / totalCycles) * 100) : 0
    const healthScore = Math.min(100, Math.round(
      (memberList.length / (circle.max_members || memberList.length || 1)) * 40 +
      completionPercentage * 0.4 +
      (totalContributed > 0 ? 20 : 0)
    ))

    // Per-member contribution metadata: which cycles they contributed to
    const memberContributionsFull = memberList.map(m => {
      const mc = contribs.filter(c => c.member_address === m.member_address)
      const contributed = mc.reduce((sum, c) => sum + Number(c.amount), 0)
      const expected = contribAmount * totalCycles
      const missedCycles = Math.max(0, currentCycle - mc.length)
      const cycles = Array.from({ length: totalCycles }, (_, i) =>
        mc.some(c => c.cycle === i + 1)
      )
      const addr = m.member_address
      const shortAddress = addr.length > 16 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr
      return { address: addr, shortAddress, contributed, expected, missedCycles, cycles }
    })

    return res.json({
      circleId,
      circleName: circle.name,
      totalCycles,
      completedCycles,
      currentCycle,
      totalContributed,
      totalPaidOut,
      activeMembers: memberList.length,
      completionPercentage,
      healthScore,
      cycleHistory,
      memberContributions: memberContributionsFull,
      payoutSchedule,
    })
  } catch (err) {
    console.error('Analytics error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ==================== PAYOUTS ENDPOINTS ====================

/**
 * POST /api/payouts
 * Record a payout
 */
app.post('/api/payouts', async (req, res) => {
  try {
    const { circleId, memberAddress, cycle, amount, transactionId } = req.body

    // Mock mode
    if (USE_MOCK) {
      mockData.payouts.push({ circleId, memberAddress, cycle, amount, transactionId })
      return res.json({ success: true })
    }

    // Insert payout
    const { error: payoutError } = await supabase
      .from('payouts')
      .insert({
        circle_id: circleId,
        member_address: encrypt(memberAddress),
        cycle: cycle,
        amount: amount,
        transaction_id: transactionId,
      })

    if (payoutError) throw payoutError

    // Update member's payout status
    await supabase
      .from('members')
      .update({ has_received_payout: true })
      .eq('circle_id', circleId)
      .eq('member_address', encrypt(memberAddress))

    // Get circle to check if we need to advance cycle or complete
    const { data: circle } = await supabase
      .from('circles')
      .select('current_cycle, total_cycles')
      .eq('circle_id', circleId)
      .single()

    if (circle) {
      const nextCycle = circle.current_cycle + 1
      if (nextCycle > circle.total_cycles) {
        // Circle completed
        await supabase
          .from('circles')
          .update({ status: 2 }) // Completed
          .eq('circle_id', circleId)
      } else {
        // Advance to next cycle
        await supabase
          .from('circles')
          .update({ current_cycle: nextCycle })
          .eq('circle_id', circleId)
      }
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error recording payout:', error)
    res.status(500).json({ error: 'Failed to record payout' })
  }
})

// ==================== DELETE/DISSOLVE CIRCLE ====================

/**
 * DELETE /api/circles/:circleId
 * Dissolve and delete a circle (only creator can do this, only for forming circles)
 */
app.delete('/api/circles/:circleId', async (req, res) => {
  try {
    const { circleId } = req.params
    const { creatorAddress } = req.body

    if (!creatorAddress) {
      return res.status(400).json({ error: 'Creator address required' })
    }

    // Mock mode
    if (USE_MOCK) {
      const index = mockData.circles.findIndex(c => c.circle_id === circleId)
      if (index >= 0) {
        mockData.circles.splice(index, 1)
      }
      return res.json({ success: true })
    }

    // Get circle to verify creator and status
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('creator, status')
      .eq('circle_id', circleId)
      .single()

    if (circleError || !circle) {
      return res.status(404).json({ error: 'Circle not found' })
    }

    // Verify creator
    const decryptedCreator = decrypt(circle.creator)
    if (decryptedCreator !== creatorAddress) {
      return res.status(403).json({ error: 'Only the creator can dissolve this circle' })
    }

    // Only allow dissolving forming circles (status 0)
    if (circle.status !== 0) {
      return res.status(400).json({ error: 'Can only dissolve circles that are still forming' })
    }

    // Delete members first (foreign key constraint)
    await supabase
      .from('members')
      .delete()
      .eq('circle_id', circleId)

    // Delete contributions if any
    await supabase
      .from('contributions')
      .delete()
      .eq('circle_id', circleId)

    // Delete the circle
    const { error: deleteError } = await supabase
      .from('circles')
      .delete()
      .eq('circle_id', circleId)

    if (deleteError) throw deleteError

    res.json({ success: true, message: 'Circle dissolved successfully' })
  } catch (error) {
    console.error('Error dissolving circle:', error)
    res.status(500).json({ error: 'Failed to dissolve circle' })
  }
})

// ==================== INVITE LINKS (v11) ====================

/**
 * POST /api/invites
 * Create an invite link for a circle
 */
app.post('/api/invites', async (req, res) => {
  try {
    const { circleId, creatorAddress, maxUses = 0, expiresInHours = 168 } = req.body

    if (!circleId || !creatorAddress) {
      return res.status(400).json({ error: 'circleId and creatorAddress are required' })
    }

    // Generate a short invite code (8 chars, alphanumeric)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let code = ''
    const randomBytes = require('crypto').randomBytes(8)
    for (let i = 0; i < 8; i++) {
      code += chars[randomBytes[i] % chars.length]
    }

    const expiresAt = new Date(Date.now() + expiresInHours * 3600000).toISOString()

    if (USE_MOCK) {
      if (!mockData.invites) mockData.invites = []
      mockData.invites.push({ code, circle_id: circleId, created_by: creatorAddress, expires_at: expiresAt, max_uses: maxUses, use_count: 0, active: true })
      return res.json({ success: true, code, expiresAt })
    }

    const { error } = await supabase.from('invites').insert({
      code,
      circle_id: circleId,
      created_by: encrypt(creatorAddress),
      expires_at: expiresAt,
      max_uses: maxUses,
      use_count: 0,
      active: true,
    })
    if (error) throw error

    res.json({ success: true, code, expiresAt })
  } catch (error) {
    console.error('Error creating invite:', error)
    res.status(500).json({ error: 'Failed to create invite' })
  }
})

/**
 * GET /api/invites/:code
 * Validate and return invite details
 */
app.get('/api/invites/:code', async (req, res) => {
  try {
    const { code } = req.params

    if (USE_MOCK) {
      const invite = (mockData.invites || []).find(i => i.code === code)
      if (!invite) return res.status(404).json({ error: 'Invite not found' })
      const circle = mockData.circles.find(c => c.circle_id === invite.circle_id)
      return res.json({
        valid: invite.active && new Date(invite.expires_at) > new Date(),
        circleId: invite.circle_id,
        circleName: circle?.name || null,
        contributionAmount: circle?.contribution_amount || 0,
        maxMembers: circle?.max_members || 0,
        membersJoined: circle?.members_joined || 0,
        tokenId: circle?.token_id || '0field',
        expiresAt: invite.expires_at,
      })
    }

    const { data: invite, error } = await supabase
      .from('invites')
      .select('*')
      .eq('code', code)
      .single()

    if (error || !invite) {
      return res.status(404).json({ error: 'Invite not found' })
    }

    const isExpired = new Date(invite.expires_at) <= new Date()
    const isMaxUsed = invite.max_uses > 0 && invite.use_count >= invite.max_uses
    const isValid = invite.active && !isExpired && !isMaxUsed

    // Get circle info
    const { data: circle } = await supabase
      .from('circles')
      .select('*')
      .eq('circle_id', invite.circle_id)
      .single()

    res.json({
      valid: isValid,
      circleId: invite.circle_id,
      circleName: circle ? (circle.name ? decrypt(circle.name) : null) : null,
      contributionAmount: circle?.contribution_amount || 0,
      maxMembers: circle?.max_members || 0,
      membersJoined: circle?.members_joined || 0,
      tokenId: circle?.token_id || '0field',
      expiresAt: invite.expires_at,
    })
  } catch (error) {
    console.error('Error validating invite:', error)
    res.status(500).json({ error: 'Failed to validate invite' })
  }
})

/**
 * POST /api/invites/:code/use
 * Mark an invite as used (called after successful join)
 */
app.post('/api/invites/:code/use', async (req, res) => {
  try {
    const { code } = req.params

    if (USE_MOCK) {
      const invite = (mockData.invites || []).find(i => i.code === code)
      if (invite) invite.use_count++
      return res.json({ success: true })
    }

    await supabase.rpc('increment_invite_use', { invite_code: code }).catch(() => {
      // Fallback if RPC not available
      return supabase
        .from('invites')
        .update({ use_count: supabase.raw('use_count + 1') })
        .eq('code', code)
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error using invite:', error)
    res.status(500).json({ error: 'Failed to use invite' })
  }
})

// ==================== DISPUTE RESOLUTION (v11) ====================

/**
 * GET /api/disputes/:circleId
 * Get all disputes for a circle
 */
app.get('/api/disputes/:circleId', async (req, res) => {
  try {
    const { circleId } = req.params

    if (USE_MOCK) {
      return res.json({ disputes: mockData.disputes || [] })
    }

    const { data: disputes, error } = await supabase
      .from('disputes')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get votes for each dispute
    const disputeIds = (disputes || []).map(d => d.dispute_id)
    let allVotes = []
    if (disputeIds.length > 0) {
      const { data: votes } = await supabase
        .from('dispute_votes')
        .select('*')
        .in('dispute_id', disputeIds)
      allVotes = votes || []
    }

    const decrypted = (disputes || []).map(d => ({
      disputeId: d.dispute_id,
      circleId: d.circle_id,
      accused: decrypt(d.accused),
      reporter: decrypt(d.reporter),
      reason: d.reason,
      votesFor: d.votes_for,
      votesAgainst: d.votes_against,
      status: d.status,
      cycle: d.cycle,
      transactionId: d.transaction_id,
      createdAt: d.created_at,
      resolvedAt: d.resolved_at,
      votes: allVotes
        .filter(v => v.dispute_id === d.dispute_id)
        .map(v => ({ voter: decrypt(v.voter), voteFor: v.vote_for, createdAt: v.created_at })),
    }))

    res.json({ disputes: decrypted })
  } catch (error) {
    console.error('Error fetching disputes:', error)
    res.status(500).json({ error: 'Failed to fetch disputes' })
  }
})

/**
 * POST /api/disputes
 * Record a new dispute (after on-chain create_dispute TX)
 */
app.post('/api/disputes', async (req, res) => {
  try {
    const { disputeId, circleId, accused, reporter, reason, cycle, transactionId } = req.body

    if (USE_MOCK) {
      if (!mockData.disputes) mockData.disputes = []
      mockData.disputes.push({ disputeId, circleId, accused, reporter, reason, cycle, votesFor: 1, votesAgainst: 0, status: 0, transactionId, createdAt: new Date().toISOString() })
      return res.json({ success: true })
    }

    const { error } = await supabase.from('disputes').upsert({
      dispute_id: disputeId,
      circle_id: circleId,
      accused: encrypt(accused),
      reporter: encrypt(reporter),
      reason,
      votes_for: 1,
      votes_against: 0,
      status: 0,
      cycle,
      transaction_id: transactionId,
    }, { onConflict: 'dispute_id' })
    if (error) throw error

    // Record reporter's vote (ignore duplicate)
    await supabase.from('dispute_votes').upsert({
      dispute_id: disputeId,
      voter: encrypt(reporter),
      vote_for: true,
      transaction_id: transactionId,
    }, { onConflict: 'dispute_id,voter' }).then(() => {})

    res.json({ success: true })
  } catch (error) {
    console.error('Error creating dispute:', error)
    res.status(500).json({ error: 'Failed to create dispute' })
  }
})

/**
 * POST /api/disputes/:disputeId/vote
 * Record a dispute vote
 */
app.post('/api/disputes/:disputeId/vote', async (req, res) => {
  try {
    const { disputeId } = req.params
    const { voter, voteFor, transactionId } = req.body

    if (USE_MOCK) {
      const d = (mockData.disputes || []).find(d => d.disputeId === disputeId)
      if (d) { voteFor ? d.votesFor++ : d.votesAgainst++ }
      return res.json({ success: true })
    }

    // Record the vote
    const { error: voteError } = await supabase.from('dispute_votes').insert({
      dispute_id: disputeId,
      voter: encrypt(voter),
      vote_for: voteFor,
      transaction_id: transactionId,
    })
    if (voteError) throw voteError

    // Update vote counts
    const { data: dispute } = await supabase
      .from('disputes')
      .select('votes_for, votes_against')
      .eq('dispute_id', disputeId)
      .single()

    if (dispute) {
      const update = voteFor
        ? { votes_for: dispute.votes_for + 1 }
        : { votes_against: dispute.votes_against + 1 }
      await supabase.from('disputes').update(update).eq('dispute_id', disputeId)
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error recording vote:', error)
    res.status(500).json({ error: 'Failed to record vote' })
  }
})

/**
 * POST /api/disputes/:disputeId/resolve
 * Mark a dispute as resolved
 */
app.post('/api/disputes/:disputeId/resolve', async (req, res) => {
  try {
    const { disputeId } = req.params
    const { status, transactionId } = req.body

    if (USE_MOCK) {
      const d = (mockData.disputes || []).find(d => d.disputeId === disputeId)
      if (d) d.status = status
      return res.json({ success: true })
    }

    const { error } = await supabase.from('disputes').update({
      status,
      resolved_at: new Date().toISOString(),
      transaction_id: transactionId,
    }).eq('dispute_id', disputeId)

    if (error) throw error
    res.json({ success: true })
  } catch (error) {
    console.error('Error resolving dispute:', error)
    res.status(500).json({ error: 'Failed to resolve dispute' })
  }
})

// ==================== AUTO-CONTRIBUTION SCHEDULES (v11) ====================

/**
 * GET /api/schedules/:address
 * Get all contribution schedules for a user
 */
app.get('/api/schedules/:address', async (req, res) => {
  try {
    const { address } = req.params

    if (USE_MOCK) {
      return res.json({ schedules: mockData.schedules || [] })
    }

    // Need to search through all schedules and decrypt to find matches
    const { data: allSchedules, error } = await supabase
      .from('contribution_schedules')
      .select('*')
    if (error) throw error

    const userSchedules = (allSchedules || []).filter(s => {
      try { return decrypt(s.member_address) === address } catch { return false }
    }).map(s => ({
      circleId: s.circle_id,
      enabled: s.enabled,
      notifyBeforeMinutes: s.notify_before_minutes,
      lastNotifiedCycle: s.last_notified_cycle,
      createdAt: s.created_at,
    }))

    res.json({ schedules: userSchedules })
  } catch (error) {
    console.error('Error fetching schedules:', error)
    res.status(500).json({ error: 'Failed to fetch schedules' })
  }
})

/**
 * POST /api/schedules
 * Create or update a contribution schedule
 */
app.post('/api/schedules', async (req, res) => {
  try {
    const { circleId, memberAddress, enabled = true, notifyBeforeMinutes = 60 } = req.body

    if (USE_MOCK) {
      if (!mockData.schedules) mockData.schedules = []
      const existing = mockData.schedules.findIndex(s => s.circleId === circleId && s.memberAddress === memberAddress)
      if (existing >= 0) {
        mockData.schedules[existing] = { circleId, memberAddress, enabled, notifyBeforeMinutes }
      } else {
        mockData.schedules.push({ circleId, memberAddress, enabled, notifyBeforeMinutes })
      }
      return res.json({ success: true })
    }

    const encryptedAddress = encrypt(memberAddress)

    // Find existing schedule for this circle+member (decrypt each row to compare,
    // since member_address is AES-GCM encrypted with a random IV each time)
    const { data: existing, error: fetchError } = await supabase
      .from('contribution_schedules')
      .select('id, member_address')
      .eq('circle_id', circleId)

    if (fetchError) throw fetchError

    let existingId = null
    for (const row of (existing || [])) {
      try {
        if (decrypt(row.member_address) === memberAddress) { existingId = row.id; break }
      } catch { /* skip unreadable rows */ }
    }

    if (existingId) {
      const { error } = await supabase
        .from('contribution_schedules')
        .update({ enabled, notify_before_minutes: notifyBeforeMinutes })
        .eq('id', existingId)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('contribution_schedules')
        .insert({
          circle_id: circleId,
          member_address: encryptedAddress,
          enabled,
          notify_before_minutes: notifyBeforeMinutes,
          last_notified_cycle: 0,
        })
      if (error) throw error
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error saving schedule:', error)
    res.status(500).json({ error: 'Failed to save schedule' })
  }
})

/**
 * DELETE /api/schedules/:circleId/:address
 * Remove a contribution schedule
 */
app.delete('/api/schedules/:circleId/:address', async (req, res) => {
  try {
    const { circleId, address } = req.params

    if (USE_MOCK) {
      if (mockData.schedules) {
        mockData.schedules = mockData.schedules.filter(s => !(s.circleId === circleId && s.memberAddress === address))
      }
      return res.json({ success: true })
    }

    // Find and delete the matching encrypted entry
    const { data: allSchedules } = await supabase
      .from('contribution_schedules')
      .select('id, member_address')
      .eq('circle_id', circleId)

    for (const s of (allSchedules || [])) {
      try {
        if (decrypt(s.member_address) === address) {
          await supabase.from('contribution_schedules').delete().eq('id', s.id)
          break
        }
      } catch { /* skip */ }
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting schedule:', error)
    res.status(500).json({ error: 'Failed to delete schedule' })
  }
})

/**
 * GET /api/schedules/pending-notifications
 * Get circles that need contribution notifications (for cron/worker)
 */
app.get('/api/schedules/pending-notifications', async (req, res) => {
  try {
    if (USE_MOCK) {
      return res.json({ notifications: [] })
    }

    // Find active circles with enabled schedules where notification hasn't been sent for current cycle
    const { data: schedules, error } = await supabase
      .from('contribution_schedules')
      .select('*, circles!inner(circle_id, current_cycle, status, contribution_amount, token_id)')
      .eq('enabled', true)
      .eq('circles.status', 1)

    if (error) throw error

    const pending = (schedules || []).filter(s =>
      s.circles && s.last_notified_cycle < s.circles.current_cycle
    ).map(s => ({
      circleId: s.circle_id,
      memberAddress: decrypt(s.member_address),
      currentCycle: s.circles.current_cycle,
      contributionAmount: s.circles.contribution_amount,
      tokenId: s.circles.token_id || '0field',
    }))

    res.json({ notifications: pending })
  } catch (error) {
    console.error('Error fetching pending notifications:', error)
    res.status(500).json({ error: 'Failed to fetch pending notifications' })
  }
})

// ==================== zkEMAIL IDENTITY VERIFICATION (v11) ====================

/**
 * POST /api/email/register
 * Register an email commitment (step 1: user commits email_hash)
 */
// Helper: find the newest email_verifications row for a given plaintext address
async function findEntryByAddress(address) {
  const { data: allEntries } = await supabase
    .from('email_verifications')
    .select('*')
    .order('created_at', { ascending: false })
  for (const entry of (allEntries || [])) {
    try {
      if (entry.address && decrypt(entry.address) === address) return entry
    } catch { /* skip */ }
  }
  return null
}

app.post('/api/email/register', async (req, res) => {
  try {
    const { address, emailHash, transactionId, email } = req.body

    if (!address || !emailHash) {
      return res.status(400).json({ error: 'address and emailHash are required' })
    }

    if (USE_MOCK) {
      if (!mockData.emailVerifications) mockData.emailVerifications = []
      const existing = mockData.emailVerifications.find(e => e.address === address)
      if (existing) {
        existing.emailHash = emailHash
        existing.email = email || null
        existing.status = Math.min(existing.status, 1)
      } else {
        mockData.emailVerifications.push({ address, emailHash, email: email || null, status: 0, transactionId })
      }
      return res.json({ success: true })
    }

    // Find existing row first — encrypt() uses random IV so UNIQUE constraint is unreliable
    const existing = await findEntryByAddress(address)

    const updateData = {
      email_hash: emailHash,
      on_chain_tx: transactionId,
      status: 2,   // verified immediately — on-chain tx is the only proof needed
      expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
    }
    if (email) {
      try { updateData.email = encrypt(email) } catch { /* skip if encrypt fails */ }
    }

    if (existing) {
      // Update existing row — never create duplicates
      const { error } = await supabase
        .from('email_verifications')
        .update(updateData)
        .eq('id', existing.id)
      if (error) throw error
    } else {
      // Insert new row
      const insertData = { ...updateData, address: encrypt(address) }
      const { error } = await supabase.from('email_verifications').insert(insertData)
      if (error) {
        // Retry without email column if it doesn't exist yet
        if (email && (error.message?.includes('email') || error.code === '42703')) {
          delete insertData.email
          const { error: e2 } = await supabase.from('email_verifications').insert(insertData)
          if (e2) throw e2
        } else {
          throw error
        }
      }
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error registering email:', error)
    res.status(500).json({ error: 'Failed to register email commitment' })
  }
})

/**
 * POST /api/email/send-code
 * Generate and store a verification code hash (step 2)
 * In production, this would send an actual email. For now it returns the code.
 */
app.post('/api/email/send-code', async (req, res) => {
  try {
    const { address } = req.body

    if (!address) {
      return res.status(400).json({ error: 'address is required' })
    }

    // Generate a 6-digit verification code
    const code = require('crypto').randomInt(100000, 999999).toString()
    const codeHash = require('crypto').createHash('sha256').update(code).digest('hex')

    if (USE_MOCK) {
      const entry = (mockData.emailVerifications || []).find(e => e.address === address)
      if (entry) { entry.codeHash = codeHash; entry.status = 1 }
      return res.json({ success: true, codeSent: true, testCode: code })
    }

    // Find the user's entry (newest row wins) — retry once to handle race with register
    let targetEntry = await findEntryByAddress(address)
    if (!targetEntry) {
      await new Promise(r => setTimeout(r, 1500))
      targetEntry = await findEntryByAddress(address)
    }

    if (!targetEntry) {
      return res.status(404).json({ error: 'No email commitment found. Register first.' })
    }

    const { error: updateError } = await supabase.from('email_verifications').update({
      verification_code_hash: codeHash,
      status: 1,
      expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
    }).eq('id', targetEntry.id)

    if (updateError) {
      console.error('Failed to store code hash:', updateError)
      return res.status(500).json({ error: 'Failed to generate verification code' })
    }

    // Attempt to send email if address is stored
    let emailSent = false
    let resendErrorDetail = null
    if (targetEntry.email) {
      const recipientEmail = decrypt(targetEntry.email)
      const subject = 'ZkCircles - Email Verification Code'
      const text = `Your ZkCircles verification code is: ${code}\n\nThis code expires in 30 minutes.`
      const html = `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #f3e8d4;border-radius:16px"><h2 style="color:#92400e">ZkCircles Verification</h2><p style="color:#44403c">Your verification code is:</p><div style="font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:10px;color:#2c241f;background:#fef3c7;padding:16px;border-radius:8px;text-align:center">${code}</div><p style="color:#78716c;font-size:14px">This code expires in 30 minutes.</p></div>`

      // Option 1: Resend (HTTP API — no SMTP needed, free tier)
      if (!emailSent && process.env.RESEND_API_KEY) {
        try {
          const { Resend } = require('resend')
          const resend = new Resend(process.env.RESEND_API_KEY)
          const fromAddress = process.env.RESEND_FROM || 'onboarding@resend.dev'
          console.log(`[Resend] Sending to: ${recipientEmail} from: ${fromAddress}`)
          const result = await resend.emails.send({
            from: fromAddress,
            to: recipientEmail,
            subject,
            text,
            html,
          })
          if (result.error) {
            // Resend SDK returns errors in result.error rather than throwing
            resendErrorDetail = result.error
            console.error('[Resend] API error:', JSON.stringify(result.error))
          } else {
            console.log('[Resend] Email sent OK, id:', result.data?.id)
            emailSent = true
          }
        } catch (e) {
          resendErrorDetail = e.message
          console.error('[Resend] Delivery exception:', e.message, e)
        }
      }

      // Option 2: SMTP via nodemailer
      if (!emailSent && process.env.SMTP_HOST) {
        try {
          const nodemailer = require('nodemailer')
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          })
          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@zkcircles.app',
            to: recipientEmail,
            subject,
            text,
            html,
          })
          emailSent = true
        } catch (e) {
          console.warn('SMTP delivery failed:', e.message)
        }
      }
    }

    // Return testCode for testnet when email delivery is not available
    const response = { success: true, codeSent: true }
    if (!emailSent) {
      response.testCode = code
      if (resendErrorDetail) response.emailError = resendErrorDetail
    }
    res.json(response)
  } catch (error) {
    console.error('Error sending code:', error)
    res.status(500).json({ error: 'Failed to send verification code' })
  }
})

/**
 * POST /api/email/verify
 * Verify the code and mark email as verified (step 3)
 */
app.post('/api/email/verify', async (req, res) => {
  try {
    const { address, code, transactionId } = req.body

    if (!address || !code) {
      return res.status(400).json({ error: 'address and code are required' })
    }

    const trimmedCode = code.trim()
    const codeHash = require('crypto').createHash('sha256').update(trimmedCode).digest('hex')

    if (USE_MOCK) {
      const entry = (mockData.emailVerifications || []).find(e => e.address === address)
      if (!entry || entry.codeHash !== codeHash) {
        return res.status(400).json({ error: 'Invalid verification code' })
      }
      entry.status = 2
      return res.json({ success: true, verified: true })
    }

    // Find the user's entry (newest row wins)
    const target = await findEntryByAddress(address)

    if (!target) {
      return res.status(404).json({ error: 'No verification found. Register your email first.' })
    }

    if (target.status === 2) {
      return res.json({ success: true, verified: true, message: 'Already verified' })
    }

    if (target.verification_code_hash !== codeHash) {
      return res.status(400).json({ error: 'Invalid verification code' })
    }

    if (new Date(target.expires_at) <= new Date()) {
      return res.status(400).json({ error: 'Verification code expired. Request a new one.' })
    }

    await supabase.from('email_verifications').update({
      status: 2,
      verified_at: new Date().toISOString(),
      verify_chain_tx: transactionId || null,
    }).eq('id', target.id)

    res.json({ success: true, verified: true })
  } catch (error) {
    console.error('Error verifying email:', error)
    res.status(500).json({ error: 'Failed to verify email' })
  }
})

/**
 * GET /api/email/status/:address
 * Check email verification status for an address
 */
app.get('/api/email/status/:address', async (req, res) => {
  try {
    const { address } = req.params

    if (USE_MOCK) {
      const entry = (mockData.emailVerifications || []).find(e => e.address === address)
      return res.json({
        registered: !!entry,
        verified: entry?.status === 2,
        status: entry?.status || 0,
      })
    }

    const found = await findEntryByAddress(address)

    res.json({
      registered: !!found,
      verified: found?.status === 2,
      status: found?.status || 0,
      verifiedAt: found?.verified_at || null,
    })
  } catch (error) {
    console.error('Error checking email status:', error)
    res.status(500).json({ error: 'Failed to check email status' })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`ZkCircles backend running on port ${PORT}`)
})
