# ZkCircles

**Trustless, privacy-preserving ROSCA on the Aleo blockchain.**

Members pool a fixed amount each cycle and take turns receiving the full pot — no organizer holds funds, no one can cheat the order, and no member identity is exposed on-chain.

Privacy matters because financial need is personal. On ZkCircles, member keys are BHP256 hashes, receipts and membership proofs are private Aleo records visible only to the owner, and circle names are AES-256-GCM encrypted off-chain so only a hash reaches the chain.

![License](https://img.shields.io/badge/license-MIT-amber)
![Aleo](https://img.shields.io/badge/Aleo-Testnet-brightgreen)
![Program](https://img.shields.io/badge/Program-zk__circles__v11.aleo-blue)

**Live app:** https://zk-circles.vercel.app/  
**Repo:** https://github.com/aamer1932002-dev/ZkCircles  
**Video demo:** https://youtu.be/AGZZAXuah-g

---

## What's Working

**Core ROSCA flow**
- Create a circle — set contribution amount, member cap (2-20), total cycles, and token (ALEO / USDCx / USAD)
- Join a circle — any wallet can join a forming circle
- Contribute — sends your contribution for the current cycle via `credits.aleo/transfer_public_as_signer` (or the stablecoin equivalent)
- Claim payout — the cycle winner pulls the full pot via `credits.aleo/transfer_public`
- Cancel circle — creator can cancel while the circle is still forming

**Membership & identity**
- Transfer membership — pass your circle position to any address; the new owner's address is synced to the backend and the UI refreshes immediately
- Verify membership — on-chain ZK proof that an address holds a valid `CircleMembership` record
- zkEmail identity verification — register an email hash on-chain and mark the address as verified; visible in the circle member list

**Dispute resolution**
- Create dispute — open a formal on-chain dispute against an accused member with a reason (missed contribution / suspicious activity / collusion)
- Vote on dispute — members cast votes; tally tracked in the `dispute_votes` mapping
- Resolve dispute — close the dispute and record the outcome (guilty / innocent) on-chain

**Discovery & management**
- Explorer — browse every circle on the platform with live on-chain status
- My Circles — view all circles you have joined or created
- Analytics — per-circle contribution history, member contribution breakdown, completion rate, payout schedule
- Multi-cycle dashboard — visual timeline of all past and upcoming payout cycles for a circle
- Circle invite links — share a URL that drops someone directly into the join flow for a specific circle

**Automation & notifications**
- Auto-contribution scheduling — enable reminders so you never miss a cycle; stored per-member in the backend
- Browser notifications — push alerts for your payout turn and contribution reminders via the Service Worker

**Infrastructure**
- 3-layer membership caching — wallet records → localStorage → Aleo testnet fetch
- Live transaction status tracker — polls the explorer until accepted or rejected; resolves Shield Wallet temporary IDs to real on-chain TX IDs
- On-chain pre-flight checks — queries live chain state before every transaction to surface errors before broadcasting
- Stale permissions handling — detects expired wallet sessions and prompts reconnect instead of showing a raw error
- AES-256-GCM backend encryption — all member addresses and sensitive metadata are encrypted before hitting the database

---

## Smart Contract

**Program:** `zk_circles_v11.aleo`  
**Network:** Aleo Testnet  
**v6 Deployment TX:** `at1z5rendz2gtpeq7u2ldsnmy8mrcvlxasn373n9j5j54v8t32lxcrsq7u7wh`

### Transitions

| Transition | Description |
|---|---|
| `create_circle` | Create a new savings circle |
| `join_circle` | Join a forming circle |
| `contribute` | Contribute ALEO for the current cycle (`transfer_public_as_signer`) |
| `contribute_usdcx` | Contribute USDCx stablecoin |
| `contribute_usad` | Contribute USAD stablecoin |
| `claim_payout` | Claim the ALEO pot when it is your turn (`transfer_public`) |
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

### Private Records

| Record | Fields |
|---|---|
| `CircleMembership` | `owner`, `circle_id`, `contribution_amount` |
| `ContributionReceipt` | `owner`, `circle_id`, `cycle`, `amount` |
| `PayoutReceipt` | `owner`, `circle_id`, `cycle` |
| `DisputeReceipt` | `owner`, `circle_id`, `dispute_id`, `accused` |

### Mappings

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

### Privacy Design

- Member addresses are **never stored in plain text** — all mapping keys are `BHP256` hashes so no identity reaches the chain
- Membership, contribution, payout, and dispute proofs are **private records** encrypted to the owner's key
- Circle names are **AES-256-GCM encrypted off-chain**; only the derived `circle_id` field hash is stored on-chain
- Circle IDs are derived as `BHP256(creator + name + salt)` — the name is never on-chain

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS, deployed on Vercel |
| Wallet | Shield Wallet (primary) and Leo Wallet via `@provablehq/aleo-wallet-adaptor-react` |
| Backend | Express.js + Supabase (PostgreSQL), deployed on Render |
| Encryption | AES-256-GCM for all off-chain sensitive data |
| Chain | Aleo Testnet — `zk_circles_v11.aleo` + `credits.aleo` |

---

## Project Structure

```
LeoCircles/
├── contracts/zk_circles/src/main.leo   # Core ROSCA smart contract
├── frontend/src/
│   ├── pages/        # Home, CreateCircle, JoinCircle, CircleDetail, MyCircles,
│   │                 # Explorer, Analytics, CycleDashboard, DisputeResolution,
│   │                 # InviteAccept, VerifyIdentity, HowItWorks, Privacy
│   ├── hooks/        # useCreateCircle, useJoinCircle, useContribute, useClaimPayout,
│   │                 # useTransferMembership, useVerifyMembership, useDisputeResolution,
│   │                 # useOnChainDispute, useZkEmailVerification, useAutoContribution,
│   │                 # useInviteLinks, useAnalytics, useNotifications, useCircles, etc.
│   ├── utils/        # transactionTracker, membershipCache, recordResolver,
│   │                 # onChainQuery, walletErrors
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

## Resources

- [Aleo Developer Docs](https://developer.aleo.org/)
- [Leo Language Reference](https://developer.aleo.org/leo/)
- [Shield Wallet](https://www.shieldwallet.xyz/)
- [Aleo Testnet Explorer](https://explorer.aleo.org/)

---

*Built for communities worldwide — Aleo Buildathon 2026*
