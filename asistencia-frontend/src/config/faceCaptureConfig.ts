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

export const FACE_PREPROCESS_INPUT_SIZE = 224
export const FACE_PREPROCESS_MARGIN_RATIO = 0.2

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
