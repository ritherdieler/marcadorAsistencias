import { FaceDetector, FilesetResolver, type Detection } from '@mediapipe/tasks-vision'

let detectorPromise: Promise<FaceDetector> | null = null

const MEDIAPIPE_WASM_PATH = '/mediapipe/wasm'
const MEDIAPIPE_FACE_MODEL_PATH = '/mediapipe/models/blaze_face_short_range.tflite'
const MIN_FACE_AREA_RATIO = 0.006
const MIN_FACE_SCORE = 0.2
const MIN_FRAME_EDGE_RATIO = 0.004
const MIN_FRAME_SKIN_RATIO = 0.004

// Carga una sola instancia de MediaPipe FaceDetector para reutilizarla en cada frame.
async function getFaceDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = createFaceDetector()
  }

  return detectorPromise
}

// Inicializa MediaPipe desde archivos locales para no depender de CDNs externos en ejecucion.
async function createFaceDetector(): Promise<FaceDetector> {
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH)

  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MEDIAPIPE_FACE_MODEL_PATH,
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: MIN_FACE_SCORE,
  })
}

// Devuelve true cuando la camara tiene un rostro usable o, si MediaPipe falla, un frame humano probable.
export async function hasVisibleFace(video: HTMLVideoElement): Promise<boolean> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    return false
  }

  try {
    const detector = await getFaceDetector()
    const result = detector.detectForVideo(video, performance.now())
    const usableFaces = result.detections.filter((face) => isUsableFace(face, video))

    return usableFaces.length > 0 || hasHumanLikeFrame(video)
  } catch {
    // Si MediaPipe falla por WebGL/WASM/navegador, no bloquea el flujo: el backend DJL valida la identidad final.
    detectorPromise = null
    return hasHumanLikeFrame(video)
  }
}

// Valida calidad basica del rostro: confianza y tamano.
// El recuadro de pantalla es una guia visual; la identidad final siempre la confirma el backend DJL.
function isUsableFace(face: Detection, video: HTMLVideoElement): boolean {
  const box = face.boundingBox
  if (!box || box.width <= 0 || box.height <= 0) return false

  const score = face.categories[0]?.score ?? 0
  if (score < MIN_FACE_SCORE) return false

  const isNormalizedBox = box.width <= 1 && box.height <= 1
  const faceRatio = isNormalizedBox
    ? box.width * box.height
    : (box.width * box.height) / (video.videoWidth * video.videoHeight)
  if (faceRatio < MIN_FACE_AREA_RATIO) return false

  return true
}

// Respaldo liviano: evita bloquear la camara cuando MediaPipe falla, pero no acepta fondos planos.
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

// Rango amplio de color de piel para funcionar con distintas luces sin decidir identidad.
function isSkinLike(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return r > 35 && g > 25 && b > 15 && r > b && cb >= 70 && cb <= 145 && cr >= 125 && cr <= 190
}
