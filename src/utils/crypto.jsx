
/**
 * Simple data encryption and decryption modules (XOR & Caesar Ciphers)
 */

// Simple Caesar Cipher for demonstration overhead
export function encryptData(text, shift = 3) {
  return text
    .split('')
    .map(char => String.fromCharCode(char.charCodeAt(0) + shift))
    .join('');
}

export function decryptData(text, shift = 3) {
  return text
    .split('')
    .map(char => String.fromCharCode(char.charCodeAt(0) - shift))
    .join('');
}
