# ZkCircles 🔐

**Trustless, Zero-Knowledge Rotating Savings and Credit Associations on Aleo**

ZkCircles brings the centuries-old tradition of community savings circles (ROSCAs/chit funds/tandas) to the blockchain with full privacy using Aleo's zero-knowledge technology.

![License](https://img.shields.io/badge/license-MIT-amber)
![Aleo](https://img.shields.io/badge/Aleo-Testnet-forest)
![Leo](https://img.shields.io/badge/Leo-v0.1.0-terra)

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
- **🌐 Global Access** - Anyone with an Aleo wallet can participate
- **💰 Flexible Circles** - 2-12 members, customizable contributions and durations
- **📱 Modern UI** - Warm, community-focused design celebrating ROSCA heritage
- **🔗 On-Chain Verification** - All state changes verified by Aleo network

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│              Vite + TypeScript + Tailwind CSS               │
├─────────────────────────────────────────────────────────────┤
│                  Wallet Adapter Layer                       │
│            Leo Wallet / Puzzle Wallet Integration           │
├─────────────────────────────────────────────────────────────┤
│                   Backend (Express)                         │
│          Off-chain indexing + Encrypted storage             │
├─────────────────────────────────────────────────────────────┤
│                  Supabase (PostgreSQL)                      │
│               Database with RLS policies                    │
├─────────────────────────────────────────────────────────────┤
│                    Aleo Blockchain                          │
│            Leo Smart Contracts (ZK execution)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
LeoCircles/
├── contracts/
│   └── zk_circles/
│       ├── src/
│       │   └── main.leo         # Core ROSCA smart contract
│       └── program.json         # Leo program configuration
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Application pages
│   │   ├── hooks/               # Custom React hooks for Aleo
│   │   ├── services/            # API client
│   │   └── utils/               # Helper functions
│   ├── tailwind.config.js       # Custom theme configuration
│   └── package.json
├── backend/
│   ├── index.js                 # Express API server
│   ├── encryption.js            # AES-256-GCM encryption
│   ├── schema.sql               # Supabase database schema
│   └── .env.example
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **Leo** (Aleo's programming language) - [Install Leo](https://developer.aleo.org/leo/installation)
- **Aleo Wallet** - [Leo Wallet](https://www.leo.app/) or [Puzzle Wallet](https://puzzle.online/)
- **Supabase Account** - [Create free account](https://supabase.com)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/LeoCircles.git
cd LeoCircles
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

## 🔧 Smart Contract Functions

### Transitions

| Function | Description |
|----------|-------------|
| `create_circle` | Create a new savings circle with parameters |
| `join_circle` | Join an existing circle (requires invitation) |
| `contribute` | Make a contribution for the current cycle |
| `claim_payout` | Claim your payout when it's your turn |

### Records (Private)

- `CircleMembership` - Proves membership in a circle
- `ContributionReceipt` - Proof of contribution
- `PayoutReceipt` - Proof of received payout

### Mappings (Public)

- `circles` - Circle metadata
- `circle_states` - Current state of each circle
- `members` - Member count per circle
- `contributions` - Contribution tracking

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
- [Aleo Wallet Adapter](https://github.com/ProvablHQ/aleo-wallet-adaptor-react)
- [Supabase Documentation](https://supabase.com/docs)

---

## ⚠️ Disclaimer

This project is for educational purposes. Smart contracts have not been audited. Use at your own risk on testnet only.

---

<p align="center">
  <strong>Built with 🧡 for communities worldwide</strong>
</p>
