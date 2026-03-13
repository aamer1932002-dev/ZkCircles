import { useState, useCallback } from 'react'
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react'
import { createInvite, validateInvite, useInvite } from '../services/api'
import type { InviteData } from '../services/api'

export function useInviteLinks() {
  const wallet = useWallet() as any
  const { address } = wallet
  const [isCreating, setIsCreating] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  const generateInvite = useCallback(async (
    circleId: string,
    options?: { maxUses?: number; expiresInHours?: number },
  ): Promise<{ success: boolean; code?: string; link?: string; error?: string }> => {
    if (!address) return { success: false, error: 'Wallet not connected' }

    setIsCreating(true)
    const result = await createInvite({
      circleId,
      creatorAddress: address,
      maxUses: options?.maxUses,
      expiresInHours: options?.expiresInHours ?? 168,
    })

    if (result.success && result.code) {
      setInviteCode(result.code)
      const link = `${window.location.origin}/invite/${result.code}`
      setIsCreating(false)
      return { success: true, code: result.code, link }
    }

    setIsCreating(false)
    return { success: false, error: result.error }
  }, [address])

  const checkInvite = useCallback(async (code: string): Promise<InviteData | null> => {
    return validateInvite(code)
  }, [])

  const redeemInvite = useCallback(async (code: string): Promise<void> => {
    await useInvite(code)
  }, [])

  const copyInviteLink = useCallback(async (code: string) => {
    const link = `${window.location.origin}/invite/${code}`
    await navigator.clipboard.writeText(link)
  }, [])

  return {
    generateInvite,
    checkInvite,
    redeemInvite,
    copyInviteLink,
    isCreating,
    inviteCode,
  }
}
