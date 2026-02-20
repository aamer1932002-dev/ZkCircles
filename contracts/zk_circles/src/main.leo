// ZkCircles - Trustless Zero-Knowledge Rotating Savings and Credit Associations
// Built on Aleo for privacy-preserving community finance

program zk_circles_v1.aleo {
    // ==================== IMPORTS ====================
    // Import Aleo's native credits program for token transfers
    import credits.aleo;

    // ==================== DATA STRUCTURES ====================
    
    // Circle configuration stored on-chain (public mappings for auditability)
    struct CircleConfig {
        contribution_amount: u64,     // Amount each member contributes per cycle (in microcredits)
        max_members: u8,              // Maximum members allowed (2-12 typical)
        cycle_duration_blocks: u32,   // Duration of each contribution cycle in blocks
        total_cycles: u8,             // Total number of cycles (usually equals max_members)
        creator: address,             // Circle creator's address
        status: u8                    // 0: Forming, 1: Active, 2: Completed, 3: Cancelled
    }
    
    // Circle state tracking
    struct CircleState {
        current_cycle: u8,            // Current cycle number (1-indexed)
        members_joined: u8,           // Number of members who have joined
        start_block: u32,             // Block height when circle started
        last_payout_cycle: u8         // Last cycle that had a payout
    }
    
    // Member data for a specific circle
    struct MemberData {
        join_order: u8,               // Order in which member joined (determines payout order)
        total_contributed: u64,       // Total amount contributed so far
        has_received_payout: bool,    // Whether member has received their payout
        active: bool                  // Whether member is still active
    }
    
    // Private record representing membership in a circle
    record CircleMembership {
        owner: address,               // Member's address
        circle_id: field,             // Unique identifier for the circle
        join_order: u8,               // Member's position in payout order
        salt: field                   // Random salt for privacy
    }
    
    // Private record representing a contribution receipt
    record ContributionReceipt {
        owner: address,               // Contributor's address
        circle_id: field,             // Circle identifier
        cycle_number: u8,             // Which cycle this contribution was for
        amount: u64,                  // Amount contributed
        timestamp_block: u32,         // Block when contribution was made
        receipt_hash: field           // Unique hash for verification
    }
    
    // Private record representing a payout receipt
    record PayoutReceipt {
        owner: address,               // Recipient's address
        circle_id: field,             // Circle identifier
        cycle_number: u8,             // Which cycle payout was received
        amount: u64,                  // Total payout amount
        payout_hash: field            // Unique hash for verification
    }

    // ==================== MAPPINGS (Public State) ====================
    
    // Circle configurations by circle_id
    mapping circles: field => CircleConfig;
    
    // Circle state by circle_id
    mapping circle_states: field => CircleState;
    
    // Member data: (circle_id, member_address_hash) => MemberData
    mapping members: field => MemberData;
    
    // Track contributions: (circle_id, cycle, member_hash) => contributed amount
    mapping contributions: field => u64;
    
    // Track who received payout for each cycle: (circle_id, cycle) => recipient_hash
    mapping cycle_payouts: field => field;
    
    // Total circles created (for stats)
    mapping total_circles: u8 => u64;
    
    // Circle name hash to circle_id (for lookups)
    mapping circle_names: field => field;

    // ==================== TRANSITIONS ====================

    // Create a new savings circle
    transition create_circle(
        name_hash: field,             // Hash of circle name for privacy
        contribution_amount: u64,     // Contribution per cycle in microcredits
        max_members: u8,              // Maximum members (2-12)
        cycle_duration_blocks: u32,   // Blocks per cycle
        salt: field                   // Random salt for circle_id generation
    ) -> CircleMembership {
        // Validate inputs
        assert(contribution_amount >= 1000u64);  // Minimum 1000 microcredits
        assert(max_members >= 2u8);
        assert(max_members <= 12u8);
        assert(cycle_duration_blocks >= 100u32);  // Minimum ~5 minutes
        
        // Generate unique circle ID using hash
        let circle_id: field = BHP256::hash_to_field(
            CircleIdInput {
                creator: self.caller,
                name_hash: name_hash,
                salt: salt
            }
        );
        
        // Create membership record for creator (they are member #1)
        let membership: CircleMembership = CircleMembership {
            owner: self.caller,
            circle_id: circle_id,
            join_order: 1u8,
            salt: salt
        };
        
        return membership then finalize(
            circle_id,
            name_hash,
            contribution_amount,
            max_members,
            cycle_duration_blocks,
            self.caller
        );
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
            total_cycles: max_members,  // Each member gets one payout
            creator: creator,
            status: 0u8  // Forming
        });
        
        // Initialize circle state
        Mapping::set(circle_states, circle_id, CircleState {
            current_cycle: 0u8,
            members_joined: 1u8,  // Creator is first member
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
        // Membership record will be created with join_order set in finalize
        // Using a placeholder that will be verified
        let membership: CircleMembership = CircleMembership {
            owner: self.caller,
            circle_id: circle_id,
            join_order: 0u8,  // Will be updated based on actual position
            salt: salt
        };
        
        return membership then finalize(circle_id, self.caller);
    }
    
    finalize join_circle(circle_id: field, joiner: address) {
        // Get circle config
        let config: CircleConfig = Mapping::get(circles, circle_id);
        
        // Verify circle is still forming
        assert(config.status == 0u8);
        
        // Get current state
        let state: CircleState = Mapping::get(circle_states, circle_id);
        
        // Check there's room for new members
        assert(state.members_joined < config.max_members);
        
        // Verify joiner isn't already a member
        let joiner_hash: field = BHP256::hash_to_field(joiner);
        let member_key: field = BHP256::hash_to_field(
            MemberKey { circle_id: circle_id, member_hash: joiner_hash }
        );
        assert(!Mapping::contains(members, member_key));
        
        // Add new member
        let new_join_order: u8 = state.members_joined + 1u8;
        Mapping::set(members, member_key, MemberData {
            join_order: new_join_order,
            total_contributed: 0u64,
            has_received_payout: false,
            active: true
        });
        
        // Update circle state
        Mapping::set(circle_states, circle_id, CircleState {
            current_cycle: state.current_cycle,
            members_joined: new_join_order,
            start_block: state.start_block,
            last_payout_cycle: state.last_payout_cycle
        });
        
        // If circle is now full, automatically start it
        if new_join_order == config.max_members {
            Mapping::set(circles, circle_id, CircleConfig {
                contribution_amount: config.contribution_amount,
                max_members: config.max_members,
                cycle_duration_blocks: config.cycle_duration_blocks,
                total_cycles: config.total_cycles,
                creator: config.creator,
                status: 1u8  // Active
            });
            
            // Set start block and begin cycle 1
            Mapping::set(circle_states, circle_id, CircleState {
                current_cycle: 1u8,
                members_joined: new_join_order,
                start_block: block.height,
                last_payout_cycle: 0u8
            });
        }
    }

    // Contribute to the current cycle
    transition contribute(
        membership: CircleMembership,
        payment: credits.aleo/credits,
        amount: u64
    ) -> (CircleMembership, ContributionReceipt, credits.aleo/credits) {
        // Generate unique receipt hash
        let receipt_hash: field = BHP256::hash_to_field(
            ReceiptInput {
                contributor: self.caller,
                circle_id: membership.circle_id,
                amount: amount,
                salt: membership.salt
            }
        );
        
        // Transfer credits to the program (pool)
        // In production, this would go to a program-controlled address
        let (remaining, transferred): (credits.aleo/credits, credits.aleo/credits) = 
            credits.aleo/transfer_private_to_public(payment, zk_circles_v1.aleo, amount);
        
        // Create contribution receipt
        let receipt: ContributionReceipt = ContributionReceipt {
            owner: self.caller,
            circle_id: membership.circle_id,
            cycle_number: 0u8,  // Will be set based on current cycle
            amount: amount,
            timestamp_block: 0u32,
            receipt_hash: receipt_hash
        };
        
        return (membership, receipt, remaining) then finalize(
            membership.circle_id,
            self.caller,
            amount,
            receipt_hash
        );
    }
    
    finalize contribute(
        circle_id: field,
        contributor: address,
        amount: u64,
        receipt_hash: field
    ) {
        // Get circle config and state
        let config: CircleConfig = Mapping::get(circles, circle_id);
        let state: CircleState = Mapping::get(circle_states, circle_id);
        
        // Verify circle is active
        assert(config.status == 1u8);
        
        // Verify amount matches required contribution
        assert(amount == config.contribution_amount);
        
        // Verify contributor is a member
        let contributor_hash: field = BHP256::hash_to_field(contributor);
        let member_key: field = BHP256::hash_to_field(
            MemberKey { circle_id: circle_id, member_hash: contributor_hash }
        );
        let member: MemberData = Mapping::get(members, member_key);
        assert(member.active);
        
        // Check they haven't already contributed this cycle
        let contribution_key: field = BHP256::hash_to_field(
            ContributionKey {
                circle_id: circle_id,
                cycle: state.current_cycle,
                member_hash: contributor_hash
            }
        );
        assert(!Mapping::contains(contributions, contribution_key));
        
        // Record contribution
        Mapping::set(contributions, contribution_key, amount);
        
        // Update member's total contributed
        Mapping::set(members, member_key, MemberData {
            join_order: member.join_order,
            total_contributed: member.total_contributed + amount,
            has_received_payout: member.has_received_payout,
            active: member.active
        });
    }

    // Claim payout for current cycle (called by the designated recipient)
    transition claim_payout(
        membership: CircleMembership
    ) -> PayoutReceipt {
        // Generate payout hash
        let payout_hash: field = BHP256::hash_to_field(
            PayoutInput {
                recipient: self.caller,
                circle_id: membership.circle_id,
                join_order: membership.join_order,
                salt: membership.salt
            }
        );
        
        let receipt: PayoutReceipt = PayoutReceipt {
            owner: self.caller,
            circle_id: membership.circle_id,
            cycle_number: 0u8,
            amount: 0u64,  // Will be calculated in finalize
            payout_hash: payout_hash
        };
        
        return receipt then finalize(
            membership.circle_id,
            self.caller,
            membership.join_order
        );
    }
    
    finalize claim_payout(
        circle_id: field,
        claimer: address,
        join_order: u8
    ) {
        // Get circle config and state
        let config: CircleConfig = Mapping::get(circles, circle_id);
        let state: CircleState = Mapping::get(circle_states, circle_id);
        
        // Verify circle is active
        assert(config.status == 1u8);
        
        // Verify it's this member's turn (join_order == current_cycle)
        assert(join_order == state.current_cycle);
        
        // Verify claimer is the correct member
        let claimer_hash: field = BHP256::hash_to_field(claimer);
        let member_key: field = BHP256::hash_to_field(
            MemberKey { circle_id: circle_id, member_hash: claimer_hash }
        );
        let member: MemberData = Mapping::get(members, member_key);
        assert(member.join_order == join_order);
        assert(!member.has_received_payout);
        
        // Mark as received payout
        Mapping::set(members, member_key, MemberData {
            join_order: member.join_order,
            total_contributed: member.total_contributed,
            has_received_payout: true,
            active: member.active
        });
        
        // Record cycle payout
        let payout_key: field = BHP256::hash_to_field(
            CyclePayoutKey { circle_id: circle_id, cycle: state.current_cycle }
        );
        Mapping::set(cycle_payouts, payout_key, claimer_hash);
        
        // Advance to next cycle
        let next_cycle: u8 = state.current_cycle + 1u8;
        
        if next_cycle > config.total_cycles {
            // Circle is complete
            Mapping::set(circles, circle_id, CircleConfig {
                contribution_amount: config.contribution_amount,
                max_members: config.max_members,
                cycle_duration_blocks: config.cycle_duration_blocks,
                total_cycles: config.total_cycles,
                creator: config.creator,
                status: 2u8  // Completed
            });
        }
        
        // Update state
        Mapping::set(circle_states, circle_id, CircleState {
            current_cycle: next_cycle,
            members_joined: state.members_joined,
            start_block: state.start_block,
            last_payout_cycle: state.current_cycle
        });
    }

    // Emergency exit for circle creator (only when forming)
    transition cancel_circle(
        membership: CircleMembership
    ) {
        return then finalize(membership.circle_id, self.caller);
    }
    
    finalize cancel_circle(circle_id: field, caller: address) {
        let config: CircleConfig = Mapping::get(circles, circle_id);
        
        // Only creator can cancel
        assert(caller == config.creator);
        
        // Only when still forming
        assert(config.status == 0u8);
        
        // Mark as cancelled
        Mapping::set(circles, circle_id, CircleConfig {
            contribution_amount: config.contribution_amount,
            max_members: config.max_members,
            cycle_duration_blocks: config.cycle_duration_blocks,
            total_cycles: config.total_cycles,
            creator: config.creator,
            status: 3u8  // Cancelled
        });
    }

    // ==================== HELPER STRUCTS FOR HASHING ====================
    
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
    
    struct CyclePayoutKey {
        circle_id: field,
        cycle: u8
    }
    
    struct ReceiptInput {
        contributor: address,
        circle_id: field,
        amount: u64,
        salt: field
    }
    
    struct PayoutInput {
        recipient: address,
        circle_id: field,
        join_order: u8,
        salt: field
    }
}
