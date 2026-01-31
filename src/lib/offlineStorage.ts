import { get, set, del, keys } from 'idb-keyval'

const PENDING_SIGNATURES_PREFIX = 'pending_sig_'

interface PendingSignature {
  id: string
  timestamp: number
  eventId: string
  kioskToken: string
  data: {
    sm_username: string
    phone: string
    first_name: string
    last_name: string
    email: string
    location: string
    language: 'no' | 'en'
    read_confirmed: boolean
    privacy_accepted: boolean
    signature_png_base64: string
  }
  encrypted: boolean
}

async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const storedKey = await get<JsonWebKey>('encryption_key')
  
  if (storedKey) {
    return await crypto.subtle.importKey(
      'jwk',
      storedKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
  }
  
  const newKey = await generateKey()
  const exportedKey = await crypto.subtle.exportKey('jwk', newKey)
  await set('encryption_key', exportedKey)
  return newKey
}

async function encrypt(data: string): Promise<{ iv: string; ciphertext: string }> {
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  const encoded = encoder.encode(data)
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )
  
  return {
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    ciphertext: Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

async function decrypt(iv: string, ciphertext: string): Promise<string> {
  const key = await getOrCreateKey()
  
  const ivBytes = new Uint8Array(iv.match(/.{2}/g)!.map(byte => parseInt(byte, 16)))
  const ciphertextBytes = new Uint8Array(ciphertext.match(/.{2}/g)!.map(byte => parseInt(byte, 16)))
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    ciphertextBytes
  )
  
  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

export async function savePendingSignature(
  eventId: string,
  kioskToken: string,
  data: PendingSignature['data']
): Promise<string> {
  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const key = `${PENDING_SIGNATURES_PREFIX}${id}`
  
  const encrypted = await encrypt(JSON.stringify(data))
  
  const pending: PendingSignature = {
    id,
    timestamp: Date.now(),
    eventId,
    kioskToken,
    data: encrypted as unknown as PendingSignature['data'],
    encrypted: true,
  }
  
  await set(key, pending)
  return id
}

export async function getPendingSignatures(): Promise<PendingSignature[]> {
  const allKeys = await keys()
  const pendingKeys = allKeys.filter(k => 
    typeof k === 'string' && k.startsWith(PENDING_SIGNATURES_PREFIX)
  )
  
  const signatures: PendingSignature[] = []
  
  for (const key of pendingKeys) {
    const stored = await get<PendingSignature>(key as string)
    if (stored) {
      if (stored.encrypted) {
        try {
          const decrypted = await decrypt(
            (stored.data as unknown as { iv: string }).iv,
            (stored.data as unknown as { ciphertext: string }).ciphertext
          )
          stored.data = JSON.parse(decrypted)
          stored.encrypted = false
        } catch {
          console.error('Failed to decrypt pending signature')
          continue
        }
      }
      signatures.push(stored)
    }
  }
  
  return signatures.sort((a, b) => a.timestamp - b.timestamp)
}

export async function removePendingSignature(id: string): Promise<void> {
  await del(`${PENDING_SIGNATURES_PREFIX}${id}`)
}

export async function getPendingCount(): Promise<number> {
  const allKeys = await keys()
  return allKeys.filter(k => 
    typeof k === 'string' && k.startsWith(PENDING_SIGNATURES_PREFIX)
  ).length
}

export async function syncPendingSignatures(
  submitFn: (eventId: string, kioskToken: string, data: PendingSignature['data']) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSignatures()
  let synced = 0
  let failed = 0
  
  for (const sig of pending) {
    try {
      const success = await submitFn(sig.eventId, sig.kioskToken, sig.data)
      if (success) {
        await removePendingSignature(sig.id)
        synced++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }
  
  return { synced, failed }
}

export function isOnline(): boolean {
  return navigator.onLine
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)
  
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
