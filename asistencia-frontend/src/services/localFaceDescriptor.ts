import { FaceDetector, FilesetResolver, type Detection } from '@mediapipe/tasks-vision'
import * as ort from 'onnxruntime-web/wasm'

const MODEL_URL = '/models/face-feature/face_feature.onnx'
const MEDIAPIPE_WASM_PATH = '/mediapipe/wasm'
const MEDIAPIPE_FACE_MODEL_PATH = '/mediapipe/models/blaze_face_short_range.tflite'
const INPUT_SIZE = 224

const LIGHTING_VARIANTS = [
  { brightness: 0, contrast: 1, gamma: 1 },
  { brightness: 18, contrast: 1.18, gamma: 0.82 },
  { brightness: 32, contrast: 1.28, gamma: 0.72 },
]

const FACE_CROP_SPECS = [
  { scale: 2.2, centerYShift: 0.08 },
  { scale: 2.8, centerYShift: 0.12 },
  { scale: 3.4, centerYShift: 0.16 },
]

const CROP_SPECS = [
  { widthRatio: 0.82, heightRatio: 0.92, centerYRatio: 0.48 },
  { widthRatio: 0.68, heightRatio: 0.82, centerYRatio: 0.44 },
  { widthRatio: 0.96, heightRatio: 0.96, centerYRatio: 0.5 },
  { widthRatio: 1, heightRatio: 1, centerYRatio: 0.5 },
]

type CropSpec = (typeof CROP_SPECS)[number]
type FaceCropSpec = (typeof FACE_CROP_SPECS)[number]
type LightingVariant = (typeof LIGHTING_VARIANTS)[number]

type CropArea = {
  sx: number
  sy: number
  sw: number
  sh: number
}

let sessionPromise: Promise<ort.InferenceSession> | null = null
let faceDetectorPromise: Promise<FaceDetector> | null = null

function configureOnnxRuntime() {
  // Usa ONNX Runtime empaquetado por Vite; no importa modulos desde public.
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
}

async function getSession(): Promise<ort.InferenceSession> {
  // Carga el modelo una sola vez; las siguientes marcaciones reutilizan la sesion.
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
  // Detector local usado solo para recortar el rostro antes de generar el descriptor offline.
  if (!faceDetectorPromise) {
    faceDetectorPromise = FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH).then((vision) =>
      FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_FACE_MODEL_PATH,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.15,
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

async function getDetectedFaceCrops(image: ImageBitmap): Promise<CropArea[]> {
  // En offline recorta usando el rostro real detectado; si falla, se usan los recortes centrados de respaldo.
  try {
    const detector = await getImageFaceDetector()
    const result = detector.detect(image)
    const detections = result.detections
      .map((face) => ({ face, box: toPixelBox(face, image) }))
      .filter((item): item is { face: Detection; box: { x: number; y: number; width: number; height: number } } => Boolean(item.box))
      .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)

    const mainFace = detections[0]?.box
    if (!mainFace) return []

    return FACE_CROP_SPECS.map((spec) => getFaceCrop(image, mainFace, spec))
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
  // Expande el rostro detectado para incluir frente, menton y contexto, parecido al recorte del backend.
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
  // Replica los recortes de respaldo del backend para mantener el mismo criterio de descriptor.
  const sw = image.width * spec.widthRatio
  const sh = image.height * spec.heightRatio
  const centerX = image.width / 2
  const centerY = image.height * spec.centerYRatio

  const sx = Math.max(0, Math.min(image.width - sw, centerX - sw / 2))
  const sy = Math.max(0, Math.min(image.height - sh, centerY - sh / 2))

  return { sx, sy, sw, sh }
}

function clampPixel(value: number): number {
  return Math.max(0, Math.min(255, value))
}

function adjustLighting(value: number, variant: LightingVariant): number {
  // Corrige poca luz de forma suave antes de normalizar, sin cambiar el flujo de reconocimiento.
  const contrasted = (value - 127.5) * variant.contrast + 127.5 + variant.brightness
  const normalized = clampPixel(contrasted) / 255
  return clampPixel(255 * normalized ** variant.gamma)
}

function preprocessImage(image: ImageBitmap, crop: CropArea, lighting: LightingVariant): Float32Array {
  // Convierte la imagen a tensor NCHW y aplica la normalizacion usada por DJL: (pixel - 127.5) / 128.
  const canvas = document.createElement('canvas')
  canvas.width = INPUT_SIZE
  canvas.height = INPUT_SIZE

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('No se pudo preparar el canvas para el modelo facial offline.')

  context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, INPUT_SIZE, INPUT_SIZE)

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
  crop: CropArea,
  lighting: LightingVariant
): Promise<number[]> {
  // Ejecuta el ONNX exportado desde face_feature.pt y devuelve el embedding de 512 valores.
  const session = await getSession()
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  const input = new ort.Tensor('float32', preprocessImage(image, crop, lighting), [1, 3, INPUT_SIZE, INPUT_SIZE])
  const output = await session.run({ [inputName]: input })
  const embedding = output[outputName].data

  return Array.from(embedding as Float32Array)
}

export async function generateLocalFaceDescriptorCandidates(photo: Blob): Promise<number[][]> {
  // Genera varios candidatos como el backend; la comparacion elegira el match mas confiable.
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
  // Mantiene compatibilidad con el flujo anterior devolviendo el primer descriptor disponible.
  const descriptors = await generateLocalFaceDescriptorCandidates(photo)
  return descriptors[0] ?? null
}

