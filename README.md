# ZkCircles

**Trustless, privacy-preserving ROSCA + credit scoring + P2P micro-lending on the Aleo blockchain.**

Members pool a fixed amount each cycle and take turns receiving the full pot — no organizer holds funds, no one can cheat the order, and no member identity is exposed on-chain. Every contribution builds your on-chain credit score, unlocking reputation-gated circles and peer-to-peer lending.

Privacy matters because financial need is personal. On ZkCircles, member keys are BHP256 hashes, receipts and membership proofs are private Aleo records visible only to the owner, and circle names are AES-256-GCM encrypted off-chain so only a hash reaches the chain.

![License](https://img.shields.io/badge/license-MIT-amber)
![Aleo](https://img.shields.io/badge/Aleo-Testnet-brightgreen)
![Program](https://img.shields.io/badge/Program-zk__circles__v15.aleo-blue)
![Transitions](https://img.shields.io/badge/Transitions-24-orange)
![Tokens](https://img.shields.io/badge/Tokens-ALEO%20%7C%20USDCx%20%7C%20USAD-blueviolet)

**Live app:** https://zk-circles.vercel.app/  
**Repo:** https://github.com/aamer1932002-dev/ZkCircles  
**Video demo:** https://youtu.be/AGZZAXuah-g

---

## Features

### Core ROSCA Flow
- **Create a circle** — set contribution amount, member cap (2-20), total cycles, token (ALEO / USDCx / USAD), and minimum reputation score
- **Join a circle** — any wallet can join a forming circle; reputation-gated circles enforce a minimum credit score
- **Contribute** — sends your contribution for the current cycle via `credits.aleo/transfer_public_as_signer` (or the stablecoin equivalent)
- **Claim payout** — the cycle winner pulls the full pot via `credits.aleo/transfer_public`
- **Cancel circle** — creator can cancel while the circle is still forming
- **Multi-token support** — native ALEO credits, USDCx stablecoin, and USAD stablecoin with dedicated contribute/claim transitions for each

### On-Chain Credit Score
- **Reputation tracking** — every contribution, circle completion, loan repayment, default, and missed payment is recorded on-chain
- **Credit score formula** — integer arithmetic score from 0 to 100:
  - Contribution points: `min(contributions × 3, 45)`
  - Completion points: `min(circles_completed × 8, 25)`
  - Loan repayment points: `min(loans_repaid × 5, 15)`
  - Base: `15` (new user baseline)
  - Penalties: `defaults × 10 + loan_defaults × 20`
- **update_credit_score** — any user can recompute and store their score on-chain at any time
- **claim_circle_completion** — members of completed circles claim a completion bonus to their reputation (once per circle)

### Reputation-Gated Circles
- Creators set a `min_reputation` (0-100) when creating a circle
- Joiners must meet the minimum credit score to be accepted
- Enables high-trust circles where every member has proven track record

### Peer-to-Peer Micro-Lending
- **offer_loan** — lender deposits funds into program escrow, specifying borrower, amount, and interest rate (up to 50% / 5000 bps)
- **accept_loan** — borrower accepts and receives disbursement (requires credit score ≥ 40)
- **repay_loan** — borrower repays principal + interest; lender receives funds atomically; borrower's reputation improves
- **cancel_loan** — lender reclaims funds before borrower accepts
- **default_loan** — lender marks loan as defaulted; borrower's credit score is permanently damaged
- No forced repayment — defaults act as permanent on-chain reputation damage

### Membership & Identity
- **Transfer membership** — pass your circle position to any address; the new owner is synced to the backend and the UI refreshes immediately
- **Verify membership** — on-chain ZK proof that an address holds a valid `CircleMembership` record
- **zkEmail identity verification** — register an email hash on-chain and mark the address as verified; visible in the member list

### Dispute Resolution
- **Create dispute** — open a formal on-chain dispute against an accused member (missed contribution / suspicious activity / collusion)
- **Vote on dispute** — members cast votes; tally tracked in the `dispute_votes` mapping
- **Resolve dispute** — close the dispute once quorum is reached; record the verdict (guilty / innocent) on-chain; guilty verdicts increment the accused's default count

### Discovery & Management
- **Explorer** — browse every circle on the platform with live on-chain status, search, and filters
- **My Circles** — view all circles you have joined or created
- **Analytics** — per-circle contribution history, member contribution breakdown, completion rate, payout schedule
- **Member profile page** — per-address page showing circles joined, total contributed, payouts received, credit score, and verification status
- **Circle invite links + QR codes** — share a URL or QR code that drops someone directly into the join flow

### Automation & Notifications
- **Auto-contribution scheduling** — enable reminders so you never miss a cycle; stored per-member in the backend
- **Browser push notifications** — alerts for your payout turn and contribution reminders via Service Worker

### Infrastructure
- 3-layer membership caching — wallet records → localStorage → Aleo testnet fetch
- Live transaction status tracker — polls the explorer until accepted or rejected; resolves Shield Wallet temporary IDs to real on-chain TX IDs
- On-chain pre-flight checks — queries live chain state before every transaction to surface errors before broadcasting
- Stale permissions handling — detects expired wallet sessions and prompts reconnect
- AES-256-GCM backend encryption — all member addresses and sensitive metadata are encrypted before hitting the database

---

## Smart Contract

**Program:** `zk_circles_v15.aleo`  
**Network:** Aleo Testnet  
**Leo version:** 4.0  
**Stats:** 828 statements · 30.72 KB · 1.4M variables · 1.08M constraints

### Transitions (24 total)

| Transition | Description |
|---|---|
| `create_circle` | Create a new savings circle with optional reputation gate |
| `join_circle` | Join a forming circle (credit score checked if gated) |
| `contribute` | Contribute ALEO credits for the current cycle |
| `contribute_usdcx` | Contribute USDCx stablecoin |
| `contribute_usad` | Contribute USAD stablecoin |
| `claim_payout` | Claim the ALEO pot when it is your turn |
| `claim_payout_usdcx` | Claim USDCx payout |
| `claim_payout_usad` | Claim USAD payout |
| `transfer_membership` | Transfer your position to another address |
| `verify_membership` | Assert on-chain membership |
| `cancel_circle` | Cancel a forming circle (creator only) |
| `flag_missed_contribution` | Flag a member who missed a past cycle |
| `create_dispute` | Open a formal on-chain dispute |
| `vote_on_dispute` | Cast a vote on an open dispute |
| `resolve_dispute` | Close a dispute and record the verdict |
| `register_email_commitment` | Commit an email hash to the chain |
| `verify_email_commitment` | Mark an address as email-verified on-chain |
| `claim_circle_completion` | Claim circle completion reputation bonus |
| `update_credit_score` | Recompute and store your on-chain credit score |
| `offer_loan` | Offer a P2P loan (escrow funds into program) |
| `accept_loan` | Accept a loan offer (score ≥ 40 required) |
| `repay_loan` | Repay loan principal + interest |
| `cancel_loan` | Cancel a pending loan offer |
| `default_loan` | Mark a loan as defaulted |

### Private Records

| Record | Fields |
|---|---|
| `CircleMembership` | `owner`, `circle_id`, `contribution_amount` |
| `ContributionReceipt` | `owner`, `circle_id`, `cycle`, `amount` |
| `PayoutReceipt` | `owner`, `circle_id`, `cycle` |
| `DisputeReceipt` | `owner`, `circle_id`, `dispute_id`, `accused` |

### Mappings (17 total)

| Mapping | Key → Value |
|---|---|
| `circles` | `circle_id` → `CircleInfo` |
| `members` | `BHP256(circle_id, address)` → `join_order` |
| `contributions` | `BHP256(circle_id, cycle, address)` → `bool` |
| `defaults` | `BHP256(circle_id, defaulter)` → missed count |
| `default_flags` | `BHP256(circle_id, defaulter, cycle)` → `bool` |
| `cycle_count` | `BHP256(circle_id, cycle)` → contributor count |
| `disputes` | `BHP256(DisputeKey)` → `DisputeInfo` |
| `dispute_votes` | `BHP256(DisputeVoteKey)` → `bool` |
| `email_commitments` | `BHP256(address)` → email hash |
| `email_verified` | `BHP256(address)` → `bool` |
| `reputation_contributions` | `BHP256(address)` → total contributions |
| `reputation_defaults` | `BHP256(address)` → total defaults |
| `reputation_completed` | `BHP256(address)` → circles completed |
| `reputation_loans_repaid` | `BHP256(address)` → loans repaid |
| `reputation_loans_defaulted` | `BHP256(address)` → loans defaulted |
| `credit_scores` | `BHP256(address)` → score (0-100) |
| `loans` | `loan_id` → `LoanInfo` |

### Privacy Design

- Member addresses are **never stored in plain text** — all mapping keys are `BHP256` hashes so no identity reaches the chain
- Membership, contribution, payout, and dispute proofs are **private records** encrypted to the owner's key
- Circle names are **AES-256-GCM encrypted off-chain**; only the derived `circle_id` field hash is stored on-chain
- Circle IDs are derived as `BHP256(creator + name + salt)` — the name is never on-chain
- Credit scores are stored under hashed address keys — no address ↔ score link is visible to observers
- Loan records use hashed loan IDs — the relationship between lender and borrower is only visible to the participants

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 + Tailwind CSS 3.4 + Framer Motion 11 |
| Wallet | Shield Wallet (primary) + Leo Wallet via `@provablehq/aleo-wallet-adaptor-react` |
| Backend | Express.js + Supabase (PostgreSQL), deployed on Render |
| Encryption | AES-256-GCM for all off-chain sensitive data |
| Chain | Aleo Testnet — `zk_circles_v15.aleo` + `credits.aleo` + `test_usdcx_stablecoin.aleo` + `test_usad_stablecoin.aleo` |

---

## Project Structure

```
LeoCircles/
├── contracts/zk_circles/src/main.leo   # v15 smart contract (828 statements)
├── frontend/src/
│   ├── pages/        # Home, CreateCircle, JoinCircle, CircleDetail, MyCircles,
│   │                 # Explorer, Analytics, Lending, HowItWorks, Privacy
│   ├── hooks/        # useCreateCircle, useJoinCircle, useContribute, useClaimPayout,
│   │                 # useTransferMembership, useVerifyMembership, useCreditScore,
│   │                 # useLending, useAnalytics, useNotifications, useCircles,
│   │                 # useMyCircles, useCircleDetail
│   ├── utils/        # aleo-utils, membershipCache, onChainQuery
│   ├── services/api.ts
│   └── config.ts
└── backend/
    ├── index.js       # Express API
    ├── encryption.js  # AES-256-GCM helpers
    └── schema.sql
```

---

## Running Locally

**Prerequisites:** Node.js ≥ 18, [Shield Wallet](https://www.shieldwallet.xyz/) browser extension, a free [Supabase](https://supabase.com) project.

```bash
git clone https://github.com/aamer1932002-dev/ZkCircles.git
cd ZkCircles
```

**Backend**

```bash
cd backend
npm install
# Create .env:
# SUPABASE_URL=...
# SUPABASE_ANON_KEY=...
# ENCRYPTION_KEY=<64 hex chars>
# PORT=3001
# Run backend/schema.sql in the Supabase SQL editor first
npm start
```

**Frontend**

```bash
cd frontend
npm install
# Optional .env to point at local backend:
# VITE_BACKEND_URL=http://localhost:3001
npm run dev
# http://localhost:5173
```

---

## Production Deployment

| Service | Settings |
|---|---|
| Frontend | Vercel — root dir `frontend` |
| Backend | Render — root dir `backend`, start command `node index.js` |

**Vercel env vars:** `VITE_BACKEND_URL`, `VITE_PROGRAM_ID`  
**Render env vars:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ENCRYPTION_KEY`, `PORT`

---

## Roadmap

### Completed (v15)
- [x] Core ROSCA flow (create, join, contribute, claim, cancel)
- [x] Multi-token support (ALEO, USDCx, USAD)
- [x] On-chain dispute resolution (create, vote, resolve)
- [x] zkEmail identity verification
- [x] Flag missed contributions with reputation impact
- [x] Explorer with search and filters
- [x] Member profile page with credit score
- [x] QR codes for circle invite links
- [x] On-chain credit score system (reputation tracking + scoring formula)
- [x] Reputation-gated circles
- [x] P2P micro-lending (offer, accept, repay, cancel, default)
- [x] Lending dashboard page

### Next (v16)
| # | Feature | Description |
|---|---|---|
| 1 | **Multi-token lending** | Extend P2P lending to USDCx and USAD stablecoins |
| 2 | **Circle templates** | Preset configurations (e.g. 5-member / 10 cycles / 10 ALEO) to reduce setup friction |
| 3 | **Email notifications** | Email fallback alongside browser push so members never miss their payout turn |
| 4 | **Contribution history export** | One-click CSV download of full contribution and payout history |
| 5 | **Loan marketplace** | Browse and filter available loan offers by amount, interest rate, and lender score |
| 6 | **Auto-contribution execution** | Move from reminders to actual scheduled on-chain contributions |

### Future Vision
| Feature | Description |
|---|---|
| **Cross-chain bridging** | Bridge ROSCA payouts to EVM chains via Aleo's bridge infrastructure |
| **Mobile app** | React Native wrapper with biometric wallet signing |
| **DAO governance** | Token-weighted governance for protocol parameters (max interest, min score thresholds) |
| **Institutional lending pools** | Allow DAOs and protocols to fund lending pools using ZkCircles credit scores |
| **Privacy-preserving credit reports** | ZK proofs that attest to a minimum credit score without revealing the exact value |
| **Fiat on/off ramps** | Direct fiat-to-ALEO conversion within the app for non-crypto-native users |`    ``
-12 
T7=W
---

## Resources

- [Aleo Developer Docs](https://developer.aleo.org/)
- [Leo Language Reference](https://developer.aleo.org/leo/)
- [Shield Wallet](https://www.shieldwallet.xyz/)
- [Aleo Testnet Explorer](https://explorer.aleo.org/)

---

*Built for communities worldwide — Aleo Buildathon 2026*
