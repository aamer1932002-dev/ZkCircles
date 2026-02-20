/**
 * AES-256-GCM Encryption for ZkCircles
 * Encrypts sensitive data before storing in database
 */

const crypto = require('crypto')

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 
  'default_dev_key_32_bytes_long!!!' // 32 bytes for AES-256

// Convert hex key to buffer if provided as hex
const getKeyBuffer = () => {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    console.warn('Warning: Using default encryption key. Set ENCRYPTION_KEY in production.')
    return Buffer.from('default_dev_key_32_bytes_long!!!')
  }
  
  // If key is 64 characters, it's hex encoded
  if (key.length === 64) {
    return Buffer.from(key, 'hex')
  }
  
  // Otherwise use as-is (must be 32 bytes)
  return Buffer.from(key)
}

const KEY = getKeyBuffer()
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Encrypt a string value
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Base64 encoded encrypted string with IV and auth tag
 */
function encrypt(text) {
  if (!text) return text
  
  try {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH)
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })
    
    // Encrypt
    let encrypted = cipher.update(text, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])
    
    // Get auth tag
    const authTag = cipher.getAuthTag()
    
    // Combine IV + authTag + encrypted data
    const combined = Buffer.concat([iv, authTag, encrypted])
    
    return combined.toString('base64')
  } catch (error) {
    console.error('Encryption error:', error)
    return text // Return original on error (for development)
  }
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedText - Base64 encoded encrypted string
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText
  
  try {
    // Decode from base64
    const combined = Buffer.from(encryptedText, 'base64')
    
    // Extract IV, authTag, and encrypted data
    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })
    decipher.setAuthTag(authTag)
    
    // Decrypt
    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    
    return decrypted.toString('utf8')
  } catch (error) {
    console.error('Decryption error:', error)
    return encryptedText // Return original on error (for development)
  }
}

/**
 * Generate a new encryption key
 * @returns {string} - Hex encoded 32-byte key
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex')
}

module.exports = {
  encrypt,
  decrypt,
  generateEncryptionKey,
}
