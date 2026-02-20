/**
 * ZkCircles Backend API
 * Provides off-chain indexing and encrypted storage for circle data
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')
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
  console.log('✅ Connected to Supabase')
} else {
  console.log('⚠️  Running in MOCK MODE - Supabase not configured')
  console.log('   To use real database, set SUPABASE_URL and SUPABASE_ANON_KEY in .env')
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'zk-circles-backend', mode: USE_MOCK ? 'mock' : 'production' })
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
    }))

    res.json({
      circles: decryptedCircles,
      stats: computedStats,
    })
  } catch (error) {
    console.error('Error fetching circles:', error)
    res.status(500).json({ error: 'Failed to fetch circles' })
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
    res.status(500).json({ error: 'Failed to fetch circle' })
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
    }))

    res.json(decryptedCircles)
  } catch (error) {
    console.error('Error fetching member circles:', error)
    res.status(500).json({ error: 'Failed to fetch circles' })
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
      nameHash,
      creator,
      contributionAmount,
      maxMembers,
      cycleDurationBlocks,
      salt,
      transactionId,
      status,
    } = req.body

    // Mock mode
    if (USE_MOCK) {
      const newCircle = {
        circle_id: circleId,
        name: name,
        creator: creator,
        contribution_amount: contributionAmount,
        max_members: maxMembers,
        cycle_duration_blocks: cycleDurationBlocks,
        total_cycles: maxMembers,
        status: status,
        current_cycle: 0,
        members_joined: 1,
        created_at: new Date().toISOString(),
      }
      mockData.circles.push(newCircle)
      return res.json({ success: true, circleId })
    }

    // Insert circle
    const { error: circleError } = await supabase
      .from('circles')
      .insert({
        circle_id: circleId,
        name: name ? encrypt(name) : null,
        name_hash: nameHash,
        creator: encrypt(creator),
        contribution_amount: contributionAmount,
        max_members: maxMembers,
        cycle_duration_blocks: cycleDurationBlocks,
        total_cycles: maxMembers,
        salt: salt,
        transaction_id: transactionId,
        status: status,
        current_cycle: 0,
        members_joined: 1,
      })

    if (circleError) throw circleError

    // Add creator as first member
    const { error: memberError } = await supabase
      .from('members')
      .insert({
        circle_id: circleId,
        member_address: encrypt(creator),
        join_order: 1,
        total_contributed: 0,
        has_received_payout: false,
        active: true,
        salt: salt,
      })

    if (memberError) throw memberError

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
        salt: salt,
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

// Start server
app.listen(PORT, () => {
  console.log(`ZkCircles backend running on port ${PORT}`)
})
