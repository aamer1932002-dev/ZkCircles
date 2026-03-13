# ZkCircles

**Trustless, Zero-Knowledge Rotating Savings and Credit Associations on Aleo**

ZkCircles brings the centuries-old tradition of community savings circles (ROSCAs/chit funds/tandas) to the blockchain with full privacy using Aleo's zero-knowledge technology.

![License](https://img.shields.io/badge/license-MIT-amber)
![Aleo](https://img.shields.io/badge/Aleo-Testnet-brightgreen)
![Program](https://img.shields.io/badge/Program-zk__circles__v6.aleo-blue)

---

## What are ROSCAs?

Rotating Savings and Credit Associations have been trusted by communities worldwide for centuries -- known as Tandas (Latin America), Chit Funds (India), Susu (West Africa), and Hui (China). Members contribute fixed amounts each cycle, and one member receives the entire pot per cycle. ZkCircles digitises this trust with cryptographic guarantees on Aleo.

---

## What's Working

- **Create a circle** -- set contribution amount, member count (2-20), and total cycles
- **Join a circle** -- any wallet holder can join a forming circle
- **Contribute** -- send your contribution for the current cycle via `credits.aleo/transfer_public_as_signer`
- **Claim payout** -- the cycle winner claims the full pot via `credits.aleo/transfer_public`
- **Transfer membership** -- pass your circle position to another address
- **Verify membership** -- on-chain proof that an address is a member
- **Cancel circle** -- creator can cancel a circle while it is still forming
- **Explorer** -- browse all circles on the platform
- **Analytics** -- per-circle contribution history, member breakdown, payout schedule (accessible from the circle detail page)
- **On-chain pre-flight checks** -- queries live chain state before every transaction to catch errors upfront
- **Transaction confirmation tracking** -- polls the Aleo explorer until accepted or rejected; resolves Shield Wallet temporary IDs to real on-chain TX IDs
- **Shield Wallet** -- primary tested wallet with full `privateFee: false` support

---

## Architecture

```
+-------------------------------------------------------------+
|                     Frontend (React)                        |
|              Vite + TypeScript + Tailwind CSS               |
|                   Deployed on Vercel                        |
+-------------------------------------------------------------+
|                  Wallet Adapter Layer                       |
|     @provablehq/aleo-wallet-adaptor-react (Official)        |
|       Shield Wallet (primary)  |  Leo Wallet                |
+-------------------------------------------------------------+
|                   Backend (Express)                         |
|        Off-chain indexing + AES-256-GCM encryption          |
|                   Deployed on Render                        |
+-------------------------------------------------------------+
|                  Supabase (PostgreSQL)                      |
|          circles, members, contributions, payouts           |
+-------------------------------------------------------------+
|                    Aleo Testnet                              |
|  zk_circles_v6.aleo + credits.aleo                          |
|  (transfer_public_as_signer / transfer_public)              |
+-------------------------------------------------------------+
```

---

## Smart Contract

**Deployed program:** `zk_circles_v6.aleo`
**Deployment TX:** `at1z5rendz2gtpeq7u2ldsnmy8mrcvlxasn373n9j5j54v8t32lxcrsq7u7wh`

### Transitions

| Function | Description | credits.aleo |
|---|---|---|
| `create_circle` | Create a new savings circle | -- |
| `join_circle` | Join a forming circle | -- |
| `contribute` | Contribute for the current cycle | `transfer_public_as_signer` to program address |
| `claim_payout` | Claim the pot when it's your turn | `transfer_public` to winner |
| `transfer_membership` | Transfer your position to another address | -- |
| `verify_membership` | Assert on-chain membership | -- |
| `cancel_circle` | Cancel a forming circle (creator only) | -- |

### Records (private, encrypted for owner)

| Record | Fields |
|---|---|
| `CircleMembership` | `owner`, `circle_id`, `contribution_amount` |
| `ContributionReceipt` | `owner`, `circle_id`, `cycle`, `amount` |
| `PayoutReceipt` | `owner`, `circle_id`, `cycle` |

### Mappings (public on-chain state)

| Mapping | Key -> Value |
|---|---|
| `circles` | `circle_id: field` -> `CircleInfo` |
| `members` | `BHP256(circle_id, member_addr)` -> `join_order: u8` |
| `contributions` | `BHP256(circle_id, cycle, member_addr)` -> `bool` |

### Privacy Design

- Member addresses are **never stored in plain text** -- all mapping keys are BHP256 hashes
- Membership and contribution proofs are **private records** owned by the user's key
- Circle names are **encrypted off-chain** with AES-256-GCM; only the `circle_id` field hash appears on-chain
- Circle IDs are derived off-chain as `BHP256(creator + name + salt)` so the circle name is never on-chain

---

## Project Structure

```
LeoCircles/
├── contracts/
│   └── zk_circles/
│       ├── src/main.leo          # Core ROSCA smart contract
│       └── program.json
├── frontend/
│   └── src/
│       ├── components/           # Header, Layout, WalletButton, Footer, etc.
│       ├── pages/                # Home, CreateCircle, JoinCircle, CircleDetail,
│       │                         # MyCircles, Explorer, Analytics, HowItWorks, Privacy
│       ├── hooks/                # useCreateCircle, useJoinCircle, useContribute,
│       │                         # useClaimPayout, useTransferMembership,
│       │                         # useVerifyMembership, useAnalytics, useCircles, etc.
│       ├── utils/
│       │   ├── transactionTracker.ts
│       │   ├── membershipCache.ts
│       │   ├── recordResolver.ts
│       │   ├── onChainQuery.ts
│       │   └── walletErrors.ts
│       ├── services/api.ts
│       └── config.ts
├── backend/
│   ├── index.js
│   ├── encryption.js
│   └── schema.sql
└── README.md
```

---

## Running Locally

### Prerequisites

- Node.js >= 18
- [Shield Wallet](https://www.shieldwallet.xyz/) browser extension (recommended)
- [Supabase](https://supabase.com) project (free tier works)

### 1. Clone

```bash
git clone https://github.com/aamer1932002-dev/ZkCircles.git
cd ZkCircles
```

### 2. Backend

```bash
cd backend
npm install

# Create .env:
# SUPABASE_URL=<your supabase url>
# SUPABASE_ANON_KEY=<your anon key>
# ENCRYPTION_KEY=<64 hex chars>
# PORT=3001

# Run schema in Supabase SQL Editor (paste backend/schema.sql)

npm start
```

### 3. Frontend

```bash
cd frontend
npm install

# Optional .env (defaults point to production):
# VITE_BACKEND_URL=http://localhost:3001
# VITE_PROGRAM_ID=zk_circles_v6.aleo

npm run dev
# Open http://localhost:5173
```

---

## Production Deployment

| Service | Config |
|---|---|
| Frontend | Vercel -- root dir: `frontend` |
| Backend | Render -- root dir: `backend`, start cmd: `node index.js` |

**Vercel environment variables:**
- `VITE_BACKEND_URL` -- Render service URL (e.g. `https://zkcircles.onrender.com`)
- `VITE_PROGRAM_ID` -- `zk_circles_v6.aleo`

**Render environment variables:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ENCRYPTION_KEY`, `PORT`

---

## Wallet Integration

```typescript
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield'
import { LeoWalletAdapter } from '@provablehq/aleo-wallet-adaptor-leo'

const wallets = [
  new ShieldWalletAdapter(),
  new LeoWalletAdapter({ appName: 'ZkCircles' }),
]
```

All transactions use `privateFee: false` (required for Shield Wallet):

```typescript
await executeTransaction({
  program: 'zk_circles_v6.aleo',
  function: 'contribute',
  inputs: [membershipRecord, cycle + 'u8'],
  fee: 1_000_000,
  privateFee: false,
  recordIndices: [0],
})
```

---

## Roadmap

### Completed

| Feature | Description |
|---|---|
| Smart Contract (v6) | Deployed `zk_circles_v6.aleo` on Aleo Testnet |
| Full ROSCA flow | Create, Join, Contribute, Claim across all cycles |
| Shield Wallet support | Shield temp ID resolution; `privateFee: false` |
| Leo Wallet support | Full adapter integration |
| Privacy-first design | BHP256 hashed member keys, encrypted circle names |
| Record type guards | Rejects wrong-type plaintexts before transaction submission |
| Membership caching | 3-layer fallback: wallet, localStorage, chain fetch |
| Transaction tracker | Explorer polling with Shield temp ID resolution |
| Analytics | Per-cycle contribution history, member breakdown, payout schedule |
| Backend indexing | Express + Supabase with AES-256-GCM encrypted metadata |
| On-chain pre-flight | Live chain state checked before every transaction |

### Next Wave

| Feature | Priority | Description |
|---|---|---|
| Circle invite links | High | Share a URL to invite members directly to a forming circle |
| Multi-cycle dashboard | Medium | Visual timeline of all past and upcoming payout cycles |
| Auto-contribution | Low | Scheduled contributions so members never miss a cycle |
| Dispute resolution | Low | On-chain mechanism for handling missed contributions |
| zkEmail integration | Low | Verify real-world identity via ZK email proofs for trusted circles |

---

## Resources

- [Aleo Developer Docs](https://developer.aleo.org/)
- [Leo Language Reference](https://developer.aleo.org/leo/)
- [Shield Wallet](https://www.shieldwallet.xyz/)
- [Aleo Testnet Explorer](https://explorer.aleo.org/)
- [Supabase Docs](https://supabase.com/docs)

---

Built with love for communities worldwide

*Aleo Buildathon 2026*
