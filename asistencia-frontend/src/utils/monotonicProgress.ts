export type ProgressCallback = (percent: number) => void

export function createMonotonicProgress(callback?: ProgressCallback): ProgressCallback {
  let last = 0
  return (percent: number) => {
    const next = Math.max(last, Math.min(100, Math.round(percent)))
    last = next
    callback?.(next)
  }
}
