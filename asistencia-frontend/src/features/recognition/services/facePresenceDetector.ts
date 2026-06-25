import type { Classifications } from '@mediapipe/tasks-vision'

import { estimateFacePoseFromLandmarks } from './facePose3d'
import type { FacePose3d } from './facePose3d'
import { detectFromVideo } from './faceVisionService'

const MIN_FRAME_EDGE_RATIO = 0.004
const MIN_FRAME_SKIN_RATIO = 0.004

export type FacePose = 'front' | 'left' | 'right' | 'unknown'

export type FaceLandmarkPoint = {
  x: number
  y: number
}

export type FacePoseResult = {
  visible: boolean
  pose: FacePose
  pose3d?: FacePose3d
  box?: FaceBox
  landmarks?: FaceLandmarkPoint[]
  blendshapes?: Classifications
}

export type FaceBox = {
  centerX: number
  centerY: number
  width: number
  height: number
}

function toFacePoseResult(
  visible: boolean,
  landmarks?: FaceLandmarkPoint[],
  box?: FaceBox,
  pose3d?: FacePose3d,
  blendshapes?: Classifications,
  pose?: FacePose,
): FacePoseResult {
  if (!visible || !landmarks) {
    return { visible, pose: 'unknown' }
  }

  return {
    visible: true,
    pose: pose ?? estimateFacePoseFromLandmarks(landmarks),
    pose3d,
    box,
    landmarks,
    blendshapes,
  }
}

export async function hasVisibleFace(video: HTMLVideoElement): Promise<boolean> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    return false
  }

  try {
    const result = await detectFromVideo(video, performance.now())
    return result.visible || hasHumanLikeFrame(video)
  } catch {
    return hasHumanLikeFrame(video)
  }
}

export async function detectVisibleFacePose(video: HTMLVideoElement): Promise<FacePoseResult> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    return { visible: false, pose: 'unknown' }
  }

  try {
    const result = await detectFromVideo(video, performance.now())

    if (result.visible && result.landmarks) {
      return toFacePoseResult(
        true,
        result.landmarks,
        result.box,
        result.pose3d,
        result.blendshapes,
        result.pose,
      )
    }

    return { visible: hasHumanLikeFrame(video), pose: 'unknown' }
  } catch {
    return { visible: hasHumanLikeFrame(video), pose: 'unknown' }
  }
}

function hasHumanLikeFrame(video: HTMLVideoElement): boolean {
  const sampleWidth = 160
  const sampleHeight = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * sampleWidth))
  const canvas = document.createElement('canvas')
  canvas.width = sampleWidth
  canvas.height = sampleHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return true

  ctx.drawImage(video, 0, 0, sampleWidth, sampleHeight)
  const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight)
  let skinPixels = 0
  let edgePixels = 0
  let previousLuma: number | null = null
  let totalPixels = 0

  for (let index = 0; index < data.length; index += 16) {
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    const luma = 0.299 * r + 0.587 * g + 0.114 * b

    totalPixels++
    if (isSkinLike(r, g, b)) skinPixels++
    if (previousLuma !== null && Math.abs(luma - previousLuma) > 18) edgePixels++
    previousLuma = luma
  }

  if (!totalPixels) return true

  return skinPixels / totalPixels >= MIN_FRAME_SKIN_RATIO && edgePixels / totalPixels >= MIN_FRAME_EDGE_RATIO
}

function isSkinLike(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return r > 35 && g > 25 && b > 15 && r > b && cb >= 70 && cb <= 145 && cr >= 125 && cr <= 190
}
