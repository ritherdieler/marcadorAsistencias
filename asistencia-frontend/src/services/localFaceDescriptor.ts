import { FaceDetector, FilesetResolver, type Detection } from '@mediapipe/tasks-vision'
import * as ort from 'onnxruntime-web/wasm'

import {
  FACE_OFFLINE_CENTER_CROP_SPECS,
  FACE_OFFLINE_DETECTED_CROP_SCALES,
  FACE_OFFLINE_DETECTOR_MIN_CONFIDENCE,
  FACE_OFFLINE_LIGHTING_VARIANTS,
  FACE_PREPROCESS_INPUT_SIZE,
  FACE_PREPROCESS_MARGIN_RATIO,
} from '../config/faceCaptureConfig'

const MODEL_URL = '/models/face-feature/face_feature.onnx'
const MEDIAPIPE_WASM_PATH = '/mediapipe/wasm'
const MEDIAPIPE_FACE_MODEL_PATH = '/mediapipe/models/blaze_face_short_range.tflite'
const INPUT_SIZE = FACE_PREPROCESS_INPUT_SIZE

const LIGHTING_VARIANTS = [...FACE_OFFLINE_LIGHTING_VARIANTS]
const FACE_CROP_SPECS = [...FACE_OFFLINE_DETECTED_CROP_SCALES]
const CROP_SPECS = [...FACE_OFFLINE_CENTER_CROP_SPECS]

type CropSpec = (typeof CROP_SPECS)[number]
type FaceCropSpec = (typeof FACE_CROP_SPECS)[number]
type LightingVariant = (typeof LIGHTING_VARIANTS)[number]

type CropArea = {
  sx: number
  sy: number
  sw: number
  sh: number
}

type PreparedCrop = CropArea & {
  alignedCanvas?: HTMLCanvasElement
}

type FaceLandmarks = {
  leftEye: { x: number; y: number }
  rightEye: { x: number; y: number }
  nose: { x: number; y: number }
}

let sessionPromise: Promise<ort.InferenceSession> | null = null
let faceDetectorPromise: Promise<FaceDetector> | null = null

function configureOnnxRuntime() {
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
}

async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    configureOnnxRuntime()
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    })
  }

  return sessionPromise
}

async function getImageFaceDetector(): Promise<FaceDetector> {
  if (!faceDetectorPromise) {
    faceDetectorPromise = FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH).then((vision) =>
      FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_FACE_MODEL_PATH,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: FACE_OFFLINE_DETECTOR_MIN_CONFIDENCE,
      }),
    )
  }

  return faceDetectorPromise
}

function toPixelBox(face: Detection, image: ImageBitmap) {
  const box = face.boundingBox
  if (!box || box.width <= 0 || box.height <= 0) return null

  const isNormalized = box.width <= 1 && box.height <= 1
  return {
    x: isNormalized ? box.originX * image.width : box.originX,
    y: isNormalized ? box.originY * image.height : box.originY,
    width: isNormalized ? box.width * image.width : box.width,
    height: isNormalized ? box.height * image.height : box.height,
  }
}

function estimateLandmarks(box: { x: number; y: number; width: number; height: number }): FaceLandmarks {
  const centerX = box.x + box.width / 2
  const eyeY = box.y + box.height * 0.38
  const eyeOffsetX = box.width * 0.18
  const noseY = box.y + box.height * 0.56

  return {
    leftEye: { x: centerX - eyeOffsetX, y: eyeY },
    rightEye: { x: centerX + eyeOffsetX, y: eyeY },
    nose: { x: centerX, y: noseY },
  }
}

function alignFaceToCanvas(image: ImageBitmap, landmarks: FaceLandmarks): PreparedCrop | null {
  const leftEye = landmarks.leftEye
  const rightEye = landmarks.rightEye
  const nose = landmarks.nose
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y)
  if (eyeDistance < 8) return null

  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)
  const eyeCenterX = (leftEye.x + rightEye.x) / 2
  const eyeCenterY = (leftEye.y + rightEye.y) / 2
  const targetEyeDistance = INPUT_SIZE * 0.36
  const scale = targetEyeDistance / eyeDistance
  const noseOffsetY = nose.y - eyeCenterY
  const targetCenterX = INPUT_SIZE / 2
  const targetCenterY = INPUT_SIZE * 0.42

  const canvas = document.createElement('canvas')
  canvas.width = INPUT_SIZE
  canvas.height = INPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) return null

  context.fillStyle = '#000000'
  context.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.translate(targetCenterX, targetCenterY)
  context.rotate(-angle)
  context.scale(scale, scale)
  context.translate(-eyeCenterX, -(eyeCenterY + noseOffsetY * 0.35))
  context.drawImage(image, 0, 0)

  return {
    sx: 0,
    sy: 0,
    sw: INPUT_SIZE,
    sh: INPUT_SIZE,
    alignedCanvas: canvas,
  }
}

async function getDetectedFaceCrops(image: ImageBitmap): Promise<PreparedCrop[]> {
  try {
    const detector = await getImageFaceDetector()
    const result = detector.detect(image)
    const detections = result.detections
      .map((face) => ({ face, box: toPixelBox(face, image) }))
      .filter((item): item is { face: Detection; box: { x: number; y: number; width: number; height: number } } => Boolean(item.box))
      .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)

    const mainFace = detections[0]?.box
    if (!mainFace) return []

    const aligned = alignFaceToCanvas(image, estimateLandmarks(mainFace))
    const marginRatio = FACE_PREPROCESS_MARGIN_RATIO
    const marginX = mainFace.width * marginRatio
    const marginY = mainFace.height * marginRatio
    const marginBox = {
      x: Math.max(0, mainFace.x - marginX),
      y: Math.max(0, mainFace.y - marginY),
      width: Math.min(image.width, mainFace.x + mainFace.width + marginX) - Math.max(0, mainFace.x - marginX),
      height: Math.min(image.height, mainFace.y + mainFace.height + marginY) - Math.max(0, mainFace.y - marginY),
    }

    const detectedCrops = FACE_CROP_SPECS.map((spec) => getFaceCrop(image, marginBox, spec))
    return aligned ? [aligned, ...detectedCrops] : detectedCrops
  } catch {
    faceDetectorPromise = null
    return []
  }
}

function getFaceCrop(
  image: ImageBitmap,
  box: { x: number; y: number; width: number; height: number },
  spec: FaceCropSpec,
): CropArea {
  const faceSize = Math.max(box.width, box.height)
  const cropSize = Math.min(Math.max(faceSize * spec.scale, faceSize), Math.max(image.width, image.height))
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2 + faceSize * spec.centerYShift
  const sx = Math.max(0, Math.min(image.width - cropSize, centerX - cropSize / 2))
  const sy = Math.max(0, Math.min(image.height - cropSize, centerY - cropSize / 2))
  const sw = Math.min(cropSize, image.width - sx)
  const sh = Math.min(cropSize, image.height - sy)

  return { sx, sy, sw, sh }
}

function getCenteredCrop(image: ImageBitmap, spec: CropSpec): CropArea {
  const sw = image.width * spec.widthRatio
  const sh = image.height * spec.heightRatio
  const centerX = image.width / 2
  const centerY = image.height * spec.centerYRatio

  const sx = Math.max(0, Math.min(image.width - sw, centerX - sw / 2))
  const sy = Math.max(0, Math.min(image.height - sh, centerY - sh / 2))

  return { sx, sy, sw, sh }
}

function clampPixel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function adjustLighting(value: number, variant: LightingVariant): number {
  const contrasted = (value - 127.5) * variant.contrast + 127.5 + variant.brightness
  const normalized = clampPixel(contrasted) / 255
  return clampPixel(255 * normalized ** variant.gamma)
}

function preprocessImage(
  image: ImageBitmap,
  crop: PreparedCrop,
  lighting: LightingVariant,
): Float32Array {
  const canvas = crop.alignedCanvas ?? document.createElement('canvas')
  if (!crop.alignedCanvas) {
    canvas.width = INPUT_SIZE
    canvas.height = INPUT_SIZE
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('No se pudo preparar el canvas para el modelo facial offline.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, INPUT_SIZE, INPUT_SIZE)
  }

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('No se pudo preparar el canvas para el modelo facial offline.')

  const { data } = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const tensor = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE)
  const planeSize = INPUT_SIZE * INPUT_SIZE

  for (let y = 0; y < INPUT_SIZE; y += 1) {
    for (let x = 0; x < INPUT_SIZE; x += 1) {
      const pixelIndex = y * INPUT_SIZE + x
      const sourceIndex = pixelIndex * 4
      const red = adjustLighting(data[sourceIndex], lighting)
      const green = adjustLighting(data[sourceIndex + 1], lighting)
      const blue = adjustLighting(data[sourceIndex + 2], lighting)

      tensor[pixelIndex] = (red - 127.5) / 128
      tensor[planeSize + pixelIndex] = (green - 127.5) / 128
      tensor[planeSize * 2 + pixelIndex] = (blue - 127.5) / 128
    }
  }

  return tensor
}

async function runDescriptorModel(
  image: ImageBitmap,
  crop: PreparedCrop,
  lighting: LightingVariant,
): Promise<number[]> {
  const session = await getSession()
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  const input = new ort.Tensor('float32', preprocessImage(image, crop, lighting), [1, 3, INPUT_SIZE, INPUT_SIZE])
  const output = await session.run({ [inputName]: input })
  const embedding = output[outputName].data

  return Array.from(embedding as Float32Array)
}

export async function generateLocalFaceDescriptorCandidates(photo: Blob): Promise<number[][]> {
  const image = await createImageBitmap(photo)

  try {
    const descriptors: number[][] = []

    const detectedCrops = await getDetectedFaceCrops(image)
    const crops = detectedCrops.length > 0
      ? detectedCrops
      : CROP_SPECS.map((spec) => getCenteredCrop(image, spec))

    for (const crop of crops) {
      for (const lighting of LIGHTING_VARIANTS) {
        const descriptor = await runDescriptorModel(image, crop, lighting)
        if (descriptor.length > 0) descriptors.push(descriptor)
      }
    }

    return descriptors
  } finally {
    image.close()
  }
}

export async function generateLocalFaceDescriptor(photo: Blob): Promise<number[] | null> {
  const descriptors = await generateLocalFaceDescriptorCandidates(photo)
  return descriptors[0] ?? null
}
