/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROGRAM_ID: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_NETWORK: string
  readonly VITE_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
