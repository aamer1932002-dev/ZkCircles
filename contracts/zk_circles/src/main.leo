// ZkCircles - privacy-preserving ROSCA (Rotating Savings & Credit Association) on Aleo.
// Leo 4.0 syntax port (v13).
//
// Member addresses are never stored in plain text; all mapping keys are BHP256 hashes.
// Contributions move real credits via transfer_public_as_signer to the PROGRAM'S OWN
// address so claim_payout can call transfer_public back to the winner atomically.
//
// Supports native ALEO credits (token_id = 0field),
// USDCx via test_usdcx_stablecoin.aleo (token_id = 1field),
// and USAD via test_usad_stablecoin.aleo (token_id = 2field).
//
// Includes: on-chain dispute resolution, zkEmail identity verification,
// flag_missed_contribution, cycle_count-based payout eligibility.

import credits.aleo;
import test_usdcx_stablecoin.aleo;
import test_usad_stablecoin.aleo;

program zk_circles_v13.aleo {

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
        token_id: field
    }

    struct MemberKey {
        circle_id: field,
        member_addr: address
    }

    struct ContribKey {
        circle_id: field,
        cycle: u8,
        member_addr: address
    }

    struct DefaultKey {
        circle_id: field,
        defaulter: address,
        cycle: u8
    }

    struct CycleKey {
        circle_id: field,
        cycle: u8
    }

    struct DisputeInfo {
        circle_id: field,
        accused: address,
        reason: u8,
        votes_for: u8,
        votes_against: u8,
        status: u8,
        created_cycle: u8
    }

    struct DisputeKey {
        circle_id: field,
        accused: address,
        cycle: u8
    }

    struct DisputeVoteKey {
        dispute_id: field,
        voter: address
    }

    record DisputeReceipt {
        owner: address,
        circle_id: field,
        dispute_id: field,
        accused: address
    }

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

    mapping circles: field => CircleInfo;
    mapping members: field => u8;
    mapping contributions: field => bool;
    mapping defaults: field => u8;
    mapping default_flags: field => bool;
    mapping cycle_count: field => u8;
    mapping disputes: field => DisputeInfo;
    mapping dispute_votes: field => bool;
    mapping email_commitments: field => field;
    mapping email_verified: field => bool;

    @noupgrade
    constructor() {}

    // ======================================================================
    // -- CORE ROSCA TRANSITIONS --------------------------------------------
    // ======================================================================

    fn create_circle(
        public circle_id: field,
        public contribution_amount: u64,
        public max_members: u8,
        public total_cycles: u8,
        public token_id: field
    ) -> (CircleMembership, Final) {
        assert(contribution_amount >= 1u64);
        assert(max_members >= 2u8);
        assert(max_members <= 20u8);
        assert(total_cycles >= 2u8);

        let membership: CircleMembership = CircleMembership {
            owner: self.signer,
            circle_id: circle_id,
            contribution_amount: contribution_amount
        };

        let creator: address = self.signer;

        return (membership, final {
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
        });
    }

    fn join_circle(
        public circle_id: field,
        public contribution_amount: u64
    ) -> (CircleMembership, Final) {
        let membership: CircleMembership = CircleMembership {
            owner: self.signer,
            circle_id: circle_id,
            contribution_amount: contribution_amount
        };

        let joiner: address = self.signer;

        return (membership, final {
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
        });
    }

    // -- ALEO credits contribute / claim -----------------------------------

    fn contribute(
        membership: CircleMembership,
        public cycle: u8
    ) -> (CircleMembership, ContributionReceipt, Final) {
        let tf: Final = credits.aleo::transfer_public_as_signer(self.address, membership.contribution_amount);

        let receipt: ContributionReceipt = ContributionReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle,
            amount: membership.contribution_amount
        };

        let contributor: address = self.signer;
        let cid: field = membership.circle_id;

        return (membership, receipt, final {
            tf.run();

            let info: CircleInfo = circles.get(cid);
            assert_eq(info.status, 1u8);
            assert_eq(info.current_cycle, cycle);
            assert_eq(info.token_id, 0field);

            let member_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: contributor });
            assert(members.contains(member_key));

            let contrib_key: field = BHP256::hash_to_field(ContribKey { circle_id: cid, cycle: cycle, member_addr: contributor });
            assert(!contributions.get_or_use(contrib_key, false));
            contributions.set(contrib_key, true);

            let ck: field = BHP256::hash_to_field(CycleKey { circle_id: cid, cycle: cycle });
            let cc: u8 = cycle_count.get_or_use(ck, 0u8);
            cycle_count.set(ck, cc + 1u8);
        });
    }

    fn claim_payout(
        membership: CircleMembership,
        public cycle: u8,
        public payout_amount: u64
    ) -> (PayoutReceipt, Final) {
        let tf: Final = credits.aleo::transfer_public(self.signer, payout_amount);

        let receipt: PayoutReceipt = PayoutReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle
        };

        let claimer: address = self.signer;
        let cid: field = membership.circle_id;

        return (receipt, final {
            let info: CircleInfo = circles.get(cid);
            assert_eq(info.status, 1u8);
            assert_eq(info.current_cycle, cycle);
            assert_eq(info.token_id, 0field);

            let ck: field = BHP256::hash_to_field(CycleKey { circle_id: cid, cycle: cycle });
            assert_eq(cycle_count.get(ck), info.max_members);

            let expected: u64 = info.contribution_amount * (info.max_members as u64);
            assert_eq(payout_amount, expected);

            let key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: claimer });
            let join_order: u8 = members.get(key);
            assert_eq(join_order, cycle);

            tf.run();

            let next_cycle: u8 = cycle + 1u8;
            let is_done: bool = next_cycle > info.total_cycles;

            circles.set(cid, CircleInfo {
                contribution_amount: info.contribution_amount,
                max_members: info.max_members,
                total_cycles: info.total_cycles,
                current_cycle: is_done ? cycle : next_cycle,
                members_joined: info.members_joined,
                status: is_done ? 2u8 : 1u8,
                token_id: info.token_id
            });
        });
    }

    // -- Circle management -------------------------------------------------

    fn cancel_circle(public circle_id: field) -> Final {
        let caller: address = self.signer;

        return final {
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
        };
    }

    fn transfer_membership(
        membership: CircleMembership,
        public new_owner: address
    ) -> (CircleMembership, Final) {
        let new_membership: CircleMembership = CircleMembership {
            owner: new_owner,
            circle_id: membership.circle_id,
            contribution_amount: membership.contribution_amount
        };

        let old_owner: address = self.signer;
        let cid: field = membership.circle_id;

        return (new_membership, final {
            let old_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: old_owner });
            let join_order: u8 = members.get(old_key);
            members.remove(old_key);

            let new_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: new_owner });
            assert(!members.contains(new_key));
            members.set(new_key, join_order);
        });
    }

    fn verify_membership(public circle_id: field) -> Final {
        let member: address = self.signer;

        return final {
            let key: field = BHP256::hash_to_field(MemberKey { circle_id: circle_id, member_addr: member });
            assert(members.contains(key));
        };
    }

    // ======================================================================
    // -- USDCx STABLECOIN TRANSITIONS (token_id = 1field) ------------------
    // ======================================================================

    fn contribute_usdcx(
        membership: CircleMembership,
        public cycle: u8
    ) -> (CircleMembership, ContributionReceipt, Final) {
        let tf: Final = test_usdcx_stablecoin.aleo::transfer_public_as_signer(self.address, membership.contribution_amount as u128);

        let receipt: ContributionReceipt = ContributionReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle,
            amount: membership.contribution_amount
        };

        let contributor: address = self.signer;
        let cid: field = membership.circle_id;

        return (membership, receipt, final {
            tf.run();

            let info: CircleInfo = circles.get(cid);
            assert_eq(info.status, 1u8);
            assert_eq(info.current_cycle, cycle);
            assert_eq(info.token_id, 1field);

            let member_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: contributor });
            assert(members.contains(member_key));

            let contrib_key: field = BHP256::hash_to_field(ContribKey { circle_id: cid, cycle: cycle, member_addr: contributor });
            assert(!contributions.get_or_use(contrib_key, false));
            contributions.set(contrib_key, true);

            let ck: field = BHP256::hash_to_field(CycleKey { circle_id: cid, cycle: cycle });
            let cc: u8 = cycle_count.get_or_use(ck, 0u8);
            cycle_count.set(ck, cc + 1u8);
        });
    }

    fn claim_payout_usdcx(
        membership: CircleMembership,
        public cycle: u8,
        public payout_amount: u64
    ) -> (PayoutReceipt, Final) {
        let tf: Final = test_usdcx_stablecoin.aleo::transfer_public(self.signer, payout_amount as u128);

        let receipt: PayoutReceipt = PayoutReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle
        };

        let claimer: address = self.signer;
        let cid: field = membership.circle_id;

        return (receipt, final {
            let info: CircleInfo = circles.get(cid);
            assert_eq(info.status, 1u8);
            assert_eq(info.current_cycle, cycle);
            assert_eq(info.token_id, 1field);

            let ck: field = BHP256::hash_to_field(CycleKey { circle_id: cid, cycle: cycle });
            assert_eq(cycle_count.get(ck), info.max_members);

            let expected: u64 = info.contribution_amount * (info.max_members as u64);
            assert_eq(payout_amount, expected);

            let key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: claimer });
            let join_order: u8 = members.get(key);
            assert_eq(join_order, cycle);

            tf.run();

            let next_cycle: u8 = cycle + 1u8;
            let is_done: bool = next_cycle > info.total_cycles;

            circles.set(cid, CircleInfo {
                contribution_amount: info.contribution_amount,
                max_members: info.max_members,
                total_cycles: info.total_cycles,
                current_cycle: is_done ? cycle : next_cycle,
                members_joined: info.members_joined,
                status: is_done ? 2u8 : 1u8,
                token_id: info.token_id
            });
        });
    }

    // ======================================================================
    // -- USAD STABLECOIN TRANSITIONS (token_id = 2field) -------------------
    // ======================================================================

    fn contribute_usad(
        membership: CircleMembership,
        public cycle: u8
    ) -> (CircleMembership, ContributionReceipt, Final) {
        let tf: Final = test_usad_stablecoin.aleo::transfer_public_as_signer(self.address, membership.contribution_amount as u128);

        let receipt: ContributionReceipt = ContributionReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle,
            amount: membership.contribution_amount
        };

        let contributor: address = self.signer;
        let cid: field = membership.circle_id;

        return (membership, receipt, final {
            tf.run();

            let info: CircleInfo = circles.get(cid);
            assert_eq(info.status, 1u8);
            assert_eq(info.current_cycle, cycle);
            assert_eq(info.token_id, 2field);

            let member_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: contributor });
            assert(members.contains(member_key));

            let contrib_key: field = BHP256::hash_to_field(ContribKey { circle_id: cid, cycle: cycle, member_addr: contributor });
            assert(!contributions.get_or_use(contrib_key, false));
            contributions.set(contrib_key, true);

            let ck: field = BHP256::hash_to_field(CycleKey { circle_id: cid, cycle: cycle });
            let cc: u8 = cycle_count.get_or_use(ck, 0u8);
            cycle_count.set(ck, cc + 1u8);
        });
    }

    fn claim_payout_usad(
        membership: CircleMembership,
        public cycle: u8,
        public payout_amount: u64
    ) -> (PayoutReceipt, Final) {
        let tf: Final = test_usad_stablecoin.aleo::transfer_public(self.signer, payout_amount as u128);

        let receipt: PayoutReceipt = PayoutReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle: cycle
        };

        let claimer: address = self.signer;
        let cid: field = membership.circle_id;

        return (receipt, final {
            let info: CircleInfo = circles.get(cid);
            assert_eq(info.status, 1u8);
            assert_eq(info.current_cycle, cycle);
            assert_eq(info.token_id, 2field);

            let ck: field = BHP256::hash_to_field(CycleKey { circle_id: cid, cycle: cycle });
            assert_eq(cycle_count.get(ck), info.max_members);

            let expected: u64 = info.contribution_amount * (info.max_members as u64);
            assert_eq(payout_amount, expected);

            let key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: claimer });
            let join_order: u8 = members.get(key);
            assert_eq(join_order, cycle);

            tf.run();

            let next_cycle: u8 = cycle + 1u8;
            let is_done: bool = next_cycle > info.total_cycles;

            circles.set(cid, CircleInfo {
                contribution_amount: info.contribution_amount,
                max_members: info.max_members,
                total_cycles: info.total_cycles,
                current_cycle: is_done ? cycle : next_cycle,
                members_joined: info.members_joined,
                status: is_done ? 2u8 : 1u8,
                token_id: info.token_id
            });
        });
    }

    // ======================================================================
    // -- FLAG MISSED CONTRIBUTION ------------------------------------------
    // ======================================================================

    fn flag_missed_contribution(
        membership: CircleMembership,
        public defaulter: address,
        public cycle: u8
    ) -> (CircleMembership, Final) {
        assert_neq(self.signer, defaulter);

        let reporter: address = self.signer;
        let cid: field = membership.circle_id;

        return (membership, final {
            let info: CircleInfo = circles.get(cid);
            assert(info.status == 1u8 || info.status == 2u8);
            assert(info.current_cycle > cycle || info.status == 2u8);

            let reporter_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: reporter });
            assert(members.contains(reporter_key));

            let defaulter_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: defaulter });
            assert(members.contains(defaulter_key));

            let contrib_key: field = BHP256::hash_to_field(ContribKey { circle_id: cid, cycle: cycle, member_addr: defaulter });
            assert(!contributions.get_or_use(contrib_key, false));

            let flag_key: field = BHP256::hash_to_field(DefaultKey { circle_id: cid, defaulter: defaulter, cycle: cycle });
            assert(!default_flags.get_or_use(flag_key, false));
            default_flags.set(flag_key, true);

            let member_default_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: defaulter });
            let count: u8 = defaults.get_or_use(member_default_key, 0u8);
            defaults.set(member_default_key, count + 1u8);
        });
    }

    // ======================================================================
    // -- ON-CHAIN DISPUTE RESOLUTION ---------------------------------------
    // ======================================================================

    fn create_dispute(
        membership: CircleMembership,
        public accused: address,
        public reason: u8,
        public cycle: u8
    ) -> (CircleMembership, DisputeReceipt, Final) {
        assert_neq(self.signer, accused);
        assert(reason <= 2u8);

        let dispute_id: field = BHP256::hash_to_field(DisputeKey {
            circle_id: membership.circle_id,
            accused: accused,
            cycle: cycle
        });

        let receipt: DisputeReceipt = DisputeReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            dispute_id: dispute_id,
            accused: accused
        };

        let reporter: address = self.signer;
        let cid: field = membership.circle_id;

        return (membership, receipt, final {
            let info: CircleInfo = circles.get(cid);
            assert(info.status == 1u8 || info.status == 2u8);

            let reporter_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: reporter });
            assert(members.contains(reporter_key));

            let accused_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: accused });
            assert(members.contains(accused_key));

            assert(!disputes.contains(dispute_id));

            disputes.set(dispute_id, DisputeInfo {
                circle_id: cid,
                accused: accused,
                reason: reason,
                votes_for: 1u8,
                votes_against: 0u8,
                status: 0u8,
                created_cycle: cycle
            });

            let vote_key: field = BHP256::hash_to_field(DisputeVoteKey { dispute_id: dispute_id, voter: reporter });
            dispute_votes.set(vote_key, true);
        });
    }

    fn vote_on_dispute(
        membership: CircleMembership,
        public dispute_id: field,
        public vote_for: bool
    ) -> (CircleMembership, Final) {
        let voter: address = self.signer;
        let cid: field = membership.circle_id;

        return (membership, final {
            let dispute: DisputeInfo = disputes.get(dispute_id);
            assert_eq(dispute.status, 0u8);
            assert_eq(dispute.circle_id, cid);

            let voter_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: voter });
            assert(members.contains(voter_key));

            assert_neq(voter, dispute.accused);

            let vote_key: field = BHP256::hash_to_field(DisputeVoteKey { dispute_id: dispute_id, voter: voter });
            assert(!dispute_votes.get_or_use(vote_key, false));
            dispute_votes.set(vote_key, true);

            let new_for: u8 = vote_for ? dispute.votes_for + 1u8 : dispute.votes_for;
            let new_against: u8 = vote_for ? dispute.votes_against : dispute.votes_against + 1u8;

            disputes.set(dispute_id, DisputeInfo {
                circle_id: dispute.circle_id,
                accused: dispute.accused,
                reason: dispute.reason,
                votes_for: new_for,
                votes_against: new_against,
                status: 0u8,
                created_cycle: dispute.created_cycle
            });
        });
    }

    fn resolve_dispute(
        membership: CircleMembership,
        public dispute_id: field
    ) -> (CircleMembership, Final) {
        let caller: address = self.signer;
        let cid: field = membership.circle_id;

        return (membership, final {
            let dispute: DisputeInfo = disputes.get(dispute_id);
            assert_eq(dispute.status, 0u8);
            assert_eq(dispute.circle_id, cid);

            let caller_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: caller });
            assert(members.contains(caller_key));

            let info: CircleInfo = circles.get(cid);

            let eligible_voters: u8 = info.max_members - 1u8;
            let total_votes: u8 = dispute.votes_for + dispute.votes_against;
            let quorum: u8 = eligible_voters / 2u8 + 1u8;
            assert(total_votes >= quorum);

            let is_guilty: bool = dispute.votes_for > dispute.votes_against;
            let new_status: u8 = is_guilty ? 1u8 : 2u8;

            disputes.set(dispute_id, DisputeInfo {
                circle_id: dispute.circle_id,
                accused: dispute.accused,
                reason: dispute.reason,
                votes_for: dispute.votes_for,
                votes_against: dispute.votes_against,
                status: new_status,
                created_cycle: dispute.created_cycle
            });

            if (is_guilty) {
                let accused_default_key: field = BHP256::hash_to_field(MemberKey { circle_id: cid, member_addr: dispute.accused });
                let default_count: u8 = defaults.get_or_use(accused_default_key, 0u8);
                defaults.set(accused_default_key, default_count + 1u8);
            }
        });
    }

    // ======================================================================
    // -- zkEMAIL IDENTITY VERIFICATION -------------------------------------
    // ======================================================================

    fn register_email_commitment(public email_hash: field) -> Final {
        let owner: address = self.signer;

        return final {
            let addr_key: field = BHP256::hash_to_field(MemberKey { circle_id: 0field, member_addr: owner });
            assert(!email_commitments.contains(addr_key));
            email_commitments.set(addr_key, email_hash);
        };
    }

    fn verify_email_commitment(public email_hash: field) -> Final {
        let owner: address = self.signer;

        return final {
            let addr_key: field = BHP256::hash_to_field(MemberKey { circle_id: 0field, member_addr: owner });
            let stored_hash: field = email_commitments.get(addr_key);
            assert_eq(stored_hash, email_hash);
            email_verified.set(addr_key, true);
        };
    }
}
