// ZkCircles - Privacy-preserving ROSCA on Aleo
// Fund transfers happen off-chain; this contract provides
// ZK membership proofs, contribution receipts, and payout receipts.
// Member identity is hidden via hashed mapping keys (BHP256).
// Program: zk_circles_v4.aleo

program zk_circles_v4.aleo {

    // ==================== STRUCTS ====================

    // Single merged struct keeps finalize ops minimal
    struct CircleInfo {
        contribution_amount: u64,
        max_members:         u8,
        total_cycles:        u8,
        current_cycle:       u8,
        members_joined:      u8,
        status:              u8   // 0=forming 1=active 2=complete 3=cancelled
    }

    // Hashed key structs — member addresses are never stored in plain text
    struct MemberKey {
        circle_id:   field,
        member_addr: address
    }

    struct ContribKey {
        circle_id:   field,
        cycle:       u8,
        member_addr: address
    }

    // ==================== RECORDS (all private, encrypted for owner) ====================

    record CircleMembership {
        owner:               address,
        circle_id:           field,
        contribution_amount: u64
    }

    record ContributionReceipt {
        owner:     address,
        circle_id: field,
        cycle:     u8,
        amount:    u64
    }

    record PayoutReceipt {
        owner:     address,
        circle_id: field,
        cycle:     u8
    }

    // ==================== MAPPINGS ====================

    // circles:       circle_id           → CircleInfo  (public circle metadata)
    // members:       hash(circle+addr)   → join_order  (WHO is a member stays private via hashed key)
    // contributions: hash(circle+cycle+addr) → paid    (contribution status is private)
    mapping circles:       field => CircleInfo;
    mapping members:       field => u8;
    mapping contributions: field => bool;

    // ==================== CONSTRUCTOR ====================

    // Called automatically on deploy/upgrade.
    // @noupgrade prevents future program upgrades.
    @noupgrade
    async constructor() {}

    // ==================== TRANSITIONS ====================

    // Create a new savings circle.
    // circle_id is computed off-chain (e.g. BHP256 of creator+name+salt).
    async transition create_circle(
        public circle_id:           field,
        public contribution_amount: u64,
        public max_members:         u8,
        public total_cycles:        u8
    ) -> (CircleMembership, Future) {
        assert(contribution_amount >= 1u64);
        assert(max_members >= 2u8);
        assert(max_members <= 20u8);
        assert(total_cycles >= 2u8);

        let membership: CircleMembership = CircleMembership {
            owner:               self.signer,
            circle_id:           circle_id,
            contribution_amount: contribution_amount
        };

        return (membership, finalize_create_circle(circle_id, contribution_amount, max_members, total_cycles, self.signer));
    }

    async function finalize_create_circle(
        circle_id:           field,
        contribution_amount: u64,
        max_members:         u8,
        total_cycles:        u8,
        creator:             address
    ) {
        assert(!circles.contains(circle_id));

        circles.set(circle_id, CircleInfo {
            contribution_amount: contribution_amount,
            max_members:         max_members,
            total_cycles:        total_cycles,
            current_cycle:       0u8,
            members_joined:      1u8,
            status:              0u8
        });

        let member_key: field = BHP256::hash_to_field(MemberKey {
            circle_id:   circle_id,
            member_addr: creator
        });
        members.set(member_key, 1u8);
    }

    // Join a circle that is still forming (status = 0).
    async transition join_circle(
        public circle_id:           field,
        public contribution_amount: u64
    ) -> (CircleMembership, Future) {
        let membership: CircleMembership = CircleMembership {
            owner:               self.signer,
            circle_id:           circle_id,
            contribution_amount: contribution_amount
        };
        return (membership, finalize_join_circle(circle_id, contribution_amount, self.signer));
    }

    async function finalize_join_circle(
        circle_id:           field,
        contribution_amount: u64,
        joiner:              address
    ) {
        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 0u8);
        assert_eq(contribution_amount, info.contribution_amount);
        assert(info.members_joined < info.max_members);

        let member_key: field = BHP256::hash_to_field(MemberKey {
            circle_id:   circle_id,
            member_addr: joiner
        });
        assert(!members.contains(member_key));

        let new_count: u8 = info.members_joined + 1u8;
        let is_full:   bool = new_count == info.max_members;

        members.set(member_key, new_count);

        circles.set(circle_id, CircleInfo {
            contribution_amount: info.contribution_amount,
            max_members:         info.max_members,
            total_cycles:        info.total_cycles,
            current_cycle:       is_full ? 1u8 : 0u8,
            members_joined:      new_count,
            status:              is_full ? 1u8 : 0u8
        });
    }

    // Record that a member has contributed for the current cycle.
    // Actual fund transfer happens off-chain to the circle's pot address.
    // Returns the membership record (so it can be reused) + a private receipt.
    async transition record_contribution(
        membership: CircleMembership,
        public cycle: u8
    ) -> (CircleMembership, ContributionReceipt, Future) {
        let receipt: ContributionReceipt = ContributionReceipt {
            owner:     self.signer,
            circle_id: membership.circle_id,
            cycle:     cycle,
            amount:    membership.contribution_amount
        };
        return (membership, receipt, finalize_record_contribution(membership.circle_id, cycle, self.signer));
    }

    async function finalize_record_contribution(
        circle_id:   field,
        cycle:       u8,
        contributor: address
    ) {
        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 1u8);
        assert_eq(info.current_cycle, cycle);

        let member_key: field = BHP256::hash_to_field(MemberKey {
            circle_id:   circle_id,
            member_addr: contributor
        });
        assert(members.contains(member_key));

        let contrib_key: field = BHP256::hash_to_field(ContribKey {
            circle_id:   circle_id,
            cycle:       cycle,
            member_addr: contributor
        });
        assert(!contributions.get_or_use(contrib_key, false));
        contributions.set(contrib_key, true);
    }

    // Claim payout when it's your turn (your join_order must equal current_cycle).
    async transition claim_payout(
        membership: CircleMembership,
        public cycle: u8
    ) -> (PayoutReceipt, Future) {
        let receipt: PayoutReceipt = PayoutReceipt {
            owner:     self.signer,
            circle_id: membership.circle_id,
            cycle:     cycle
        };
        return (receipt, finalize_claim_payout(membership.circle_id, cycle, self.signer));
    }

    async function finalize_claim_payout(
        circle_id: field,
        cycle:     u8,
        claimer:   address
    ) {
        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 1u8);
        assert_eq(info.current_cycle, cycle);

        let member_key: field = BHP256::hash_to_field(MemberKey {
            circle_id:   circle_id,
            member_addr: claimer
        });
        let join_order: u8 = members.get(member_key);
        assert_eq(join_order, cycle);

        let next_cycle: u8 = cycle + 1u8;
        let is_done:   bool = next_cycle > info.total_cycles;

        circles.set(circle_id, CircleInfo {
            contribution_amount: info.contribution_amount,
            max_members:         info.max_members,
            total_cycles:        info.total_cycles,
            current_cycle:       is_done ? cycle : next_cycle,
            members_joined:      info.members_joined,
            status:              is_done ? 2u8 : 1u8
        });
    }

    // Cancel a circle while it is still forming (creator only).
    async transition cancel_circle(public circle_id: field) -> Future {
        return finalize_cancel_circle(circle_id, self.signer);
    }

    async function finalize_cancel_circle(circle_id: field, caller: address) {
        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 0u8);
        // Creator is the member with join_order == 1
        let member_key: field = BHP256::hash_to_field(MemberKey {
            circle_id:   circle_id,
            member_addr: caller
        });
        let join_order: u8 = members.get(member_key);
        assert_eq(join_order, 1u8);

        circles.set(circle_id, CircleInfo {
            contribution_amount: info.contribution_amount,
            max_members:         info.max_members,
            total_cycles:        info.total_cycles,
            current_cycle:       info.current_cycle,
            members_joined:      info.members_joined,
            status:              3u8
        });
    }

    // Transfer membership to another address — pure private record transformation,
    // no on-chain state change needed.
    transition transfer_membership(
        membership:       CircleMembership,
        public new_owner: address
    ) -> CircleMembership {
        return CircleMembership {
            owner:               new_owner,
            circle_id:           membership.circle_id,
            contribution_amount: membership.contribution_amount
        };
    }

    // Prove on-chain that self.signer is a registered member.
    async transition verify_membership(public circle_id: field) -> Future {
        return finalize_verify_membership(circle_id, self.signer);
    }

    async function finalize_verify_membership(circle_id: field, member_addr: address) {
        let member_key: field = BHP256::hash_to_field(MemberKey {
            circle_id:   circle_id,
            member_addr: member_addr
        });
        assert(members.contains(member_key));
    }
}
