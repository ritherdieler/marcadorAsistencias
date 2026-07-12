export async function gzipJson(value: unknown): Promise<Blob | null> {
  try {
    if (typeof CompressionStream === 'undefined') return null
    const json = JSON.stringify(value)
    const source = new Blob([json])
    const stream = source.stream().pipeThrough(new CompressionStream('gzip'))
    const compressed = await new Response(stream).blob()
    return new Blob([compressed], { type: 'application/gzip' })
  } catch {
    return null
  }
}
