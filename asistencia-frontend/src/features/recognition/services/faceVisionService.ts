import {
  FaceLandmarker,
  FilesetResolver,
  type Classifications,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { FACE_VISION_CONFIG } from '../../../config/faceCaptureConfig'
import {
  deriveFacePoseFromYaw,
  estimateFacePoseFromLandmarks,
  extractFacePose3d,
  type FacePose,
  type FacePose3d,
} from './facePose3d'

const MEDIAPIPE_WASM_PATH = '/mediapipe/wasm'
const MEDIAPIPE_FACE_LANDMARKER_MODEL_PATH = '/mediapipe/models/face_landmarker.task'
const MIN_FACE_AREA_RATIO = 0.006

export type FaceLandmarkPoint = {
  x: number
  y: number
}

export type FaceBox = {
  centerX: number
  centerY: number
  width: number
  height: number
}

export type SerializedBlendshapes = {
  headIndex?: number
  categories: Array<{ index: number; score: number; categoryName: string; displayName: string }>
}

export type SerializedFaceAnalysisResult = {
  visible: boolean
  pose: FacePose
  pose3d?: FacePose3d
  box?: FaceBox
  landmarks?: FaceLandmarkPoint[]
  blendshapes?: SerializedBlendshapes
}

export type FaceAnalysisResult = {
  visible: boolean
  pose: FacePose
  pose3d?: FacePose3d
  box?: FaceBox
  landmarks?: FaceLandmarkPoint[]
  blendshapes?: Classifications
}

let videoLandmarkerPromise: Promise<FaceLandmarker> | null = null
let imageLandmarkerPromise: Promise<FaceLandmarker> | null = null

function createLandmarkerOptions(runningMode: 'VIDEO' | 'IMAGE') {
  return {
    baseOptions: {
      modelAssetPath: MEDIAPIPE_FACE_LANDMARKER_MODEL_PATH,
      delegate: 'CPU' as const,
    },
    runningMode,
    numFaces: FACE_VISION_CONFIG.numFaces,
    minFaceDetectionConfidence: FACE_VISION_CONFIG.minFaceDetectionConfidence,
    minFacePresenceConfidence: FACE_VISION_CONFIG.minFacePresenceConfidence,
    minTrackingConfidence: FACE_VISION_CONFIG.minTrackingConfidence,
    outputFaceBlendshapes: FACE_VISION_CONFIG.outputFaceBlendshapes,
    outputFacialTransformationMatrixes: FACE_VISION_CONFIG.outputFacialTransformationMatrixes,
  }
}

async function createVideoLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH)
  return FaceLandmarker.createFromOptions(vision, createLandmarkerOptions('VIDEO'))
}

async function createImageLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH)
  return FaceLandmarker.createFromOptions(vision, createLandmarkerOptions('IMAGE'))
}

async function getVideoLandmarker(): Promise<FaceLandmarker> {
  if (!videoLandmarkerPromise) {
    videoLandmarkerPromise = createVideoLandmarker()
  }
  return videoLandmarkerPromise
}

async function getImageLandmarker(): Promise<FaceLandmarker> {
  if (!imageLandmarkerPromise) {
    imageLandmarkerPromise = createImageLandmarker()
  }
  return imageLandmarkerPromise
}

function resetVideoLandmarker(): void {
  videoLandmarkerPromise = null
}

function resetImageLandmarker(): void {
  imageLandmarkerPromise = null
}

function computeBounds(
  landmarks: NormalizedLandmark[],
): { minX: number; minY: number; width: number; height: number } | null {
  if (!landmarks.length) return null

  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0

  for (const point of landmarks) {
    if (point.x < minX) minX = point.x
    if (point.x > maxX) maxX = point.x
    if (point.y < minY) minY = point.y
    if (point.y > maxY) maxY = point.y
  }

  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

function isUsableFace(landmarks: NormalizedLandmark[]): boolean {
  const box = computeBounds(landmarks)
  if (!box) return false

  const faceRatio = box.width * box.height
  return faceRatio >= MIN_FACE_AREA_RATIO
}

function toNormalizedFaceBox(landmarks: NormalizedLandmark[]): FaceBox | undefined {
  const bounds = computeBounds(landmarks)
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return undefined

  return {
    centerX: bounds.minX + bounds.width / 2,
    centerY: bounds.minY + bounds.height / 2,
    width: bounds.width,
    height: bounds.height,
  }
}

function toLandmarkPoints(landmarks: NormalizedLandmark[]): FaceLandmarkPoint[] {
  return landmarks.map((point) => ({ x: point.x, y: point.y }))
}

function resolvePose(
  landmarks: NormalizedLandmark[],
  transformationMatrix?: { rows: number; columns: number; data: number[] },
): { pose: FacePose; pose3d?: FacePose3d } {
  const pose3d = transformationMatrix ? extractFacePose3d(transformationMatrix) ?? undefined : undefined
  const pose = pose3d ? deriveFacePoseFromYaw(pose3d.yaw) : estimateFacePoseFromLandmarks(landmarks)
  return { pose, pose3d }
}

function buildAnalysisResult(
  landmarks: NormalizedLandmark[],
  blendshapes?: Classifications,
  transformationMatrix?: { rows: number; columns: number; data: number[] },
): FaceAnalysisResult {
  const { pose, pose3d } = resolvePose(landmarks, transformationMatrix)

  return {
    visible: true,
    pose,
    pose3d,
    box: toNormalizedFaceBox(landmarks),
    landmarks: toLandmarkPoints(landmarks),
    blendshapes,
  }
}

function emptyAnalysisResult(): FaceAnalysisResult {
  return { visible: false, pose: 'unknown' }
}

async function detectFromVideoMainThread(
  video: HTMLVideoElement,
  timestampMs: number,
): Promise<FaceAnalysisResult> {
  try {
    const landmarker = await getVideoLandmarker()
    const result = landmarker.detectForVideo(video, timestampMs)
    const faceIndex = result.faceLandmarks.findIndex((face) => isUsableFace(face))
    if (faceIndex < 0) return emptyAnalysisResult()

    const landmarks = result.faceLandmarks[faceIndex]
    const blendshapes = result.faceBlendshapes[faceIndex]
    const transformationMatrix = result.facialTransformationMatrixes[faceIndex]

    return buildAnalysisResult(landmarks, blendshapes, transformationMatrix)
  } catch {
    resetVideoLandmarker()
    return emptyAnalysisResult()
  }
}

async function detectFromImageMainThread(
  source: ImageBitmap | HTMLCanvasElement,
): Promise<FaceAnalysisResult> {
  try {
    const landmarker = await getImageLandmarker()
    const result = landmarker.detect(source)
    const faceIndex = result.faceLandmarks.findIndex((face) => isUsableFace(face))
    if (faceIndex < 0) return emptyAnalysisResult()

    const landmarks = result.faceLandmarks[faceIndex]
    const blendshapes = result.faceBlendshapes[faceIndex]
    const transformationMatrix = result.facialTransformationMatrixes[faceIndex]

    return buildAnalysisResult(landmarks, blendshapes, transformationMatrix)
  } catch {
    resetImageLandmarker()
    return emptyAnalysisResult()
  }
}

export async function detectFromVideo(
  video: HTMLVideoElement,
  timestampMs: number,
): Promise<FaceAnalysisResult> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    return emptyAnalysisResult()
  }

  return detectFromVideoMainThread(video, timestampMs)
}

export async function detectFromImage(
  source: ImageBitmap | HTMLCanvasElement,
): Promise<FaceAnalysisResult> {
  if (source instanceof ImageBitmap) {
    const { detectFromImageViaWorker } = await import('./faceVisionWorkerClient')

    try {
      const workerResult = await detectFromImageViaWorker(source)
      if (workerResult !== null) return workerResult
    } catch {
    }

    return detectFromImageMainThread(source)
  }

  return detectFromImageMainThread(source)
}
