// ZkCircles - Trustless Zero-Knowledge Rotating Savings and Credit Associations
// Built on Aleo for privacy-preserving community finance
// Program: zk_circles_v3.aleo

import credits.aleo;

program zk_circles_v3.aleo {

    // ==================== STRUCTS ====================

    struct CircleIdInput {
        creator: address,
        name_hash: field,
        salt: field
    }

    struct MemberKeyInput {
        circle_id: field,
        member_addr: address
    }

    struct ContribKeyInput {
        circle_id: field,
        cycle: u8,
        member_addr: address
    }

    struct CircleConfig {
        contribution_amount: u64,
        max_members: u8,
        cycle_duration_blocks: u32,
        creator: address,
        status: u8
    }

    struct CircleState {
        current_cycle: u8,
        members_joined: u8,
        start_block: u32,
        last_payout_cycle: u8
    }

    struct MemberData {
        join_order: u8,
        total_contributed: u64,
        has_received_payout: bool
    }

    // ==================== RECORDS ====================

    record CircleMembership {
        owner: address,
        circle_id: field,
        contribution_amount: u64,
        salt: field
    }

    record ContributionReceipt {
        owner: address,
        circle_id: field,
        cycle_number: u8,
        amount: u64
    }

    record PayoutReceipt {
        owner: address,
        circle_id: field,
        cycle_number: u8,
        amount: u64
    }

    // ==================== MAPPINGS ====================

    mapping circles: field => CircleConfig;
    mapping circle_states: field => CircleState;
    mapping members: field => MemberData;
    mapping contributions: field => bool;
    mapping total_circles: u8 => u64;

    // ==================== CONSTRUCTOR ====================

    // Called automatically on deploy/upgrade.
    // @noupgrade prevents future program upgrades.
    @noupgrade
    async constructor() {}

    // ==================== TRANSITIONS ====================

    async transition create_circle(
        public name_hash: field,
        public contribution_amount: u64,
        public max_members: u8,
        public cycle_duration_blocks: u32,
        public salt: field
    ) -> (CircleMembership, Future) {
        assert(contribution_amount >= 1000u64);
        assert(max_members >= 2u8);
        assert(max_members <= 12u8);
        assert(cycle_duration_blocks >= 100u32);

        let circle_id: field = BHP256::hash_to_field(CircleIdInput {
            creator: self.signer,
            name_hash: name_hash,
            salt: salt
        });

        let membership: CircleMembership = CircleMembership {
            owner: self.signer,
            circle_id: circle_id,
            contribution_amount: contribution_amount,
            salt: salt
        };

        let f: Future = finalize_create_circle(
            circle_id,
            contribution_amount,
            max_members,
            cycle_duration_blocks,
            self.signer
        );

        return (membership, f);
    }

    async function finalize_create_circle(
        circle_id: field,
        contribution_amount: u64,
        max_members: u8,
        cycle_duration_blocks: u32,
        creator: address
    ) {

        circles.set(circle_id, CircleConfig {
            contribution_amount: contribution_amount,
            max_members: max_members,
            cycle_duration_blocks: cycle_duration_blocks,
            creator: creator,
            status: 0u8
        });

        circle_states.set(circle_id, CircleState {
            current_cycle: 0u8,
            members_joined: 1u8,
            start_block: 0u32,
            last_payout_cycle: 0u8
        });

        let member_key: field = BHP256::hash_to_field(MemberKeyInput {
            circle_id: circle_id,
            member_addr: creator
        });

        members.set(member_key, MemberData {
            join_order: 1u8,
            total_contributed: 0u64,    
            has_received_payout: false
        });

        let prev_total: u64 = total_circles.get_or_use(0u8, 0u64);
        total_circles.set(0u8, prev_total + 1u64);
    }

    async transition join_circle(
        public circle_id: field,
        public salt: field
    ) -> (CircleMembership, Future) {
        let membership: CircleMembership = CircleMembership {
            owner: self.signer,
            circle_id: circle_id,
            contribution_amount: 0u64,
            salt: salt
        };

        let f: Future = finalize_join_circle(circle_id, self.signer);
        return (membership, f);
    }

    async function finalize_join_circle(
        circle_id: field,
        joiner: address
    ) {
        let config: CircleConfig = circles.get(circle_id);
        assert_eq(config.status, 0u8);

        let state: CircleState = circle_states.get(circle_id);
        assert(state.members_joined < config.max_members);

        let member_key: field = BHP256::hash_to_field(MemberKeyInput {
            circle_id: circle_id,
            member_addr: joiner
        });

        let new_join_order: u8 = state.members_joined + 1u8;
        let is_full: bool = new_join_order == config.max_members;

        members.set(member_key, MemberData {
            join_order: new_join_order,
            total_contributed: 0u64,
            has_received_payout: false
        });

        circle_states.set(circle_id, CircleState {
            current_cycle: is_full ? 1u8 : 0u8,
            members_joined: new_join_order,
            start_block: is_full ? block.height : 0u32,
            last_payout_cycle: 0u8
        });

        circles.set(circle_id, CircleConfig {
            contribution_amount: config.contribution_amount,
            max_members: config.max_members,
            cycle_duration_blocks: config.cycle_duration_blocks,
            creator: config.creator,
            status: is_full ? 1u8 : 0u8
        });
    }

    async transition contribute(
        membership: CircleMembership,
        payment: credits.aleo/credits,
        public pot_address: address,
        public cycle_number: u8
    ) -> (CircleMembership, ContributionReceipt, credits.aleo/credits, Future) {
        let (change, sent_record): (credits.aleo/credits, credits.aleo/credits) = credits.aleo/transfer_private(
            payment,
            pot_address,
            membership.contribution_amount
        );

        let receipt: ContributionReceipt = ContributionReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle_number: cycle_number,
            amount: membership.contribution_amount
        };

        let f: Future = finalize_contribute(
            membership.circle_id,
            self.signer,
            membership.contribution_amount,
            cycle_number
        );

        return (membership, receipt, change, f);
    }

    async function finalize_contribute(
        circle_id: field,
        contributor: address,
        amount: u64,
        cycle_number: u8
    ) {
        let config: CircleConfig = circles.get(circle_id);
        assert_eq(config.status, 1u8);
        assert_eq(amount, config.contribution_amount);

        let state: CircleState = circle_states.get(circle_id);
        assert_eq(cycle_number, state.current_cycle);

        let member_key: field = BHP256::hash_to_field(MemberKeyInput {
            circle_id: circle_id,
            member_addr: contributor
        });
        let member: MemberData = members.get(member_key);

        let contrib_key: field = BHP256::hash_to_field(ContribKeyInput {
            circle_id: circle_id,
            cycle: cycle_number,
            member_addr: contributor
        });

        contributions.set(contrib_key, true);

        members.set(member_key, MemberData {
            join_order: member.join_order,
            total_contributed: member.total_contributed + amount,
            has_received_payout: member.has_received_payout
        });
    }

    async transition claim_payout(
        membership: CircleMembership,
        public cycle_number: u8
    ) -> (PayoutReceipt, Future) {
        let receipt: PayoutReceipt = PayoutReceipt {
            owner: self.signer,
            circle_id: membership.circle_id,
            cycle_number: cycle_number,
            amount: 0u64
        };

        let f: Future = finalize_claim_payout(
            membership.circle_id,
            self.signer
        );

        return (receipt, f);
    }

    async function finalize_claim_payout(
        circle_id: field,
        claimer: address
    ) {
        let config: CircleConfig = circles.get(circle_id);
        let state: CircleState = circle_states.get(circle_id);
        assert_eq(config.status, 1u8);

        let member_key: field = BHP256::hash_to_field(MemberKeyInput {
            circle_id: circle_id,
            member_addr: claimer
        });
        let member: MemberData = members.get(member_key);

        assert_eq(member.join_order, state.current_cycle);

        members.set(member_key, MemberData {
            join_order: member.join_order,
            total_contributed: member.total_contributed,
            has_received_payout: true
        });

        let next_cycle: u8 = state.current_cycle + 1u8;
        let is_complete: bool = next_cycle > config.max_members;

        circle_states.set(circle_id, CircleState {
            current_cycle: is_complete ? state.current_cycle : next_cycle,
            members_joined: state.members_joined,
            start_block: state.start_block,
            last_payout_cycle: state.current_cycle
        });

        circles.set(circle_id, CircleConfig {
            contribution_amount: config.contribution_amount,
            max_members: config.max_members,
            cycle_duration_blocks: config.cycle_duration_blocks,
            creator: config.creator,
            status: is_complete ? 2u8 : 1u8
        });
    }

    async transition cancel_circle(
        public circle_id: field
    ) -> Future {
        return finalize_cancel_circle(circle_id, self.signer);
    }

    async function finalize_cancel_circle(
        circle_id: field,
        caller: address
    ) {
        let config: CircleConfig = circles.get(circle_id);
        assert_eq(caller, config.creator);
        assert_eq(config.status, 0u8);

        circles.set(circle_id, CircleConfig {
            contribution_amount: config.contribution_amount,
            max_members: config.max_members,
            cycle_duration_blocks: config.cycle_duration_blocks,
            creator: config.creator,
            status: 3u8
        });
    }

    // Transfer membership to a new owner (private record transfer)
    transition transfer_membership(
        membership: CircleMembership,
        public new_owner: address
    ) -> CircleMembership {
        assert_eq(self.signer, membership.owner);
        return CircleMembership {
            owner: new_owner,
            circle_id: membership.circle_id,
            contribution_amount: membership.contribution_amount,
            salt: membership.salt
        };
    }

    // Verify membership exists on-chain — asserts the caller is a registered member
    async transition verify_membership(
        public circle_id: field
    ) -> Future {
        return finalize_verify_membership(circle_id, self.signer);
    }

    async function finalize_verify_membership(
        circle_id: field,
        member_addr: address
    ) {
        let member_key: field = BHP256::hash_to_field(MemberKeyInput {
            circle_id: circle_id,
            member_addr: member_addr
        });
        let is_member: bool = members.contains(member_key);
        assert(is_member);
    }
}
