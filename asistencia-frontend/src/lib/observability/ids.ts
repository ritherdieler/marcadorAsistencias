function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(arr)
  } else {
    for (let i = 0; i < bytes; i += 1) {
      arr[i] = Math.floor(Math.random() * 256)
    }
  }
  let out = ''
  for (let i = 0; i < arr.length; i += 1) {
    out += arr[i].toString(16).padStart(2, '0')
  }
  return out
}

export function generateCorrelationId(): string {
  return randomHex(16)
}

const SESSION_STORAGE_KEY = 'obs_session_id'

export function resolveSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) return existing
    const created = randomHex(12)
    sessionStorage.setItem(SESSION_STORAGE_KEY, created)
    return created
  } catch {
    return randomHex(12)
  }
}
