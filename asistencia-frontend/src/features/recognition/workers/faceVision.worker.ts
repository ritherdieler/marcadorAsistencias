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
} from '../services/facePose3d'
import type { SerializedFaceAnalysisResult } from '../services/faceVisionService'

const MEDIAPIPE_WASM_PATH = '/mediapipe/wasm'
const MEDIAPIPE_FACE_LANDMARKER_MODEL_PATH = '/mediapipe/models/face_landmarker.task'
const MIN_FACE_AREA_RATIO = 0.006

type FaceLandmarkPoint = {
  x: number
  y: number
}

type FaceBox = {
  centerX: number
  centerY: number
  width: number
  height: number
}

type InitRequest = {
  type: 'init'
  id: number
}

type DetectVideoRequest = {
  type: 'detectVideo'
  id: number
  bitmap: ImageBitmap
  timestampMs: number
}

type DetectImageRequest = {
  type: 'detectImage'
  id: number
  bitmap: ImageBitmap
}

type WorkerRequest = InitRequest | DetectVideoRequest | DetectImageRequest

type InitResponse = {
  type: 'init'
  id: number
  ok: boolean
  error?: string
}

type DetectResponse = {
  type: 'detectVideo' | 'detectImage'
  id: number
  result: SerializedFaceAnalysisResult
}

type ErrorResponse = {
  type: 'error'
  id: number
  error: string
}

type WorkerResponse = InitResponse | DetectResponse | ErrorResponse

let videoLandmarker: FaceLandmarker | null = null
let imageLandmarker: FaceLandmarker | null = null
let initPromise: Promise<void> | null = null

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

async function ensureInitialized(): Promise<void> {
  if (videoLandmarker && imageLandmarker) return
  if (!initPromise) {
    initPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH)
      videoLandmarker = await FaceLandmarker.createFromOptions(vision, createLandmarkerOptions('VIDEO'))
      imageLandmarker = await FaceLandmarker.createFromOptions(vision, createLandmarkerOptions('IMAGE'))
    })()
  }
  await initPromise
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

function serializeBlendshapes(blendshapes?: Classifications): SerializedFaceAnalysisResult['blendshapes'] {
  if (!blendshapes) return undefined

  return {
    headIndex: blendshapes.headIndex,
    categories: blendshapes.categories.map((category) => ({
      index: category.index,
      score: category.score,
      categoryName: category.categoryName,
      displayName: category.displayName,
    })),
  }
}

function resolvePose(
  landmarks: NormalizedLandmark[],
  transformationMatrix?: { rows: number; columns: number; data: number[] },
): Pick<SerializedFaceAnalysisResult, 'pose' | 'pose3d'> {
  const pose3d = transformationMatrix ? extractFacePose3d(transformationMatrix) ?? undefined : undefined
  const pose = pose3d ? deriveFacePoseFromYaw(pose3d.yaw) : estimateFacePoseFromLandmarks(landmarks)
  return { pose, pose3d }
}

function buildAnalysisResult(
  landmarks: NormalizedLandmark[],
  blendshapes?: Classifications,
  transformationMatrix?: { rows: number; columns: number; data: number[] },
): SerializedFaceAnalysisResult {
  const { pose, pose3d } = resolvePose(landmarks, transformationMatrix)

  return {
    visible: true,
    pose,
    pose3d,
    box: toNormalizedFaceBox(landmarks),
    landmarks: toLandmarkPoints(landmarks),
    blendshapes: serializeBlendshapes(blendshapes),
  }
}

function emptyAnalysisResult(): SerializedFaceAnalysisResult {
  return { visible: false, pose: 'unknown' }
}

function detectVideoFrame(bitmap: ImageBitmap): SerializedFaceAnalysisResult {
  if (!imageLandmarker || !bitmap.width || !bitmap.height) {
    return emptyAnalysisResult()
  }

  const result = imageLandmarker.detect(bitmap)
  const faceIndex = result.faceLandmarks.findIndex((face) => isUsableFace(face))
  if (faceIndex < 0) return emptyAnalysisResult()

  const landmarks = result.faceLandmarks[faceIndex]
  const blendshapes = result.faceBlendshapes[faceIndex]
  const transformationMatrix = result.facialTransformationMatrixes[faceIndex]

  return buildAnalysisResult(landmarks, blendshapes, transformationMatrix)
}

function detectImageFrame(bitmap: ImageBitmap): SerializedFaceAnalysisResult {
  if (!imageLandmarker || !bitmap.width || !bitmap.height) {
    return emptyAnalysisResult()
  }

  const result = imageLandmarker.detect(bitmap)
  const faceIndex = result.faceLandmarks.findIndex((face) => isUsableFace(face))
  if (faceIndex < 0) return emptyAnalysisResult()

  const landmarks = result.faceLandmarks[faceIndex]
  const blendshapes = result.faceBlendshapes[faceIndex]
  const transformationMatrix = result.facialTransformationMatrixes[faceIndex]

  return buildAnalysisResult(landmarks, blendshapes, transformationMatrix)
}

function postResponse(response: WorkerResponse): void {
  self.postMessage(response)
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data

  try {
    if (message.type === 'init') {
      await ensureInitialized()
      postResponse({ type: 'init', id: message.id, ok: true })
      return
    }

    await ensureInitialized()

    if (message.type === 'detectVideo') {
      const result = detectVideoFrame(message.bitmap)
      message.bitmap.close()
      postResponse({ type: 'detectVideo', id: message.id, result })
      return
    }

    if (message.type === 'detectImage') {
      const result = detectImageFrame(message.bitmap)
      message.bitmap.close()
      postResponse({ type: 'detectImage', id: message.id, result })
    }
  } catch (error) {
    if (message.type === 'detectVideo' || message.type === 'detectImage') {
      message.bitmap.close()
    }
    postResponse({
      type: 'error',
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
