// ZkCircles — privacy-preserving ROSCA (Rotating Savings & Credit Association) on Aleo.
// Member addresses are never stored in plain text; all mapping keys are BHP256 hashes.
// Contributions move real credits via transfer_public_as_signer to the PROGRAM'S OWN
// address so claim_payout can call transfer_public back to the winner atomically.
//
// v7 additions:
//   - defaults mapping          — tracks how many cycles each member has missed
//   - default_flags mapping     — prevents double-flagging the same defaulter/cycle
//   - flag_missed_contribution  — any member can flag a past-cycle non-contributor
//
// v8 additions:
//   - token_id: field in CircleInfo  (0field = Aleo credits; non-zero = stablecoin)
//   - contribute_token / claim_payout_token via token_registry.aleo
// v9 additions:
//   - Replaced token_registry.aleo with direct imports:
//       test_usdcx_stablecoin.aleo (token_id = 1field)
//       test_usad_stablecoin.aleo  (token_id = 2field)
//   - contribute_usdcx / claim_payout_usdcx
//   - contribute_usad  / claim_payout_usad

import credits.aleo;
import test_usdcx_stablecoin.aleo;
import test_usad_stablecoin.aleo;

program zk_circles_v9.aleo {

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
        status: u8,
        token_id: field  // 0field = credits.aleo; non-zero = ARC-20 token_id
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

    // Used to key the defaults and default_flags mappings
    struct DefaultKey {
        circle_id: field,
        defaulter: address,
        cycle: u8
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
    // hash(circle_id, defaulter) -> total missed-cycle count for that member
    mapping defaults: field => u8;
    // hash(circle_id, defaulter, cycle) -> true once flagged (prevents duplicate flags)
    mapping default_flags: field => bool;

    @noupgrade
    async constructor() {}

    // circle_id is derived off-chain (e.g. BHP256 of creator + name + salt)
    // so the name is never exposed on-chain.
    async transition create_circle(
        public circle_id: field,
        public contribution_amount: u64,
        public max_members: u8,
        public total_cycles: u8,
        public token_id: field      // 0field = Aleo credits; non-zero = ARC-20 token ID
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

        return (membership, finalize_create_circle(circle_id, contribution_amount, max_members, total_cycles, self.signer, token_id));
    }

    async function finalize_create_circle(
        circle_id: field,
        contribution_amount: u64,
        max_members: u8,
        total_cycles: u8,
        creator: address,
        token_id: field
    ) {
        assert(!circles.contains(circle_id));

        circles.set(circle_id, CircleInfo {
            contribution_amount: contribution_amount,
            max_members: max_members,
            total_cycles: total_cycles,
            current_cycle: 0u8,
            members_joined: 1u8,
            status: 0u8,
            token_id: token_id
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
            status: is_full ? 1u8 : 0u8,
            token_id: info.token_id
        });
    }

    // Transfers credits from the signer's public account to THIS PROGRAM's address
    // (self.address) so the program can later pay the winner via transfer_public.
    async transition contribute(
        membership: CircleMembership,
        public cycle: u8
    ) -> (CircleMembership, ContributionReceipt, Future) {
        let tf: Future = credits.aleo/transfer_public_as_signer(self.address, membership.contribution_amount);

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
        assert_eq(info.token_id, 0field);     // credits circles only — use contribute_token for ARC-20

        let member_key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: contributor });
        assert(members.contains(member_key));

        let contrib_key: field = BHP256::hash_to_field(ContribKey { circle_id: circle_id, cycle: cycle, member_addr: contributor });
        assert(!contributions.get_or_use(contrib_key, false));
        contributions.set(contrib_key, true);
    }

    // Pays out the winner for this cycle by transferring
    // contribution_amount * max_members credits from the program's own account
    // to the claimer's public balance.
    // payout_amount is passed as a public input and verified in finalize against
    // the on-chain circle info so it cannot be spoofed.
    async transition claim_payout(
        membership: CircleMembership,
        public cycle: u8,
        public payout_amount: u64
    ) -> (PayoutReceipt, Future) {
        // Program sends payout from its own public balance to the winner
        let tf: Future = credits.aleo/transfer_public(self.signer, payout_amount);

        let receipt: PayoutReceipt = PayoutReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle
        };
        return (receipt, finalize_claim_payout(tf, membership.circle_id, cycle, self.signer, payout_amount));
    }

    async function finalize_claim_payout(
        tf: Future,
        circle_id: field,
        cycle: u8,
        claimer: address,
        payout_amount: u64
    ) {
        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 1u8);
        assert_eq(info.current_cycle, cycle);
        assert_eq(info.token_id, 0field);     // credits circles only — use claim_payout_token for ARC-20

        // Verify payout matches exactly: every member contributed once per cycle
        let expected: u64 = info.contribution_amount * (info.max_members as u64);
        assert_eq(payout_amount, expected);

        let key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: claimer });
        let join_order: u8 = members.get(key);
        assert_eq(join_order, cycle);

        tf.await();

        let next_cycle: u8 = cycle + 1u8;
        let is_done: bool = next_cycle > info.total_cycles;

        circles.set(circle_id, CircleInfo {
            contribution_amount: info.contribution_amount,
            max_members: info.max_members,
            total_cycles: info.total_cycles,
            current_cycle: is_done ? cycle : next_cycle,
            members_joined: info.members_joined,
            status: is_done ? 2u8 : 1u8,
            token_id: info.token_id
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
            status: 3u8,
            token_id: info.token_id
        });
    }

    // Pure record transformation plus mapping update.
    // Signer must be the current record owner (enforced by Aleo record ownership).
    // The mapping entry is re-keyed from old_owner → new_owner so the new holder
    // can contribute, claim and verify without restriction.
    async transition transfer_membership(
        membership: CircleMembership,
        public new_owner: address
    ) -> (CircleMembership, Future) {
        let new_membership: CircleMembership = CircleMembership {
            owner: new_owner,
            circle_id: membership.circle_id,
            contribution_amount: membership.contribution_amount
        };
        return (new_membership, finalize_transfer_membership(membership.circle_id, self.signer, new_owner));
    }

    async function finalize_transfer_membership(
        circle_id: field,
        old_owner: address,
        new_owner: address
    ) {
        // Retrieve and remove the old key — asserts old_owner is a member
        let old_key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: old_owner });
        let join_order: u8 = members.get(old_key);
        members.remove(old_key);

        // New owner must not already be a member of this circle
        let new_key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: new_owner });
        assert(!members.contains(new_key));
        members.set(new_key, join_order);
    }

    async transition verify_membership(public circle_id: field) -> Future {
        return finalize_verify_membership(circle_id, self.signer);
    }

    async function finalize_verify_membership(circle_id: field, member_addr: address) {
        let key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: member_addr });
        assert(members.contains(key));
    }

    // ── USDCx contributions (test_usdcx_stablecoin.aleo, token_id = 1field) ──────
    // Transfers USDCx from the signer's public balance to THIS PROGRAM'S address.
    async transition contribute_usdcx(
        membership: CircleMembership,
        public cycle: u8
    ) -> (CircleMembership, ContributionReceipt, Future) {
        let tf: Future = test_usdcx_stablecoin.aleo/transfer_public_as_signer(self.address, membership.contribution_amount as u128);

        let receipt: ContributionReceipt = ContributionReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle,
            amount: membership.contribution_amount
        };
        return (membership, receipt, finalize_contribute_usdcx(tf, membership.circle_id, cycle, self.signer));
    }

    async function finalize_contribute_usdcx(
        tf: Future,
        circle_id: field,
        cycle: u8,
        contributor: address
    ) {
        tf.await();

        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 1u8);
        assert_eq(info.current_cycle, cycle);
        assert_eq(info.token_id, 1field);       // USDCx circles only

        let member_key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: contributor });
        assert(members.contains(member_key));

        let contrib_key: field = BHP256::hash_to_field(ContribKey { circle_id: circle_id, cycle: cycle, member_addr: contributor });
        assert(!contributions.get_or_use(contrib_key, false));
        contributions.set(contrib_key, true);
    }

    // Pays out the USDCx winner for this cycle from THIS PROGRAM'S USDCx balance.
    async transition claim_payout_usdcx(
        membership: CircleMembership,
        public cycle: u8,
        public payout_amount: u64
    ) -> (PayoutReceipt, Future) {
        let tf: Future = test_usdcx_stablecoin.aleo/transfer_public(self.signer, payout_amount as u128);

        let receipt: PayoutReceipt = PayoutReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle
        };
        return (receipt, finalize_claim_payout_usdcx(tf, membership.circle_id, cycle, self.signer, payout_amount));
    }

    async function finalize_claim_payout_usdcx(
        tf: Future,
        circle_id: field,
        cycle: u8,
        claimer: address,
        payout_amount: u64
    ) {
        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 1u8);
        assert_eq(info.current_cycle, cycle);
        assert_eq(info.token_id, 1field);         // USDCx circles only

        let expected: u64 = info.contribution_amount * (info.max_members as u64);
        assert_eq(payout_amount, expected);

        let key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: claimer });
        let join_order: u8 = members.get(key);
        assert_eq(join_order, cycle);

        tf.await();

        let next_cycle: u8 = cycle + 1u8;
        let is_done: bool = next_cycle > info.total_cycles;

        circles.set(circle_id, CircleInfo {
            contribution_amount: info.contribution_amount,
            max_members: info.max_members,
            total_cycles: info.total_cycles,
            current_cycle: is_done ? cycle : next_cycle,
            members_joined: info.members_joined,
            status: is_done ? 2u8 : 1u8,
            token_id: info.token_id
        });
    }

    // ── USAD contributions (test_usad_stablecoin.aleo, token_id = 2field) ───────
    // Transfers USAD from the signer's public balance to THIS PROGRAM'S address.
    async transition contribute_usad(
        membership: CircleMembership,
        public cycle: u8
    ) -> (CircleMembership, ContributionReceipt, Future) {
        let tf: Future = test_usad_stablecoin.aleo/transfer_public_as_signer(self.address, membership.contribution_amount as u128);

        let receipt: ContributionReceipt = ContributionReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle,
            amount: membership.contribution_amount
        };
        return (membership, receipt, finalize_contribute_usad(tf, membership.circle_id, cycle, self.signer));
    }

    async function finalize_contribute_usad(
        tf: Future,
        circle_id: field,
        cycle: u8,
        contributor: address
    ) {
        tf.await();

        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 1u8);
        assert_eq(info.current_cycle, cycle);
        assert_eq(info.token_id, 2field);       // USAD circles only

        let member_key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: contributor });
        assert(members.contains(member_key));

        let contrib_key: field = BHP256::hash_to_field(ContribKey { circle_id: circle_id, cycle: cycle, member_addr: contributor });
        assert(!contributions.get_or_use(contrib_key, false));
        contributions.set(contrib_key, true);
    }

    // Pays out the USAD winner for this cycle from THIS PROGRAM'S USAD balance.
    async transition claim_payout_usad(
        membership: CircleMembership,
        public cycle: u8,
        public payout_amount: u64
    ) -> (PayoutReceipt, Future) {
        let tf: Future = test_usad_stablecoin.aleo/transfer_public(self.signer, payout_amount as u128);

        let receipt: PayoutReceipt = PayoutReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle
        };
        return (receipt, finalize_claim_payout_usad(tf, membership.circle_id, cycle, self.signer, payout_amount));
    }

    async function finalize_claim_payout_usad(
        tf: Future,
        circle_id: field,
        cycle: u8,
        claimer: address,
        payout_amount: u64
    ) {
        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 1u8);
        assert_eq(info.current_cycle, cycle);
        assert_eq(info.token_id, 2field);         // USAD circles only

        let expected: u64 = info.contribution_amount * (info.max_members as u64);
        assert_eq(payout_amount, expected);

        let key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: claimer });
        let join_order: u8 = members.get(key);
        assert_eq(join_order, cycle);

        tf.await();

        let next_cycle: u8 = cycle + 1u8;
        let is_done: bool = next_cycle > info.total_cycles;

        circles.set(circle_id, CircleInfo {
            contribution_amount: info.contribution_amount,
            max_members: info.max_members,
            total_cycles: info.total_cycles,
            current_cycle: is_done ? cycle : next_cycle,
            members_joined: info.members_joined,
            status: is_done ? 2u8 : 1u8,
            token_id: info.token_id
        });
    }

    // Any member can flag another member who failed to contribute in a completed cycle.
    // Caller proves their own membership by passing their CircleMembership record.
    // The flagged cycle must have already passed (current_cycle > cycle).
    // Each (defaulter, cycle) pair can only be flagged once.
    // Cumulative default count for the defaulter is incremented in the defaults mapping.
    async transition flag_missed_contribution(
        membership: CircleMembership,
        public defaulter: address,
        public cycle: u8
    ) -> (CircleMembership, Future) {
        assert_neq(self.signer, defaulter);
        return (membership, finalize_flag_missed(membership.circle_id, defaulter, cycle, self.signer));
    }

    async function finalize_flag_missed(
        circle_id: field,
        defaulter: address,
        cycle: u8,
        reporter: address
    ) {
        let info: CircleInfo = circles.get(circle_id);
        assert_eq(info.status, 1u8);

        // The cycle must already be in the past
        assert(info.current_cycle > cycle);

        // Reporter must be an active member
        let reporter_key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: reporter });
        assert(members.contains(reporter_key));

        // Defaulter must be (or have been) a member
        let defaulter_key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: defaulter });
        assert(members.contains(defaulter_key));

        // Verify the defaulter genuinely did NOT contribute that cycle
        let contrib_key: field = BHP256::hash_to_field(ContribKey { circle_id: circle_id, cycle: cycle, member_addr: defaulter });
        assert(!contributions.get_or_use(contrib_key, false));

        // Prevent duplicate flags for the same (defaulter, cycle) pair
        let flag_key: field = BHP256::hash_to_field(DefaultKey { circle_id: circle_id, defaulter: defaulter, cycle: cycle });
        assert(!default_flags.get_or_use(flag_key, false));
        default_flags.set(flag_key, true);

        // Increment the cumulative default count for this member
        let member_default_key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: defaulter });
        let count: u8 = defaults.get_or_use(member_default_key, 0u8);
        defaults.set(member_default_key, count + 1u8);
    }
}
