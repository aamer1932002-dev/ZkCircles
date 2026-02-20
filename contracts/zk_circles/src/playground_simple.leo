// ZkCircles - Minimal Version for Aleo Playground
// Trustless Zero-Knowledge Rotating Savings and Credit Associations
// Works with Leo Playground syntax

program zk_circles_v1.aleo {

    // Circle data structure
    struct CircleConfig {
        contribution_amount: u64,
        max_members: u8,
        creator: address,
        status: u8
    }

    // Private membership record
    record CircleMembership {
        owner: address,
        circle_id: field,
        join_order: u8,
    }

    // Helper struct for hashing
    struct CircleIdInput {
        creator: address,
        name_hash: field,
        salt: field
    }

    // On-chain storage
    mapping circles: field => CircleConfig;
    mapping member_count: field => u8;

    // Constructor - required for ConsensusVersion::V9+
    // Replace "aleo1..." with your actual wallet address from Shield Wallet
    @admin(address="aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px")
    async constructor() {
        
    }

    // Create a new savings circle (transition only, no finalize)
    transition create_circle(
        name_hash: field,
        contribution_amount: u64,
        max_members: u8,
        salt: field
    ) -> CircleMembership {
        // Validate inputs
        assert(contribution_amount >= 1000u64);
        assert(max_members >= 2u8);
        assert(max_members <= 12u8);
        
        // Generate unique circle ID
        let circle_id: field = BHP256::hash_to_field(
            CircleIdInput {
                creator: self.caller,
                name_hash: name_hash,
                salt: salt
            }
        );
        
        // Create membership record for creator
        return CircleMembership {
            owner: self.caller,
            circle_id: circle_id,
            join_order: 1u8,
        };
    }

    // Join an existing circle
    transition join_circle(
        circle_id: field
    ) -> CircleMembership {
        return CircleMembership {
            owner: self.caller,
            circle_id: circle_id,
            join_order: 0u8,
        };
    }

    // Contribute to the circle (returns updated membership)
    transition contribute(
        membership: CircleMembership,
        amount: u64
    ) -> CircleMembership {
        // Validate minimum contribution
        assert(amount >= 1000u64);
        
        return CircleMembership {
            owner: membership.owner,
            circle_id: membership.circle_id,
            join_order: membership.join_order,
        };
    }

    // Transfer membership to another address
    transition transfer_membership(
        membership: CircleMembership,
        new_owner: address
    ) -> CircleMembership {
        assert_neq(membership.owner, new_owner);
        
        return CircleMembership {
            owner: new_owner,
            circle_id: membership.circle_id,
            join_order: membership.join_order,
        };
    }

    // Verify membership (private verification)
    transition verify_membership(
        membership: CircleMembership,
        expected_circle_id: field
    ) -> bool {
        return membership.circle_id == expected_circle_id;
    }
}
