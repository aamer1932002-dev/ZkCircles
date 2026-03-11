// ZkCircles — privacy-preserving ROSCA (Rotating Savings & Credit Association) on Aleo.
// Member addresses are never stored in plain text; all mapping keys are BHP256 hashes.
// Contributions move real credits via transfer_public_as_signer so the signer's account
// is debited atomically within the same transaction that records the on-chain receipt.

import credits.aleo;

program zk_circles_v5.aleo {

    // circle status values
    // 0 = forming   (accepting members)
    // 1 = active    (contribution cycles running)
    // 2 = complete  (all cycles paid out)
    // 3 = cancelled (cancelled while forming)

    struct CircleInfo {
        contribution_amount: u64,
        max_members: u8,
        total_cycles: u8,
        current_cycle: u8,
        members_joined: u8,
        status: u8
    }

    // Used only as BHP256 hash inputs — never stored as-is
    struct MemberKey {
        circle_id: field,
        member_addr: address
    }

    struct ContribKey {
        circle_id: field,
        cycle: u8,
        member_addr: address
    }

    // Private records — encrypted for the owner's key only
    record CircleMembership {
        owner: address,
        circle_id: field,
        contribution_amount: u64
    }

    record ContributionReceipt {
        owner: address,
        circle_id: field,
        cycle: u8,
        amount: u64
    }

    record PayoutReceipt {
        owner: address,
        circle_id: field,
        cycle: u8
    }

    // circle_id  -> CircleInfo
    // hash(circle_id, address) -> join_order  (hashed so member identity stays private)
    // hash(circle_id, cycle, address) -> contributed
    mapping circles: field => CircleInfo;
    mapping members: field => u8;
    mapping contributions: field => bool;

    @noupgrade
    async constructor() {}

    // circle_id is derived off-chain (e.g. BHP256 of creator + name + salt)
    // so the name is never exposed on-chain.
    async transition create_circle(
        public circle_id: field,
        public contribution_amount: u64,
        public max_members: u8,
        public total_cycles: u8
    ) -> (CircleMembership, Future) {
        assert(contribution_amount >= 1u64);
        assert(max_members >= 2u8);
        assert(max_members <= 20u8);
        assert(total_cycles >= 2u8);

        let membership: CircleMembership = CircleMembership {
            owner: self.signer,
            circle_id: circle_id,
            contribution_amount: contribution_amount
        };

        return (membership, finalize_create_circle(circle_id, contribution_amount, max_members, total_cycles, self.signer));
    }

    async function finalize_create_circle(
        circle_id: field,
        contribution_amount: u64,
        max_members: u8,
        total_cycles: u8,
        creator: address
    ) {
        assert(!circles.contains(circle_id));

        circles.set(circle_id, CircleInfo {
            contribution_amount: contribution_amount,
            max_members: max_members,
            total_cycles: total_cycles,
            current_cycle: 0u8,
            members_joined: 1u8,
            status: 0u8
        });

        let key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: creator });
        members.set(key, 1u8);
    }

    async transition join_circle(
        public circle_id: field,
        public contribution_amount: u64
    ) -> (CircleMembership, Future) {
        let membership: CircleMembership = CircleMembership {
            owner: self.signer,
            circle_id: circle_id,
            contribution_amount: contribution_amount
        };
        return (membership, finalize_join_circle(circle_id, contribution_amount, self.signer));
    }

    async function finalize_join_circle(
        circle_id: field,
        contribution_amount: u64,
        joiner: address
    ) {
        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 0u8);
        assert_eq(contribution_amount, info.contribution_amount);
        assert(info.members_joined < info.max_members);

        let key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: joiner });
        assert(!members.contains(key));

        let new_count: u8 = info.members_joined + 1u8;
        let is_full: bool = new_count == info.max_members;

        members.set(key, new_count);
        circles.set(circle_id, CircleInfo {
            contribution_amount: info.contribution_amount,
            max_members: info.max_members,
            total_cycles: info.total_cycles,
            current_cycle: is_full ? 1u8 : 0u8,
            members_joined: new_count,
            status: is_full ? 1u8 : 0u8
        });
    }

    // Transfers credits from the signer's public account to the circle pot address
    // and records the contribution atomically. The Future from transfer_public_as_signer
    // is awaited first in finalize so the debit is settled before state updates.
    async transition contribute(
        membership: CircleMembership,
        public pot_address: address,
        public cycle: u8
    ) -> (CircleMembership, ContributionReceipt, Future) {
        let tf: Future = credits.aleo/transfer_public_as_signer(pot_address, membership.contribution_amount);

        let receipt: ContributionReceipt = ContributionReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle,
            amount: membership.contribution_amount
        };
        return (membership, receipt, finalize_contribute(tf, membership.circle_id, cycle, self.signer));
    }

    async function finalize_contribute(
        tf: Future,
        circle_id: field,
        cycle: u8,
        contributor: address
    ) {
        tf.await();

        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 1u8);
        assert_eq(info.current_cycle, cycle);

        let member_key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: contributor });
        assert(members.contains(member_key));

        let contrib_key: field = BHP256::hash_to_field(ContribKey { circle_id: circle_id, cycle: cycle, member_addr: contributor });
        assert(!contributions.get_or_use(contrib_key, false));
        contributions.set(contrib_key, true);
    }

    async transition claim_payout(
        membership: CircleMembership,
        public cycle: u8
    ) -> (PayoutReceipt, Future) {
        let receipt: PayoutReceipt = PayoutReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle
        };
        return (receipt, finalize_claim_payout(membership.circle_id, cycle, self.signer));
    }

    async function finalize_claim_payout(
        circle_id: field,
        cycle: u8,
        claimer: address
    ) {
        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 1u8);
        assert_eq(info.current_cycle, cycle);

        let key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: claimer });
        let join_order: u8 = members.get(key);
        assert_eq(join_order, cycle);

        let next_cycle: u8 = cycle + 1u8;
        let is_done: bool = next_cycle > info.total_cycles;

        circles.set(circle_id, CircleInfo {
            contribution_amount: info.contribution_amount,
            max_members: info.max_members,
            total_cycles: info.total_cycles,
            current_cycle: is_done ? cycle : next_cycle,
            members_joined: info.members_joined,
            status: is_done ? 2u8 : 1u8
        });
    }

    // Only the circle creator (join_order == 1) can cancel, and only while forming.
    async transition cancel_circle(public circle_id: field) -> Future {
        return finalize_cancel_circle(circle_id, self.signer);
    }

    async function finalize_cancel_circle(circle_id: field, caller: address) {
        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 0u8);

        let key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: caller });
        assert_eq(members.get(key), 1u8);

        circles.set(circle_id, CircleInfo {
            contribution_amount: info.contribution_amount,
            max_members: info.max_members,
            total_cycles: info.total_cycles,
            current_cycle: info.current_cycle,
            members_joined: info.members_joined,
            status: 3u8
        });
    }

    // Pure record transformation — no on-chain state changes.
    transition transfer_membership(
        membership: CircleMembership,
        public new_owner: address
    ) -> CircleMembership {
        return CircleMembership {
            owner: new_owner,
            circle_id: membership.circle_id,
            contribution_amount: membership.contribution_amount
        };
    }

    async transition verify_membership(public circle_id: field) -> Future {
        return finalize_verify_membership(circle_id, self.signer);
    }

    async function finalize_verify_membership(circle_id: field, member_addr: address) {
        let key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: member_addr });
        assert(members.contains(key));
    }
}
