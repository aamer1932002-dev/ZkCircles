# ZkCircles 🔐

**Trustless, Zero-Knowledge Rotating Savings and Credit Associations on Aleo**

ZkCircles brings the centuries-old tradition of community savings circles (ROSCAs/chit funds/tandas) to the blockchain with full privacy using Aleo's zero-knowledge technology.

![License](https://img.shields.io/badge/license-MIT-amber)
![Aleo](https://img.shields.io/badge/Aleo-Testnet-forest)
![Leo](https://img.shields.io/badge/Leo-v0.1.0-terra)
![Status](https://img.shields.io/badge/Status-Wave%203%20Complete-brightgreen)

---

## 🎯 Wave 3 Progress

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
