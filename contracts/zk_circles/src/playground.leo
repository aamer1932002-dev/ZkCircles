// ZkCircles - Simplified Version for Aleo Playground
// Trustless Zero-Knowledge Rotating Savings and Credit Associations
// Compatible with Leo Playground (older Leo syntax)

program zk_circles_v1.aleo {

    // ==================== DATA STRUCTURES ====================
    
    // Circle configuration stored on-chain
    struct CircleConfig {
        contribution_amount: u64,     // Amount each member contributes per cycle
        max_members: u8,              // Maximum members allowed (2-12)
        cycle_duration_blocks: u32,   // Duration of each cycle in blocks
        total_cycles: u8,             // Total number of cycles
        creator: address,             // Circle creator's address
        status: u8                    // 0: Forming, 1: Active, 2: Completed, 3: Cancelled
    }
    
    // Circle state tracking
    struct CircleState {
        current_cycle: u8,            // Current cycle number
        members_joined: u8,           // Number of members who have joined
        start_block: u32,             // Block height when circle started
        last_payout_cycle: u8         // Last cycle that had a payout
    }
    
    // Member data for a specific circle
    struct MemberData {
        join_order: u8,               // Order in which member joined
        total_contributed: u64,       // Total amount contributed
        has_received_payout: bool,    // Whether member has received payout
        active: bool                  // Whether member is still active
    }
    
    // Private record representing membership in a circle
    record CircleMembership {
        owner: address,
        circle_id: field,
        join_order: u8,
        salt: field
    }
    
    // Helper structs for hashing
    struct CircleIdInput {
        creator: address,
        name_hash: field,
        salt: field
    }
    
    struct MemberKey {
        circle_id: field,
        member_hash: field
    }
    
    struct ContributionKey {
        circle_id: field,
        cycle: u8,
        member_hash: field
    }

    // ==================== MAPPINGS ====================
    
    mapping circles: field => CircleConfig;
    mapping circle_states: field => CircleState;
    mapping members: field => MemberData;
    mapping contributions: field => u64;
    mapping total_circles: u8 => u64;
    mapping circle_names: field => field;

    // ==================== TRANSITIONS ====================

    // Create a new savings circle
    transition create_circle(
        name_hash: field,
        contribution_amount: u64,
        max_members: u8,
        cycle_duration_blocks: u32,
        salt: field
    ) -> CircleMembership {
        // Validate inputs
        assert(contribution_amount >= 1000u64);
        assert(max_members >= 2u8);
        assert(max_members <= 12u8);
        assert(cycle_duration_blocks >= 100u32);
        
        // Generate unique circle ID
        let circle_id: field = BHP256::hash_to_field(
            CircleIdInput {
                creator: self.caller,
                name_hash: name_hash,
                salt: salt
            }
        );
        
        // Create membership record for creator
        let membership: CircleMembership = CircleMembership {
            owner: self.caller,
            circle_id: circle_id,
            join_order: 1u8,
            salt: salt
        };
        
        return membership;
    }
    
    finalize create_circle(
        circle_id: field,
        name_hash: field,
        contribution_amount: u64,
        max_members: u8,
        cycle_duration_blocks: u32,
        creator: address
    ) {
        // Ensure circle doesn't already exist
        assert(!Mapping::contains(circles, circle_id));
        
        // Store circle configuration
        Mapping::set(circles, circle_id, CircleConfig {
            contribution_amount: contribution_amount,
            max_members: max_members,
            cycle_duration_blocks: cycle_duration_blocks,
            total_cycles: max_members,
            creator: creator,
            status: 0u8
        });
        
        // Initialize circle state
        Mapping::set(circle_states, circle_id, CircleState {
            current_cycle: 0u8,
            members_joined: 1u8,
            start_block: 0u32,
            last_payout_cycle: 0u8
        });
        
        // Store creator as member
        let creator_hash: field = BHP256::hash_to_field(creator);
        let member_key: field = BHP256::hash_to_field(
            MemberKey { circle_id: circle_id, member_hash: creator_hash }
        );
        
        Mapping::set(members, member_key, MemberData {
            join_order: 1u8,
            total_contributed: 0u64,
            has_received_payout: false,
            active: true
        });
        
        // Map name to circle_id
        Mapping::set(circle_names, name_hash, circle_id);
        
        // Increment total circles counter
        let current_total: u64 = Mapping::get_or_use(total_circles, 0u8, 0u64);
        Mapping::set(total_circles, 0u8, current_total + 1u64);
    }

    // Join an existing circle
    transition join_circle(
        circle_id: field,
        salt: field
    ) -> CircleMembership {
        let membership: CircleMembership = CircleMembership {
            owner: self.caller,
            circle_id: circle_id,
            join_order: 0u8,
            salt: salt
        };
        
        return membership;
    }
    
    finalize join_circle(circle_id: field, joiner: address) {
        // Get circle config
        let config: CircleConfig = Mapping::get(circles, circle_id);
        
        // Ensure circle is in forming status
        assert_eq(config.status, 0u8);
        
        // Get current state
        let state: CircleState = Mapping::get(circle_states, circle_id);
        
        // Ensure not full
        assert(state.members_joined < config.max_members);
        
        // Check not already a member
        let joiner_hash: field = BHP256::hash_to_field(joiner);
        let member_key: field = BHP256::hash_to_field(
            MemberKey { circle_id: circle_id, member_hash: joiner_hash }
        );
        assert(!Mapping::contains(members, member_key));
        
        // Add member
        let new_join_order: u8 = state.members_joined + 1u8;
        Mapping::set(members, member_key, MemberData {
            join_order: new_join_order,
            total_contributed: 0u64,
            has_received_payout: false,
            active: true
        });
        
        // Update circle state
        let new_members_joined: u8 = state.members_joined + 1u8;
        let is_full: bool = new_members_joined == config.max_members;
        let new_status: u8 = is_full ? 1u8 : 0u8;
        
        Mapping::set(circle_states, circle_id, CircleState {
            current_cycle: is_full ? 1u8 : 0u8,
            members_joined: new_members_joined,
            start_block: is_full ? block.height : 0u32,
            last_payout_cycle: 0u8
        });
        
        // Update config status if full
        if (is_full) {
            Mapping::set(circles, circle_id, CircleConfig {
                contribution_amount: config.contribution_amount,
                max_members: config.max_members,
                cycle_duration_blocks: config.cycle_duration_blocks,
                total_cycles: config.total_cycles,
                creator: config.creator,
                status: 1u8
            });
        }
    }

    // Record a contribution (simplified - actual payment handled off-chain)
    transition contribute(
        membership: CircleMembership,
        amount: u64
    ) -> CircleMembership {
        // Return the same membership record
        let updated_membership: CircleMembership = CircleMembership {
            owner: membership.owner,
            circle_id: membership.circle_id,
            join_order: membership.join_order,
            salt: membership.salt
        };
        
        return updated_membership;
    }
    
    finalize contribute(
        circle_id: field,
        contributor: address,
        amount: u64
    ) {
        // Get circle config and state
        let config: CircleConfig = Mapping::get(circles, circle_id);
        let state: CircleState = Mapping::get(circle_states, circle_id);
        
        // Must be active
        assert_eq(config.status, 1u8);
        
        // Verify amount
        assert_eq(amount, config.contribution_amount);
        
        // Get member data
        let contributor_hash: field = BHP256::hash_to_field(contributor);
        let member_key: field = BHP256::hash_to_field(
            MemberKey { circle_id: circle_id, member_hash: contributor_hash }
        );
        let member: MemberData = Mapping::get(members, member_key);
        
        // Must be active member
        assert(member.active);
        
        // Check hasn't already contributed this cycle
        let contrib_key: field = BHP256::hash_to_field(
            ContributionKey {
                circle_id: circle_id,
                cycle: state.current_cycle,
                member_hash: contributor_hash
            }
        );
        assert(!Mapping::contains(contributions, contrib_key));
        
        // Record contribution
        Mapping::set(contributions, contrib_key, amount);
        
        // Update member total
        Mapping::set(members, member_key, MemberData {
            join_order: member.join_order,
            total_contributed: member.total_contributed + amount,
            has_received_payout: member.has_received_payout,
            active: member.active
        });
    }

    // Get circle info (view-only helper)
    transition get_circle_info(circle_id: field) {
        // No return value, just triggers finalize
    }
    
    finalize get_circle_info(circle_id: field) {
        // This just verifies the circle exists
        assert(Mapping::contains(circles, circle_id));
    }
}
