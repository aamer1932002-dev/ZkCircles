// ZkCircles - Async Version for Aleo Playground (Leo 2.x syntax)
// Trustless Zero-Knowledge Rotating Savings and Credit Associations

program zk_circles_v2.aleo {

    // Circle configuration
    struct CircleConfig {
        contribution_amount: u64,
        max_members: u8,
        creator: address,
        status: u8
    }

    // Circle state
    struct CircleState {
        members_joined: u8,
        current_cycle: u8,
        total_contributed: u64
    }

    // Private membership record
    record CircleMembership {
        owner: address,
        circle_id: field,
        join_order: u8,
    }

    // Helper for hashing
    struct CircleIdInput {
        creator: address,
        name_hash: field,
        salt: field
    }

    struct MemberKey {
        circle_id: field,
        member: address
    }

    // Mappings
    mapping circles: field => CircleConfig;
    mapping circle_states: field => CircleState;
    mapping is_member: field => bool;

    // Constructor - required for ConsensusVersion::V9+
    // Replace "aleo1..." with your actual wallet address from Shield Wallet
    @admin(address="aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px")
    async constructor() {
        
    }

    // Create a new circle with async finalize
    async transition create_circle(
        name_hash: field,
        contribution_amount: u64,
        max_members: u8,
        salt: field
    ) -> (CircleMembership, Future) {
        // Validate inputs
        assert(contribution_amount >= 1000u64);
        assert(max_members >= 2u8);
        assert(max_members <= 12u8);
        
        // Generate circle ID
        let circle_id: field = BHP256::hash_to_field(
            CircleIdInput {
                creator: self.caller,
                name_hash: name_hash,
                salt: salt
            }
        );
        
        let membership: CircleMembership = CircleMembership {
            owner: self.caller,
            circle_id: circle_id,
            join_order: 1u8,
        };
        
        let f: Future = finalize_create_circle(
            circle_id,
            contribution_amount,
            max_members,
            self.caller
        );
        
        return (membership, f);
    }

    async function finalize_create_circle(
        circle_id: field,
        contribution_amount: u64,
        max_members: u8,
        creator: address
    ) {
        // Ensure circle doesn't exist
        let exists: bool = Mapping::contains(circles, circle_id);
        assert(!exists);
        
        // Store circle config
        Mapping::set(circles, circle_id, CircleConfig {
            contribution_amount: contribution_amount,
            max_members: max_members,
            creator: creator,
            status: 0u8
        });
        
        // Initialize state
        Mapping::set(circle_states, circle_id, CircleState {
            members_joined: 1u8,
            current_cycle: 0u8,
            total_contributed: 0u64
        });
        
        // Mark creator as member
        let member_key: field = BHP256::hash_to_field(
            MemberKey { circle_id: circle_id, member: creator }
        );
        Mapping::set(is_member, member_key, true);
    }

    // Join a circle
    async transition join_circle(
        circle_id: field
    ) -> (CircleMembership, Future) {
        let membership: CircleMembership = CircleMembership {
            owner: self.caller,
            circle_id: circle_id,
            join_order: 0u8,
        };
        
        let f: Future = finalize_join_circle(circle_id, self.caller);
        
        return (membership, f);
    }

    async function finalize_join_circle(
        circle_id: field,
        joiner: address
    ) {
        // Get circle config
        let config: CircleConfig = Mapping::get(circles, circle_id);
        assert_eq(config.status, 0u8);
        
        // Get state
        let state: CircleState = Mapping::get(circle_states, circle_id);
        assert(state.members_joined < config.max_members);
        
        // Check not already member
        let member_key: field = BHP256::hash_to_field(
            MemberKey { circle_id: circle_id, member: joiner }
        );
        let already_member: bool = Mapping::contains(is_member, member_key);
        assert(!already_member);
        
        // Add member
        Mapping::set(is_member, member_key, true);
        
        // Update state
        let new_count: u8 = state.members_joined + 1u8;
        Mapping::set(circle_states, circle_id, CircleState {
            members_joined: new_count,
            current_cycle: state.current_cycle,
            total_contributed: state.total_contributed
        });
        
        // If full, activate circle
        if (new_count == config.max_members) {
            Mapping::set(circles, circle_id, CircleConfig {
                contribution_amount: config.contribution_amount,
                max_members: config.max_members,
                creator: config.creator,
                status: 1u8
            });
        }
    }

    // Contribute to the circle
    async transition contribute(
        membership: CircleMembership,
        amount: u64
    ) -> (CircleMembership, Future) {
        let updated: CircleMembership = CircleMembership {
            owner: membership.owner,
            circle_id: membership.circle_id,
            join_order: membership.join_order,
        };
        
        let f: Future = finalize_contribute(
            membership.circle_id,
            self.caller,
            amount
        );
        
        return (updated, f);
    }

    async function finalize_contribute(
        circle_id: field,
        contributor: address,
        amount: u64
    ) {
        // Get config
        let config: CircleConfig = Mapping::get(circles, circle_id);
        assert_eq(config.status, 1u8);
        assert_eq(amount, config.contribution_amount);
        
        // Verify membership
        let member_key: field = BHP256::hash_to_field(
            MemberKey { circle_id: circle_id, member: contributor }
        );
        let is_a_member: bool = Mapping::get(is_member, member_key);
        assert(is_a_member);
        
        // Update total contributed
        let state: CircleState = Mapping::get(circle_states, circle_id);
        Mapping::set(circle_states, circle_id, CircleState {
            members_joined: state.members_joined,
            current_cycle: state.current_cycle,
            total_contributed: state.total_contributed + amount
        });
    }
}
