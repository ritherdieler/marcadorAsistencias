import * as ort from 'onnxruntime-web/wasm'

import {
  FACE_EMBEDDING_MODEL,
  FACE_OFFLINE_CENTER_CROP_SPECS,
  FACE_PREPROCESS_MARGIN_RATIO,
} from '../config/faceCaptureConfig'
import { detectFromImage } from '../features/recognition/services/faceVisionService'
import { landmarksToArcFaceLandmarks } from '../features/recognition/services/faceLandmarkMapping'
import {
  alignFaceToArcFaceCanvas,
  l2Normalize,
} from './arcFaceAlignment'

const MODEL_URL = FACE_EMBEDDING_MODEL.modelUrl
const INPUT_SIZE = FACE_EMBEDDING_MODEL.inputSize
const NORMALIZE_MEAN = FACE_EMBEDDING_MODEL.normalizeMean
const NORMALIZE_STD = FACE_EMBEDDING_MODEL.normalizeStd

const CROP_SPECS = [...FACE_OFFLINE_CENTER_CROP_SPECS]

type CropSpec = (typeof CROP_SPECS)[number]

type PreparedCrop = {
  sx: number
  sy: number
  sw: number
  sh: number
  alignedCanvas?: HTMLCanvasElement
}

let sessionPromise: Promise<ort.InferenceSession> | null = null

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

async function getDetectedFaceCrops(image: ImageBitmap): Promise<PreparedCrop[]> {
  const result = await detectFromImage(image)
  if (!result.visible || !result.landmarks?.length) return []

  const arcFaceLandmarks = landmarksToArcFaceLandmarks(
    result.landmarks,
    image.width,
    image.height,
  )
  const alignedCanvas = arcFaceLandmarks
    ? alignFaceToArcFaceCanvas(image, arcFaceLandmarks, INPUT_SIZE)
    : null

  let fallbackCrop: PreparedCrop | null = null
  if (result.box) {
    const pixelWidth = result.box.width * image.width
    const pixelHeight = result.box.height * image.height
    const pixelX = (result.box.centerX - result.box.width / 2) * image.width
    const pixelY = (result.box.centerY - result.box.height / 2) * image.height
    const marginRatio = FACE_PREPROCESS_MARGIN_RATIO
    const marginX = pixelWidth * marginRatio
    const marginY = pixelHeight * marginRatio
    const sx = Math.max(0, pixelX - marginX)
    const sy = Math.max(0, pixelY - marginY)

    fallbackCrop = {
      sx,
      sy,
      sw: Math.min(image.width, pixelX + pixelWidth + marginX) - sx,
      sh: Math.min(image.height, pixelY + pixelHeight + marginY) - sy,
    }
  }

  if (alignedCanvas) {
    const crops: PreparedCrop[] = [{ sx: 0, sy: 0, sw: INPUT_SIZE, sh: INPUT_SIZE, alignedCanvas }]
    if (fallbackCrop) crops.push(fallbackCrop)
    return crops
  }

  return fallbackCrop ? [fallbackCrop] : []
}

function getCenteredCrop(image: ImageBitmap, spec: CropSpec): PreparedCrop {
  const sw = image.width * spec.widthRatio
  const sh = image.height * spec.heightRatio
  const centerX = image.width / 2
  const centerY = image.height * spec.centerYRatio

  const sx = Math.max(0, Math.min(image.width - sw, centerX - sw / 2))
  const sy = Math.max(0, Math.min(image.height - sh, centerY - sh / 2))

  return { sx, sy, sw, sh }
}

function preprocessImage(image: ImageBitmap, crop: PreparedCrop): Float32Array {
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
      const red = data[sourceIndex]
      const green = data[sourceIndex + 1]
      const blue = data[sourceIndex + 2]

      tensor[pixelIndex] = (red / 255 - NORMALIZE_MEAN) / NORMALIZE_STD
      tensor[planeSize + pixelIndex] = (green / 255 - NORMALIZE_MEAN) / NORMALIZE_STD
      tensor[planeSize * 2 + pixelIndex] = (blue / 255 - NORMALIZE_MEAN) / NORMALIZE_STD
    }
  }

  return tensor
}

async function runDescriptorModel(image: ImageBitmap, crop: PreparedCrop): Promise<number[]> {
  const session = await getSession()
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  const input = new ort.Tensor('float32', preprocessImage(image, crop), [1, 3, INPUT_SIZE, INPUT_SIZE])
  const output = await session.run({ [inputName]: input })
  const embedding = Array.from(output[outputName].data as Float32Array)
  return l2Normalize(embedding)
}

export async function generateLocalFaceDescriptorCandidates(photo: Blob): Promise<number[][]> {
  const image = await createImageBitmap(photo)

  try {
    const descriptors: number[][] = []
    const detectedCrops = await getDetectedFaceCrops(image)
    const crops = detectedCrops.length > 0 ? detectedCrops : CROP_SPECS.map((spec) => getCenteredCrop(image, spec))

    for (const crop of crops) {
      const descriptor = await runDescriptorModel(image, crop)
      if (descriptor.length > 0) descriptors.push(descriptor)
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
