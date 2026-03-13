# ZkCircles 🔐

**Trustless, Zero-Knowledge Rotating Savings and Credit Associations on Aleo**

ZkCircles brings the centuries-old tradition of community savings circles (ROSCAs/chit funds/tandas) to the blockchain with full privacy using Aleo's zero-knowledge technology.

![License](https://img.shields.io/badge/license-MIT-amber)
![Aleo](https://img.shields.io/badge/Aleo-Testnet-brightgreen)
![Program](https://img.shields.io/badge/Program-zk__circles__v6.aleo-blue)

---

## � What are ROSCAs?

Rotating Savings and Credit Associations have been trusted by communities worldwide for centuries — known as Tandas (Latin America), Chit Funds (India), Susu (West Africa), and Hui (China). Members contribute fixed amounts each cycle, and one member receives the entire pot per cycle. ZkCircles digitises this trust with cryptographic guarantees on Aleo.

---

## ✨ What's Working

- **Create a circle** — set contribution amount, member count (2–20), and total cycles
- **Join a circle** — any wallet holder can join a forming circle
- **Contribute** — send your contribution for the current cycle via `credits.aleo/transfer_public_as_signer`
- **Claim payout** — the cycle winner claims the full pot via `credits.aleo/transfer_public`
- **Transfer membership** — pass your circle position to another address
- **Verify membership** — on-chain proof that an address is a member
- **Cancel circle** — creator can cancel a circle while it is still forming
- **Explorer** — browse all circles on the platform
- **Analytics** — per-circle contribution history, member breakdown, payout schedule (accessible from the circle detail page)
- **On-chain pre-flight checks** — queries live chain state before every transaction to catch errors upfront
- **Transaction confirmation tracking** — polls the Aleo explorer until accepted or rejected; resolves Shield Wallet temporary IDs to real on-chain TX IDs
- **Shield Wallet** — primary tested wallet with full `privateFee: false` support

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│              Vite + TypeScript + Tailwind CSS               │
│                   Deployed on Vercel                        │
├─────────────────────────────────────────────────────────────┤
│                  Wallet Adapter Layer                       │
│     @provablehq/aleo-wallet-adaptor-react (Official)        │
│       🛡️ Shield Wallet (primary)  |  🦁 Leo Wallet          │
├─────────────────────────────────────────────────────────────┤
│                   Backend (Express)                         │
│        Off-chain indexing + AES-256-GCM encryption          │
│                   Deployed on Render                        │
├─────────────────────────────────────────────────────────────┤
│                  Supabase (PostgreSQL)                      │
│          circles · members · contributions · payouts        │
├─────────────────────────────────────────────────────────────┤
│                    Aleo Testnet                              │
│  zk_circles_v6.aleo + credits.aleo                          │
│  (transfer_public_as_signer / transfer_public)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📜 Smart Contract

**Deployed program:** `zk_circles_v6.aleo`  
**Deployment TX:** `at1z5rendz2gtpeq7u2ldsnmy8mrcvlxasn373n9j5j54v8t32lxcrsq7u7wh`

### Transitions

| Function | Description | credits.aleo |
|---|---|---|
| `create_circle` | Create a new savings circle | — |
| `join_circle` | Join a forming circle | — |
| `contribute` | Contribute for the current cycle | ✅ `transfer_public_as_signer` → program address |
| `claim_payout` | Claim the pot when it's your turn | ✅ `transfer_public` → winner |
| `transfer_membership` | Transfer your position to another address | — |
| `verify_membership` | Assert on-chain membership | — |
| `cancel_circle` | Cancel a forming circle (creator only) | — |

### Records (private, encrypted for owner)

| Record | Fields |
|---|---|
| `CircleMembership` | `owner`, `circle_id`, `contribution_amount` |
| `ContributionReceipt` | `owner`, `circle_id`, `cycle`, `amount` |
| `PayoutReceipt` | `owner`, `circle_id`, `cycle` |

### Mappings (public on-chain state)

| Mapping | Key → Value |
|---|---|
| `circles` | `circle_id: field` → `CircleInfo` |
| `members` | `BHP256(circle_id, member_addr)` → `join_order: u8` |
| `contributions` | `BHP256(circle_id, cycle, member_addr)` → `bool` |

### Privacy design

- Member addresses are **never stored in plain text** — all mapping keys are BHP256 hashes
- Membership and contribution proofs are **private records** owned by the user's key
- Circle names are **encrypted off-chain** with AES-256-GCM; only the `circle_id` field hash appears on-chain
- Circle IDs are derived off-chain as `BHP256(creator + name + salt)` so the circle name is never on-chain

---

## 📁 Project Structure

```
LeoCircles/
├── contracts/
│   └── zk_circles/
│       ├── src/main.leo          # Core ROSCA smart contract
│       └── program.json
├── frontend/
│   ├── src/
│   │   ├── components/           # Header, Layout, WalletButton, Footer, etc.
│   │   ├── pages/                # Home, CreateCircle, JoinCircle, CircleDetail,
│   │   │                         # MyCircles, Explorer, Analytics, HowItWorks, Privacy
│   │   ├── hooks/                # useCreateCircle, useJoinCircle, useContribute,
│   │   │                         # useClaimPayout, useTransferMembership,
│   │   │                         # useVerifyMembership, useAnalytics, useCircles, etc.
│   │   ├── utils/
│   │   │   ├── transactionTracker.ts   # Polls explorer; resolves Shield temp IDs
│   │   │   ├── membershipCache.ts      # localStorage cache + chain fetch for records
│   │   │   ├── recordResolver.ts       # Record type validation + wallet polling
│   │   │   ├── onChainQuery.ts         # Reads live circles/members/contributions mappings
│   │   │   └── walletErrors.ts         # Error classification helpers
│   │   ├── services/api.ts       # Backend API client with localStorage fallback
│   │   └── config.ts             # PROGRAM_ID, BACKEND_URL, fee constants
│   └── package.json
├── backend/
│   ├── index.js                  # Express API (circles, members, contributions, payouts, analytics)
│   ├── encryption.js             # AES-256-GCM helpers
│   └── schema.sql                # Supabase table definitions
└── README.md
```

---

## 🚀 Running Locally

### Prerequisites

- Node.js ≥ 18
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
# → http://localhost:5173
```

---

## 🌐 Production Deployment

| Service | Config |
|---|---|
| Frontend | Vercel — root dir: `frontend` |
| Backend | Render — root dir: `backend`, start cmd: `node index.js` |

**Vercel environment variables:**
- `VITE_BACKEND_URL` — Render service URL (e.g. `https://zkcircles.onrender.com`)
- `VITE_PROGRAM_ID` — `zk_circles_v6.aleo`

**Render environment variables:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ENCRYPTION_KEY`, `PORT`

---

## 🔌 Wallet Integration

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

## 🔗 Resources

- [Aleo Developer Docs](https://developer.aleo.org/)
- [Leo Language Reference](https://developer.aleo.org/leo/)
- [Shield Wallet](https://www.shieldwallet.xyz/)
- [Aleo Testnet Explorer](https://explorer.aleo.org/)
- [Supabase Docs](https://supabase.com/docs)

---

## ⚠️ Disclaimer

Deployed on Aleo Testnet only. Smart contracts have not been audited. Use at your own risk.

---

<p align="center">
  <strong>Built with 🧡 for communities worldwide</strong><br>
  <em>Aleo Buildathon 2026</em>
</p>


### ✅ Completed This Wave

| Feature | Status | Description |
|---------|--------|-------------|
| 🔌 Shield Wallet Integration | ✅ Done | Full support using `@provablehq/aleo-wallet-adaptor-shield` |
| 🦁 Leo Wallet Integration | ✅ Done | Full support using `@provablehq/aleo-wallet-adaptor-leo` |
| 💰 credits.aleo Integration | ✅ Done | Rule 4 compliant - real credit transfers via `transfer_private` |
| 📜 Smart Contract Deployed | ✅ Done | `zk_circles_v1.aleo` live on testnet |
| 🎨 Frontend UI | ✅ Done | Modern React + Tailwind with warm community design |
| 🗄️ Backend API | ✅ Done | Express + Supabase for off-chain indexing |
| 🔐 Encrypted Storage | ✅ Done | AES-256-GCM for sensitive metadata |

### 🚧 Next Wave (Wave 4)

| Feature | Priority | Description |
|---------|----------|-------------|
| 🧪 Full E2E Testing | High | Complete test coverage for all flows |
| 📊 Circle Dashboard | Medium | Analytics and contribution history |
| 🔔 Notifications | Medium | Email/Push for payout turns |
| 🌐 Mainnet Deployment | High | Production deployment with audited contracts |
| 📱 Mobile Responsive | Medium | Optimized mobile experience |
| 🔄 Auto-contribution | Low | Scheduled automatic contributions |

---

## 🌍 What are ROSCAs?

Rotating Savings and Credit Associations have been trusted by communities worldwide for centuries:
- **Tandas** (Latin America)
- **Chit Funds** (India)
- **Susu** (West Africa)
- **Hui** (China)
- **Tandas/Cundinas** (Mexico)

Members contribute fixed amounts regularly, and each cycle one member receives the entire pot. ZkCircles digitizes this trust with cryptographic guarantees.

---

## ✨ Features

- **🔒 Zero-Knowledge Privacy** - Contribution amounts and membership details remain private
- **📜 Trustless Execution** - Smart contracts enforce rules without intermediaries
- **💰 Real Credit Transfers** - Uses `credits.aleo/transfer_private` (Buildathon Rule 4 ✅)
- **🛡️ Shield Wallet Support** - Official `@provablehq/aleo-wallet-adaptor-shield`
- **🦁 Leo Wallet Support** - Official `@provablehq/aleo-wallet-adaptor-leo`
- **🌐 Global Access** - Anyone with an Aleo wallet can participate
- **💎 Flexible Circles** - 2-12 members, customizable contributions and durations
- **📱 Modern UI** - Warm, community-focused design celebrating ROSCA heritage
- **🔗 On-Chain Verification** - All state changes verified by Aleo network
- **🔐 Encrypted Storage** - Off-chain metadata protected with AES-256-GCM

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│              Vite + TypeScript + Tailwind CSS               │
├─────────────────────────────────────────────────────────────┤
│                  Wallet Adapter Layer                       │
│     @provablehq/aleo-wallet-adaptor-react (Official)        │
│          🛡️ Shield Wallet  |  🦁 Leo Wallet                 │
├─────────────────────────────────────────────────────────────┤
│                   Backend (Express)                         │
│          Off-chain indexing + Encrypted storage             │
├─────────────────────────────────────────────────────────────┤
│                  Supabase (PostgreSQL)                      │
│               Database with RLS policies                    │
├─────────────────────────────────────────────────────────────┤
│                    Aleo Blockchain                          │
│       zk_circles_v1.aleo + credits.aleo (Rule 4)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
LeoCircles/
├── contracts/
│   └── zk_circles/
│       ├── src/
│       │   └── main.leo              # Core ROSCA smart contract (deployed)
│       └── program.json              # Leo program configuration
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx            # Navigation with wallet button
│   │   │   └── WalletButton.tsx      # Custom wallet selector (Shield/Leo)
│   │   ├── pages/
│   │   │   ├── Home.tsx              # Landing page
│   │   │   ├── CreateCircle.tsx      # Create new circle
│   │   │   ├── JoinCircle.tsx        # Join existing circle
│   │   │   ├── CircleDetail.tsx      # Circle management
│   │   │   └── MyCircles.tsx         # User's circles dashboard
│   │   ├── hooks/
│   │   │   ├── useCreateCircle.ts    # Circle creation + Aleo tx
│   │   │   ├── useJoinCircle.ts      # Join circle + Aleo tx
│   │   │   ├── useContribute.ts      # Contribution + credits.aleo transfer
│   │   │   ├── useClaimPayout.ts     # Payout claiming
│   │   │   ├── useTransferMembership.ts  # Transfer membership
│   │   │   └── useVerifyMembership.ts    # On-chain verification
│   │   ├── services/api.ts           # Backend API client
│   │   └── main.tsx                  # App entry with wallet providers
│   ├── tailwind.config.js            # Custom theme configuration
│   └── package.json
├── backend/
│   ├── index.js                      # Express API server
│   ├── encryption.js                 # AES-256-GCM encryption
│   ├── schema.sql                    # Supabase database schema
│   └── .env                          # Environment configuration
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **Leo** (Aleo's programming language) - [Install Leo](https://developer.aleo.org/leo/installation)
- **Aleo Wallet** - One of:
  - 🛡️ [Shield Wallet](https://www.shieldwallet.xyz/) (Recommended)
  - 🦁 [Leo Wallet](https://www.leo.app/)
- **Supabase Account** - [Create free account](https://supabase.com)

### 1. Clone the Repository

```bash
git clone https://github.com/aamer1932002-dev/ZkCircles.git
cd ZkCircles
```

### 2. Deploy Smart Contract

```bash
cd contracts/zk_circles

# Build the contract
leo build

# Deploy to testnet (requires Aleo credits)
leo deploy --network testnet

# Note the deployed program address
```

### 3. Setup Database

1. Create a new Supabase project
2. Go to SQL Editor
3. Run the contents of `backend/schema.sql`
4. Copy your project URL and anon key

### 4. Configure Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env with your values:
# - SUPABASE_URL=your_supabase_url
# - SUPABASE_ANON_KEY=your_anon_key
# - ENCRYPTION_KEY=your_32_byte_hex_key
# - PORT=3001

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Start the server
npm start
```

### 5. Configure Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env with your values:
# - VITE_API_URL=http://localhost:3001
# - VITE_PROGRAM_ID=zk_circles.aleo (or your deployed address)

# Start development server
npm run dev
```

### 6. Open Application

Visit `http://localhost:5173` in your browser.

---

## � Deployment

### Deploy Frontend to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Set the root directory to `frontend`
4. Add environment variables:
   - `VITE_BACKEND_URL` = Your Render backend URL (e.g., `https://zkcircles-api.onrender.com`)
   - `VITE_PROGRAM_ID` = `zk_circles_v1.aleo`
   - `VITE_NETWORK` = `testnet`
   - `VITE_CIRCLE_POT_ADDRESS` = Your circle pot address
5. Deploy!

### Deploy Backend to Render

1. Go to [render.com](https://render.com) and create a new Web Service
2. Connect your GitHub repository
3. Set the root directory to `backend`
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
5. Add environment variables:
   - `SUPABASE_URL` = Your Supabase project URL
   - `SUPABASE_ANON_KEY` = Your Supabase anon key
   - `ENCRYPTION_KEY` = Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `PORT` = `3001`
6. Deploy!

### Post-Deployment

1. Update your Vercel frontend's `VITE_BACKEND_URL` to point to your Render backend URL
2. Redeploy the frontend if needed

---

## 🔧 Smart Contract Functions

### Deployed Program: `zk_circles_v1.aleo`

### Transitions

| Function | Description | Credits Integration |
|----------|-------------|---------------------|
| `create_circle` | Create a new savings circle with parameters | - |
| `join_circle` | Join an existing circle | - |
| `contribute` | Make a contribution for the current cycle | ✅ `credits.aleo/transfer_private` |
| `claim_payout` | Claim your payout when it's your turn | ✅ Receives from pot |
| `transfer_membership` | Transfer your position to another address | - |
| `verify_membership` | Verify membership on-chain | - |

### Records (Private)

- `CircleMembership` - Proves membership in a circle (owner, circle_id, join_order, salt)
- `ContributionReceipt` - Proof of contribution (circle_id, cycle, amount, timestamp)
- `PayoutReceipt` - Proof of received payout (circle_id, cycle, amount)

### Mappings (Public)

- `circles` - Circle configurations (contribution_amount, max_members, etc.)
- `circle_states` - Current state of each circle (current_cycle, members_joined)
- `members` - Member data per circle
- `contributions` - Contribution tracking per cycle
- `cycle_payouts` - Payout recipient tracking

---

## 🎨 Design Philosophy

ZkCircles uses a warm, community-focused design palette that celebrates the global heritage of ROSCAs:

| Color | Hex | Meaning |
|-------|-----|---------|
| Amber | `#F59E0B` | Trust & Prosperity |
| Terra | `#C2410C` | Community & Warmth |
| Forest | `#059669` | Growth & Stability |
| Cream | `#FFF8F0` | Openness & Welcome |
| Midnight | `#1E293B` | Security & Contrast |

---

## 🔐 Privacy Model

ZkCircles leverages Aleo's zero-knowledge proofs for privacy:

1. **Private Records** - Membership and contribution receipts are owned by users
2. **Hashed Identifiers** - Circle IDs use BHP256 hashing with private salts
3. **Off-chain Encryption** - Sensitive metadata encrypted with AES-256-GCM
4. **Selective Disclosure** - Users control what information to reveal

---

## 🔌 Wallet Integration

ZkCircles uses the official **@provablehq** wallet adapter packages:

```typescript
// Wallet Provider Setup (main.tsx)
import { AleoWalletProvider } from '@provablehq/aleo-wallet-adaptor-react'
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield'
import { LeoWalletAdapter } from '@provablehq/aleo-wallet-adaptor-leo'

const wallets = [
  new ShieldWalletAdapter(),
  new LeoWalletAdapter({ appName: 'ZkCircles' }),
]
```

### Transaction Pattern

All transactions use `executeTransaction` with `privateFee: false` for Shield Wallet compatibility:

```typescript
await executeTransaction({
  program: 'zk_circles_v1.aleo',
  function: 'contribute',
  inputs: [membershipRecord, circleId, cycleNumber],
  fee: 300_000, // 0.3 ALEO
  privateFee: false, // Critical for Shield Wallet
})
```

---

## 🛠️ Development

### Running Tests

```bash
# Smart contract tests
cd contracts/zk_circles
leo test

# Frontend tests
cd frontend
npm test

# Backend tests
cd backend
npm test
```

### Building for Production

```bash
# Frontend build
cd frontend
npm run build

# Output in frontend/dist/
```

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 🔗 Resources

- [Aleo Documentation](https://developer.aleo.org/)
- [Leo Language Guide](https://developer.aleo.org/leo/)
- [Provable Wallet Adapter](https://github.com/ProvablHQ/aleo-wallet-adaptor-react) - Official SDK
- [Shield Wallet](https://www.shieldwallet.xyz/)
- [Leo Wallet](https://www.leo.app/)
- [Supabase Documentation](https://supabase.com/docs)
- [Aleo Explorer](https://explorer.aleo.org/) - View transactions

---

## ⚠️ Disclaimer

This project is for educational purposes. Smart contracts have not been audited. Use at your own risk on testnet only.

---

<p align="center">
  <strong>Built with 🧡 for communities worldwide</strong>
  <br>
  <em>Aleo Buildathon 2026 - Wave 3 ✅</em>
</p>
