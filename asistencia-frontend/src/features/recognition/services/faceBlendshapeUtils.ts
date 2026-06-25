import type { Classifications } from '@mediapipe/tasks-vision'

export type BlinkScores = {
  left: number
  right: number
}

export type BlinkCycleOptions = {
  closedThreshold?: number
  openThreshold?: number
}

const DEFAULT_CLOSED_THRESHOLD = 0.5
const DEFAULT_OPEN_THRESHOLD = 0.2

function readCategoryScore(blendshapes: Classifications, categoryName: string): number | null {
  const category = blendshapes.categories.find((entry) => entry.categoryName === categoryName)
  return category ? category.score : null
}

export function readBlinkScores(blendshapes: Classifications | undefined): BlinkScores | null {
  if (!blendshapes) return null

  const left = readCategoryScore(blendshapes, 'eyeBlinkLeft')
  const right = readCategoryScore(blendshapes, 'eyeBlinkRight')
  if (left === null || right === null) return null

  return { left, right }
}

export function detectBlinkCycle(history: BlinkScores[], options?: BlinkCycleOptions): boolean {
  if (history.length < 3) return false

  const closedThreshold = options?.closedThreshold ?? DEFAULT_CLOSED_THRESHOLD
  const openThreshold = options?.openThreshold ?? DEFAULT_OPEN_THRESHOLD

  let sawOpen = false
  let sawClosed = false

  for (const scores of history) {
    const maxBlink = Math.max(scores.left, scores.right)

    if (maxBlink <= openThreshold) {
      if (sawClosed) return true
      sawOpen = true
      continue
    }

    if (sawOpen && maxBlink >= closedThreshold) {
      sawClosed = true
    }
  }

  return false
}
