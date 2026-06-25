export type FaceCaptureProfileName = 'enrollment' | 'verification' | 'evidence'

export type FaceCaptureProfile = {
  maxWidth: number
  maxHeight: number
  quality: number
  format: 'jpeg'
  targetSizeBytes: number
  enhanceLowLight: boolean
}

export const FACE_CAMERA_CONSTRAINTS = {
  facingMode: 'user' as const,
  width: { min: 640, ideal: 1280, max: 1280 },
  height: { min: 480, ideal: 720, max: 720 },
}

export const FACE_CAPTURE_MIN_QUALITY = 0.7
export const FACE_CAPTURE_QUALITY_STEP = 0.05
export const FACE_CAPTURE_RESIZE_STEP = 0.9
export const FACE_CAPTURE_MAX_ADAPTIVE_ITERATIONS = 3

export const FACE_CAPTURE_PROFILES: Record<FaceCaptureProfileName, FaceCaptureProfile> = {
  enrollment: {
    maxWidth: 1280,
    maxHeight: 720,
    quality: 0.9,
    format: 'jpeg',
    targetSizeBytes: 500 * 1024,
    enhanceLowLight: true,
  },
  verification: {
    maxWidth: 960,
    maxHeight: 720,
    quality: 0.85,
    format: 'jpeg',
    targetSizeBytes: 350 * 1024,
    enhanceLowLight: true,
  },
  evidence: {
    maxWidth: 640,
    maxHeight: 480,
    quality: 0.8,
    format: 'jpeg',
    targetSizeBytes: 200 * 1024,
    enhanceLowLight: false,
  },
}

export const FACE_OFFLINE_DETECTOR_MIN_CONFIDENCE = 0.7

export const FACE_PREPROCESS_INPUT_SIZE = 112
export const FACE_PREPROCESS_MARGIN_RATIO = 0.2

// Modelo de embeddings usado en el reconocimiento offline del navegador.
// Debe permanecer SINCRONIZADO con el modelo del backend (face.embedding.*),
// porque el dataset offline trae embeddings generados por el backend y aqui
// se calcula el embedding de la foto probada. Si difieren, el matching offline falla.
//
// Default = modelo PyTorch exportado a ONNX (224x224), comportamiento identico al actual.
// Para ArcFace/InsightFace: colocar /models/face-feature/arcface_w600k_mbf.onnx,
// inputSize=112, mean=0.5, std=0.5 y replicar la alineacion de 5 puntos del backend.
export type FaceEmbeddingModelConfig = {
  modelUrl: string
  inputSize: number
  // Normalizacion en escala [0,1]: (canal/255 - mean) / std
  normalizeMean: number
  normalizeStd: number
}

export const FACE_EMBEDDING_MODEL: FaceEmbeddingModelConfig = {
  modelUrl: '/models/face-feature/arcface_w600k_mbf.onnx',
  inputSize: FACE_PREPROCESS_INPUT_SIZE,
  normalizeMean: 0.5,
  normalizeStd: 0.5,
}

export const FACE_OFFLINE_CENTER_CROP_SPECS = [
  { widthRatio: 0.82, heightRatio: 0.92, centerYRatio: 0.48 },
  { widthRatio: 0.68, heightRatio: 0.82, centerYRatio: 0.44 },
  { widthRatio: 0.96, heightRatio: 0.96, centerYRatio: 0.5 },
] as const

export const FACE_OFFLINE_DETECTED_CROP_SCALES = [
  { scale: 2.2, centerYShift: 0.08 },
  { scale: 2.8, centerYShift: 0.12 },
  { scale: 3.4, centerYShift: 0.16 },
] as const

export const FACE_OFFLINE_LIGHTING_VARIANTS = [
  { brightness: 0, contrast: 1, gamma: 1 },
  { brightness: 18, contrast: 1.18, gamma: 0.82 },
  { brightness: 32, contrast: 1.28, gamma: 0.72 },
] as const

export const FACE_VISION_CONFIG = {
  outputFaceBlendshapes: true,
  outputFacialTransformationMatrixes: true,
  numFaces: 1,
  minFaceDetectionConfidence: 0.2,
  minFacePresenceConfidence: 0.2,
  minTrackingConfidence: 0.5,
} as const
