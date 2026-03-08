/**
 * FLARE Crypto Utilities
 * Encrypts email content in IndexedDB using AES-GCM.
 * Your emails are so private even we can't read them. (We promise we tried.)
 */

const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const STORAGE_KEY = "flare_device_key"

/** Get or create a persistent encryption key for this device */
export async function getDeviceKey(): Promise<CryptoKey> {
  if (typeof window === "undefined") throw new Error("Crypto only runs client-side")

  let rawKey = localStorage.getItem(STORAGE_KEY)

  if (!rawKey) {
    const key = await crypto.subtle.generateKey(
      { name: ALGORITHM, length: KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    )
    const exported = await crypto.subtle.exportKey("raw", key)
    rawKey = btoa(String.fromCharCode(...new Uint8Array(exported)))
    localStorage.setItem(STORAGE_KEY, rawKey)
    return key
  }

  const rawBytes = Uint8Array.from(atob(rawKey), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey("raw", rawBytes, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ])
}

export async function encrypt(text: string): Promise<string> {
  const key = await getDeviceKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(text)
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded)
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.byteLength)
  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(cipher: string): Promise<string> {
  const key = await getDeviceKey()
  const combined = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}
