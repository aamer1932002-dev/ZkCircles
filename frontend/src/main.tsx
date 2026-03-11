import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Aleo Wallet Adapters - Using Provable packages for Shield + Leo support
import { AleoWalletProvider } from '@provablehq/aleo-wallet-adaptor-react'
import { DecryptPermission } from '@provablehq/aleo-wallet-adaptor-core'
import { Network } from '@provablehq/aleo-types'
import { LeoWalletAdapter } from '@provablehq/aleo-wallet-adaptor-leo'
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield'
import { PROGRAM_ID } from './config'

// Configure wallets - Shield first for better UX, then Leo
const wallets = [
  new ShieldWalletAdapter(),
  new LeoWalletAdapter({ appName: 'ZkCircles' }),
]

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AleoWalletProvider
      wallets={wallets}
      decryptPermission={DecryptPermission.AutoDecrypt}
      programs={[PROGRAM_ID, 'credits.aleo']}
      network={Network.TESTNET}
      autoConnect={false}
      onError={(error) => {
        const msg = error.message ?? ''
        // Stale permissions: auto-disconnect so next connect re-registers programs
        if (msg.includes('not in the allowed programs') || msg.includes('request it when connect')) {
          window.dispatchEvent(new CustomEvent('wallet-stale-permissions'))
          return
        }
        // Swallow benign startup errors (extension not ready, no previous session)
        if (msg.includes('No response') || msg.includes('Wallet not selected')) return
        console.error('[WalletProvider]', msg)
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AleoWalletProvider>
  </React.StrictMode>,
)
