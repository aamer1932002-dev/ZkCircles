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
