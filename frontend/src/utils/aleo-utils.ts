/**
 * Aleo utility functions for ZkCircles
 */

/**
 * Generate a random 128-bit salt as a field element
 * Uses crypto.getRandomValues for secure randomness
 */
export function generateSalt(): string {
  const randomBytes = new Uint8Array(16) // 128 bits
  crypto.getRandomValues(randomBytes)
  
  // Convert to BigInt and then to field string
  let value = BigInt(0)
  for (let i = 0; i < randomBytes.length; i++) {
    value = (value << BigInt(8)) | BigInt(randomBytes[i])
  }
  
  // Ensure it's within the field range (for Aleo's scalar field)
  // The Aleo scalar field is approximately 2^253
  const fieldModulus = BigInt('8444461749428370424248824938781546531375899335154063827935233455917409239041')
  value = value % fieldModulus
  
  return `${value}field`
}

/**
 * Hash a string to a field element using a simple hash
 * In production, this would use BHP256 via the wallet
 */
export async function hashToField(input: string): Promise<string> {
  // Use Web Crypto API to hash the input
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  
  // Convert to BigInt
  let value = BigInt(0)
  for (let i = 0; i < hashArray.length; i++) {
    value = (value << BigInt(8)) | BigInt(hashArray[i])
  }
  
  // Reduce modulo field size
  const fieldModulus = BigInt('8444461749428370424248824938781546531375899335154063827935233455917409239041')
  value = value % fieldModulus
  
  return `${value}field`
}

/**
 * Parse a field value from an Aleo record
 */
export function parseFieldValue(value: string): string {
  if (!value) return '0'
  return value.replace('field', '').replace('.private', '').replace('.public', '')
}

/**
 * Parse a u64 value from an Aleo record
 */
export function parseU64Value(value: string): number {
  if (!value) return 0
  const cleaned = value.replace('u64', '').replace('.private', '').replace('.public', '')
  return parseInt(cleaned, 10)
}

/**
 * Parse a u8 value from an Aleo record
 */
export function parseU8Value(value: string): number {
  if (!value) return 0
  const cleaned = value.replace('u8', '').replace('.private', '').replace('.public', '')
  return parseInt(cleaned, 10)
}

/**
 * Parse a u32 value from an Aleo record
 */
export function parseU32Value(value: string): number {
  if (!value) return 0
  const cleaned = value.replace('u32', '').replace('.private', '').replace('.public', '')
  return parseInt(cleaned, 10)
}

/**
 * Parse an address from an Aleo record
 */
export function parseAddressValue(value: string): string {
  if (!value) return ''
  return value.replace('.private', '').replace('.public', '')
}

/**
 * Format microcredits to ALEO display value
 */
export function formatAleo(microcredits: number): string {
  return (microcredits / 1_000_000).toFixed(6)
}

/**
 * Format a short address for display
 */
export function shortenAddress(address: string, chars = 6): string {
  if (!address) return ''
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

/**
 * Convert days to approximate block count
 * Assumes ~1 block per 3.6 seconds, ~24000 blocks per day
 */
export function daysToBlocks(days: number): number {
  return Math.floor(days * 24000)
}

/**
 * Convert blocks to approximate days
 */
export function blocksToDays(blocks: number): number {
  return blocks / 24000
}

/**
 * Validate an Aleo address format
 */
export function isValidAleoAddress(address: string): boolean {
  if (!address) return false
  // Aleo addresses start with 'aleo1' and are 63 characters long
  return /^aleo1[a-z0-9]{58}$/.test(address)
}

/**
 * Generate a shareable invite link for a circle
 */
export function generateInviteLink(circleId: string): string {
  const baseUrl = window.location.origin
  return `${baseUrl}/join/${circleId}`
}
