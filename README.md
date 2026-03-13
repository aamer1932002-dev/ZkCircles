# ZkCircles ðŸ”

**Trustless, Zero-Knowledge Rotating Savings and Credit Associations on Aleo**

ZkCircles brings the centuries-old tradition of community savings circles (ROSCAs/chit funds/tandas) to the blockchain with full privacy using Aleo's zero-knowledge technology.

![License](https://img.shields.io/badge/license-MIT-amber)
![Aleo](https://img.shields.io/badge/Aleo-Testnet-brightgreen)
![Program](https://img.shields.io/badge/Program-zk__circles__v6.aleo-blue)

---

## ðŸŒ What are ROSCAs?

Rotating Savings and Credit Associations have been trusted by communities worldwide for centuries â€” known as Tandas (Latin America), Chit Funds (India), Susu (West Africa), and Hui (China). Members contribute fixed amounts each cycle, and one member receives the entire pot per cycle. ZkCircles digitises this trust with cryptographic guarantees on Aleo.

---

## âœ¨ What's Working

- **Create a circle** â€” set contribution amount, member count (2â€“20), and total cycles
- **Join a circle** â€” any wallet holder can join a forming circle
- **Contribute** â€” send your contribution for the current cycle via `credits.aleo/transfer_public_as_signer`
- **Claim payout** â€” the cycle winner claims the full pot via `credits.aleo/transfer_public`
- **Transfer membership** â€” pass your circle position to another address
- **Verify membership** â€” on-chain proof that an address is a member
- **Cancel circle** â€” creator can cancel a circle while it is still forming
- **Explorer** â€” browse all circles on the platform
- **Analytics** â€” per-circle contribution history, member breakdown, payout schedule (accessible from the circle detail page)
- **On-chain pre-flight checks** â€” queries live chain state before every transaction to catch errors upfront
- **Transaction confirmation tracking** â€” polls the Aleo explorer until accepted or rejected; resolves Shield Wallet temporary IDs to real on-chain TX IDs
- **Shield Wallet** â€” primary tested wallet with full `privateFee: false` support

---

## ðŸ—ï¸ Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     Frontend (React)                        â”‚
â”‚              Vite + TypeScript + Tailwind CSS               â”‚
â”‚                   Deployed on Vercel                        â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                  Wallet Adapter Layer                       â”‚
â”‚     @provablehq/aleo-wallet-adaptor-react (Official)        â”‚
â”‚       ðŸ›¡ï¸ Shield Wallet (primary)  |  ðŸ¦ Leo Wallet          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                   Backend (Express)                         â”‚
â”‚        Off-chain indexing + AES-256-GCM encryption          â”‚
â”‚                   Deployed on Render                        â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                  Supabase (PostgreSQL)                      â”‚
â”‚          circles Â· members Â· contributions Â· payouts        â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                    Aleo Testnet                              â”‚
â”‚  zk_circles_v6.aleo + credits.aleo                          â”‚
â”‚  (transfer_public_as_signer / transfer_public)              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## ðŸ“œ Smart Contract

**Deployed program:** `zk_circles_v6.aleo`
**Deployment TX:** `at1z5rendz2gtpeq7u2ldsnmy8mrcvlxasn373n9j5j54v8t32lxcrsq7u7wh`

### Transitions

| Function | Description | credits.aleo |
|---|---|---|
| `create_circle` | Create a new savings circle | â€” |
| `join_circle` | Join a forming circle | â€” |
| `contribute` | Contribute for the current cycle | âœ… `transfer_public_as_signer` â†’ program address |
| `claim_payout` | Claim the pot when it's your turn | âœ… `transfer_public` â†’ winner |
| `transfer_membership` | Transfer your position to another address | â€” |
| `verify_membership` | Assert on-chain membership | â€” |
| `cancel_circle` | Cancel a forming circle (creator only) | â€” |

### Records (private, encrypted for owner)

| Record | Fields |
|---|---|
| `CircleMembership` | `owner`, `circle_id`, `contribution_amount` |
| `ContributionReceipt` | `owner`, `circle_id`, `cycle`, `amount` |
| `PayoutReceipt` | `owner`, `circle_id`, `cycle` |

### Mappings (public on-chain state)

| Mapping | Key â†’ Value |
|---|---|
| `circles` | `circle_id: field` â†’ `CircleInfo` |
| `members` | `BHP256(circle_id, member_addr)` â†’ `join_order: u8` |
| `contributions` | `BHP256(circle_id, cycle, member_addr)` â†’ `bool` |

### Privacy Design

- Member addresses are **never stored in plain text** â€” all mapping keys are BHP256 hashes
- Membership and contribution proofs are **private records** owned by the user's key
- Circle names are **encrypted off-chain** with AES-256-GCM; only the `circle_id` field hash appears on-chain
- Circle IDs are derived off-chain as `BHP256(creator + name + salt)` so the circle name is never on-chain

---

## ðŸ“ Project Structure

```
LeoCircles/
â”œâ”€â”€ contracts/
â”‚   â””â”€â”€ zk_circles/
â”‚       â”œâ”€â”€ src/main.leo          # Core ROSCA smart contract
â”‚       â””â”€â”€ program.json
â”œâ”€â”€ frontend/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ components/           # Header, Layout, WalletButton, Footer, etc.
â”‚   â”‚   â”œâ”€â”€ pages/                # Home, CreateCircle, JoinCircle, CircleDetail,
â”‚   â”‚   â”‚                         # MyCircles, Explorer, Analytics, HowItWorks, Privacy
â”‚   â”‚   â”œâ”€â”€ hooks/                # useCreateCircle, useJoinCircle, useContribute,
â”‚   â”‚   â”‚                         # useClaimPayout, useTransferMembership,
â”‚   â”‚   â”‚                         # useVerifyMembership, useAnalytics, useCircles, etc.
â”‚   â”‚   â”œâ”€â”€ utils/
â”‚   â”‚   â”‚   â”œâ”€â”€ transactionTracker.ts   # Polls explorer; resolves Shield temp IDs
â”‚   â”‚   â”‚   â”œâ”€â”€ membershipCache.ts      # localStorage cache + chain fetch for records
â”‚   â”‚   â”‚   â”œâ”€â”€ recordResolver.ts       # Record type validation + wallet polling
â”‚   â”‚   â”‚   â”œâ”€â”€ onChainQuery.ts         # Reads live circles/members/contributions mappings
â”‚   â”‚   â”‚   â””â”€â”€ walletErrors.ts         # Error classification helpers
â”‚   â”‚   â”œâ”€â”€ services/api.ts       # Backend API client with localStorage fallback
â”‚   â”‚   â””â”€â”€ config.ts             # PROGRAM_ID, BACKEND_URL, fee constants
â”‚   â””â”€â”€ package.json
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ index.js                  # Express API (circles, members, contributions, payouts, analytics)
â”‚   â”œâ”€â”€ encryption.js             # AES-256-GCM helpers
â”‚   â””â”€â”€ schema.sql                # Supabase table definitions
â””â”€â”€ README.md
```

---

## ðŸš€ Running Locally

### Prerequisites

- Node.js â‰¥ 18
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

# Create .env with:
# SUPABASE_URL=<your supabase url>
# SUPABASE_ANON_KEY=<your anon key>
# ENCRYPTION_KEY=<64 hex chars>
# PORT=3001

# Generate ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

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
# â†’ http://localhost:5173
```

---

## ðŸŒ Production Deployment

| Service | Config |
|---|---|
| Frontend | Vercel â€” root dir: `frontend` |
| Backend | Render â€” root dir: `backend`, start cmd: `node index.js` |

**Vercel environment variables:**
- `VITE_BACKEND_URL` â€” Render service URL (e.g. `https://zkcircles.onrender.com`)
- `VITE_PROGRAM_ID` â€” `zk_circles_v6.aleo`

**Render environment variables:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ENCRYPTION_KEY`, `PORT`

---

## ðŸ”Œ Wallet Integration

```typescript
// main.tsx
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
  inputs: [membershipRecord, `${cycle}u8`],
  fee: 1_000_000,
  privateFee: false,
  recordIndices: [0],
})
```

---

## ðŸ—ºï¸ Roadmap

### âœ… Completed

| Feature | Description |
|---|---|
| Smart Contract (v6) | Deployed `zk_circles_v6.aleo` on Aleo Testnet |
| Full ROSCA flow | Create â†’ Join â†’ Contribute â†’ Claim across all cycles |
| Shield Wallet support | `shield_` temp ID resolution; `privateFee: false` |
| Leo Wallet support | Full adapter integration |
| Privacy-first design | BHP256 hashed member keys, encrypted circle names |
| Record type guards | Rejects wrong-type plaintexts before transaction submission |
| Membership caching | 3-layer fallback: wallet â†’ localStorage â†’ chain fetch |
| Transaction tracker | Explorer polling with Shield temp ID resolution |
| Analytics | Per-cycle contribution history, member breakdown, payout schedule |
| Backend indexing | Express + Supabase with AES-256-GCM encrypted metadata |
| On-chain pre-flight | Live chain state checked before every transaction |

### ðŸš§ Next Wave

| Feature | Priority | Description |
|---|---|---|
| Mainnet deployment | High | Audit and deploy to Aleo Mainnet |
| Circle invite links | High | Share a URL to invite members directly to a forming circle |
| Push notifications | Medium | Alert members when it's their turn to contribute or claim |
| Mobile-responsive UI | Medium | Optimised layout for phones and tablets |
| Multi-cycle dashboard | Medium | Visual timeline of all past and upcoming payout cycles |
| Auto-contribution | Low | Scheduled contributions so members never miss a cycle |
| Dispute resolution | Low | On-chain mechanism for handling missed contributions |
| zkEmail integration | Low | Verify real-world identity via ZK email proofs for trusted circles |

---

## ðŸ”— Resources

- [Aleo Developer Docs](https://developer.aleo.org/)
- [Leo Language Reference](https://developer.aleo.org/leo/)
- [Shield Wallet](https://www.shieldwallet.xyz/)
- [Aleo Testnet Explorer](https://explorer.aleo.org/)
- [Supabase Docs](https://supabase.com/docs)

---

<p align="center">
  <strong>Built with ðŸ§¡ for communities worldwide</strong><br>
  <em>Aleo Buildathon 2026</em>
</p>