export async function encryptWithSHA384(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-384', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))

  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
