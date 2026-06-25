import type { Classifications } from '@mediapipe/tasks-vision'
import FaceVisionWorker from '../workers/faceVision.worker?worker'
import type { FaceAnalysisResult, SerializedFaceAnalysisResult } from './faceVisionService'

type PendingInit = {
  resolve: (ready: boolean) => void
}

type PendingDetect = {
  resolve: (result: FaceAnalysisResult) => void
  reject: (error: Error) => void
}

type DetectVideoWorkerMessage = {
  type: 'detectVideo'
  id: number
  bitmap: ImageBitmap
  timestampMs: number
}

type DetectImageWorkerMessage = {
  type: 'detectImage'
  id: number
  bitmap: ImageBitmap
}

type InitWorkerResponse = {
  type: 'init'
  id: number
  ok: boolean
  error?: string
}

type DetectWorkerResponse = {
  type: 'detectVideo' | 'detectImage'
  id: number
  result: SerializedFaceAnalysisResult
}

type ErrorWorkerResponse = {
  type: 'error'
  id: number
  error: string
}

type WorkerInboundMessage = InitWorkerResponse | DetectWorkerResponse | ErrorWorkerResponse

let workerInstance: Worker | null = null
let workerReady = false
let workerFailed = false
let initPromise: Promise<boolean> | null = null
let nextRequestId = 1
const pendingInits = new Map<number, PendingInit>()
const pendingDetects = new Map<number, PendingDetect>()

function deserializeBlendshapes(blendshapes?: SerializedFaceAnalysisResult['blendshapes']): Classifications | undefined {
  if (!blendshapes) return undefined
  return blendshapes as Classifications
}

function deserializeResult(result: SerializedFaceAnalysisResult): FaceAnalysisResult {
  return {
    visible: result.visible,
    pose: result.pose,
    pose3d: result.pose3d,
    box: result.box,
    landmarks: result.landmarks,
    blendshapes: deserializeBlendshapes(result.blendshapes),
  }
}

function allocateRequestId(): number {
  const id = nextRequestId
  nextRequestId += 1
  return id
}

function rejectAllDetects(error: Error): void {
  for (const pending of pendingDetects.values()) {
    pending.reject(error)
  }
  pendingDetects.clear()
}

function handleWorkerMessage(event: MessageEvent<WorkerInboundMessage>): void {
  const message = event.data

  if (message.type === 'init') {
    const pending = pendingInits.get(message.id)
    if (!pending) return
    pendingInits.delete(message.id)

    if (message.ok) {
      workerReady = true
      pending.resolve(true)
      return
    }

    workerFailed = true
    pending.resolve(false)
    return
  }

  const pending = pendingDetects.get(message.id)
  if (!pending) return
  pendingDetects.delete(message.id)

  if (message.type === 'error') {
    workerFailed = true
    pending.reject(new Error(message.error))
    return
  }

  pending.resolve(deserializeResult(message.result))
}

function handleWorkerError(): void {
  workerFailed = true
  workerReady = false
  initPromise = null

  for (const pending of pendingInits.values()) {
    pending.resolve(false)
  }
  pendingInits.clear()
  rejectAllDetects(new Error('Face vision worker crashed'))
}

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new FaceVisionWorker()
    workerInstance.onmessage = handleWorkerMessage
    workerInstance.onerror = handleWorkerError
  }
  return workerInstance
}

function postDetectMessage(
  message: Omit<DetectVideoWorkerMessage, 'id'> | Omit<DetectImageWorkerMessage, 'id'>,
): Promise<FaceAnalysisResult> {
  return new Promise((resolve, reject) => {
    const id = allocateRequestId()
    pendingDetects.set(id, { resolve, reject })
    const payload = { ...message, id }
    getWorker().postMessage(payload, [message.bitmap])
  })
}

export function isFaceVisionWorkerAvailable(): boolean {
  return workerReady && !workerFailed
}

export async function initFaceVisionWorker(): Promise<boolean> {
  if (workerFailed) return false
  if (workerReady) return true
  if (!initPromise) {
    initPromise = new Promise<boolean>((resolve) => {
      const id = allocateRequestId()
      pendingInits.set(id, { resolve })
      getWorker().postMessage({ type: 'init', id })
    })
  }
  return initPromise
}

export async function detectFromVideoViaWorker(
  bitmap: ImageBitmap,
  timestampMs: number,
): Promise<FaceAnalysisResult | null> {
  if (workerFailed) return null

  try {
    const ready = await initFaceVisionWorker()
    if (!ready) return null
    return await postDetectMessage({ type: 'detectVideo', bitmap, timestampMs })
  } catch {
    workerFailed = true
    return null
  }
}

export async function detectFromImageViaWorker(bitmap: ImageBitmap): Promise<FaceAnalysisResult | null> {
  if (workerFailed) return null

  try {
    const ready = await initFaceVisionWorker()
    if (!ready) return null
    return await postDetectMessage({ type: 'detectImage', bitmap })
  } catch {
    workerFailed = true
    return null
  }
}
