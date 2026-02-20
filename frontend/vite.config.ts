import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    include: [
      '@provablehq/aleo-wallet-adaptor-react',
      '@provablehq/aleo-wallet-adaptor-core',
      '@provablehq/aleo-wallet-adaptor-shield',
      '@provablehq/aleo-wallet-adaptor-leo',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'wallet-adapter': [
            '@provablehq/aleo-wallet-adaptor-core',
            '@provablehq/aleo-wallet-adaptor-react',
            '@provablehq/aleo-wallet-adaptor-leo',
            '@provablehq/aleo-wallet-adaptor-shield',
          ],
        },
      },
    },
  },
})
