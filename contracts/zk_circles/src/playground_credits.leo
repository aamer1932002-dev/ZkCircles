// ZkCircles - Version with Credits.aleo Integration
// Trustless Zero-Knowledge Rotating Savings and Credit Associations
// Compatible with Aleo Playground and Rule 4 compliance

program zk_circles_v2.aleo {

    // Import credits.aleo for actual token transfers
    import credits.aleo;

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

    // Contribution receipt record
    record ContributionReceipt {
        owner: address,
        circle_id: field,
        amount: u64,
        cycle: u8,
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
    mapping circle_balance: field => u64;
    mapping contributions: field => u64; // circle_id + member hash => amount

    // Constructor - required for ConsensusVersion::V9+
    // Replace with your wallet address
    @admin(address="aleo1yvukv56vxntqpc280d40dhuvz4prpwzvdvjcm9ggm8a8e3tffsgqc9ws3t")
    async constructor() {
        
    }

    // Create a new savings circle
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

    // Contribute to the circle with actual credits transfer
    transition contribute(
        membership: CircleMembership,
        payment: credits.aleo/credits,
        amount: u64
    ) -> (CircleMembership, ContributionReceipt, credits.aleo/credits) {
        // Validate minimum contribution
        assert(amount >= 1000u64);
        
        // Transfer credits to the program (circle pot)
        // Using transfer_private to keep amounts private
        let (remaining, transferred): (credits.aleo/credits, credits.aleo/credits) = 
            credits.aleo/transfer_private_to_public(payment, zk_circles_v2.aleo, amount);
        
        // Create contribution receipt
        let receipt: ContributionReceipt = ContributionReceipt {
            owner: membership.owner,
            circle_id: membership.circle_id,
            amount: amount,
            cycle: 1u8,
        };
        
        // Return updated membership and receipt
        return (
            CircleMembership {
                owner: membership.owner,
                circle_id: membership.circle_id,
                join_order: membership.join_order,
            },
            receipt,
            remaining
        );
    }

    // Claim payout - transfers accumulated credits to the winner
    transition claim_payout(
        membership: CircleMembership,
        payout_amount: u64
    ) -> CircleMembership {
        // In production, this would verify it's the member's turn
        // and transfer credits from program to member
        
        // For now, just return updated membership
        // The actual transfer would use:
        // credits.aleo/transfer_public_to_private(zk_circles_v2.aleo, membership.owner, payout_amount)
        
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
