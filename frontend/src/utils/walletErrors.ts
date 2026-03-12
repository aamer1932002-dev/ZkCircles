/**
 * Helpers for dealing with Shield / Leo wallet permission errors.
 *
 * When a user was previously connected with an older program version, the
 * wallet extension caches the allowed-programs list from that session.
 * Any executeTransaction call against a newer program name is rejected with:
 *   "zk_circles_vX.aleo is not in the allowed programs, request it when connect"
 *
 * The fix is to disconnect, which clears the cached session, and then
 * prompt the user to reconnect — the AleoWalletProvider will send the
 * updated programs list to the extension on the new connection.
 */

export const STALE_PERMISSIONS_EVENT = 'wallet-stale-permissions'

export function isStalePermissionsError(msg: string): boolean {
  return msg.includes('not in the allowed programs') ||
    msg.includes('request it when connect')
}

export const STALE_PERMISSIONS_USER_MSG =
  'Your wallet session is stale. Please reconnect your wallet — it will be prompted automatically.'

/** Fire a custom DOM event so WalletButton can open the reconnect modal. */
export function dispatchStalePermissionsEvent(): void {
  window.dispatchEvent(new CustomEvent(STALE_PERMISSIONS_EVENT))
}

/**
 * When Shield Wallet tries to use a record that isn't in its local index yet
 * (e.g. the wallet hasn't synced after the previous transaction), executeTransaction
 * throws an error with one of these phrases.
 */
export function isRecordNotFoundError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    lower.includes('record not found') ||
    lower.includes('record is not in') ||
    lower.includes('unspent record') ||
    lower.includes('failed to find record') ||
    lower.includes('cannot find record') ||
    lower.includes('record does not exist')
  )
}

export const RECORD_NOT_FOUND_USER_MSG =
  'Your wallet has not yet synced the latest membership record.\n\n' +
  '• Open Shield Wallet → tap the sync/refresh icon\n' +
  '• Wait 30–60 seconds, then try again\n' +
  '• If the issue persists, disconnect and reconnect your wallet'
