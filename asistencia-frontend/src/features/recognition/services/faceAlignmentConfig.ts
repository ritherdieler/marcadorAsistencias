import type { FaceAlignment } from './faceAlignment'

export type FaceCoverageFlow = 'attendance' | 'registration'

export type FaceCoverageSettings = {
  targetWidthPercent: number
  upperWidthRatio: number
}

export type FaceLandmarkDrawStyle = 'continuous' | 'dotted'

export type FaceLandmarkAlignmentColorKey = 'aligned' | 'searching' | 'warning'

export type FaceLandmarkAlignmentColors = Record<FaceLandmarkAlignmentColorKey, string>

export const DEFAULT_LANDMARK_ALIGNMENT_COLORS: FaceLandmarkAlignmentColors = {
  aligned: '#34d399',
  searching: '#38bdf8',
  warning: '#fbbf24',
}

export const FACE_LANDMARK_COLOR_PRESETS = [
  { id: 'sky', label: 'Azul', value: '#38bdf8' },
  { id: 'emerald', label: 'Verde', value: '#34d399' },
  { id: 'amber', label: 'Ambar', value: '#fbbf24' },
  { id: 'white', label: 'Blanco', value: '#ffffff' },
  { id: 'brand', label: 'Corporativo', value: '#0b2d5b' },
] as const

export type FaceLandmarkLayerId =
  | 'oval'
  | 'leftEye'
  | 'rightEye'
  | 'lips'
  | 'leftEyebrow'
  | 'rightEyebrow'
  | 'nose'
  | 'leftIris'
  | 'rightIris'
  | 'contours'
  | 'tesselation'

export type FaceLandmarkLayers = Record<FaceLandmarkLayerId, boolean>

export type FaceGuideSettings = {
  showTargetOval: boolean
  showDirectionArrows: boolean
  showZoneBar: boolean
  dimOutside: boolean
  showProximityRing: boolean
}

export type FaceCoverageConfig = {
  attendance: FaceCoverageSettings
  registration: FaceCoverageSettings
  showFaceLandmarks: boolean
  showFaceBox: boolean
  faceGuide: FaceGuideSettings
  landmarkDrawStyle: FaceLandmarkDrawStyle
  landmarkPointSizePx: number
  landmarkAlignmentColors: FaceLandmarkAlignmentColors
  landmarkLayers: FaceLandmarkLayers
}

export type FaceAlignmentRuntimeConfig = {
  minFaceWidth: number
  maxFaceWidth: number
  targetWidthPercent: number
  maxTargetWidthPercent: number
  upperWidthRatio: number
  centerToleranceFront: number
  centerToleranceTurn: number
  centerTargetY: number
}

export const FACE_COVERAGE_MIN_PERCENT = 15
export const FACE_COVERAGE_MAX_PERCENT = 45
export const DEFAULT_FACE_COVERAGE_UPPER_RATIO = 1.35
export const FACE_COVERAGE_UPPER_RATIO_MIN = 1.1
export const FACE_COVERAGE_UPPER_RATIO_MAX = 1.6
export const FACE_COVERAGE_UPPER_RATIO_STEP = 0.05
export const FACE_COVERAGE_ABSOLUTE_MAX = 0.75

export const FACE_LANDMARK_POINT_SIZE_MIN = 2
export const FACE_LANDMARK_POINT_SIZE_MAX = 8

export const FACE_COVERAGE_STORAGE_KEY = 'giga-face-coverage-config'
export const FACE_COVERAGE_CONFIG_EVENT = 'giga-face-coverage-config-changed'

export const DEFAULT_FACE_LANDMARK_LAYERS: FaceLandmarkLayers = {
  oval: true,
  leftEye: true,
  rightEye: true,
  lips: true,
  leftEyebrow: false,
  rightEyebrow: false,
  nose: false,
  leftIris: false,
  rightIris: false,
  contours: false,
  tesselation: false,
}

export const DEFAULT_FACE_GUIDE_SETTINGS: FaceGuideSettings = {
  showTargetOval: true,
  showDirectionArrows: true,
  showZoneBar: false,
  dimOutside: true,
  showProximityRing: true,
}

export const DEFAULT_FACE_COVERAGE_CONFIG: FaceCoverageConfig = {
  attendance: { targetWidthPercent: 20, upperWidthRatio: DEFAULT_FACE_COVERAGE_UPPER_RATIO },
  registration: { targetWidthPercent: 25, upperWidthRatio: DEFAULT_FACE_COVERAGE_UPPER_RATIO },
  showFaceLandmarks: false,
  showFaceBox: false,
  faceGuide: { ...DEFAULT_FACE_GUIDE_SETTINGS },
  landmarkDrawStyle: 'continuous',
  landmarkPointSizePx: 3,
  landmarkAlignmentColors: { ...DEFAULT_LANDMARK_ALIGNMENT_COLORS },
  landmarkLayers: { ...DEFAULT_FACE_LANDMARK_LAYERS },
}

export const FACE_COVERAGE_PRESETS = [
  {
    id: 'far',
    label: 'Lejano',
    percent: 20,
    description: 'Permite marcar o registrar desde mas lejos. Ideal para kiosko.',
  },
  {
    id: 'standard',
    label: 'Estandar',
    percent: 25,
    description: 'Equilibrio entre comodidad y calidad de captura.',
  },
  {
    id: 'strict',
    label: 'Estricto',
    percent: 35,
    description: 'Exige mayor proximidad para mejorar precision facial.',
  },
] as const

export const FACE_COVERAGE_UPPER_RATIO_PRESETS = [
  { id: 'tight', label: 'Estrecha', ratio: 1.15, description: 'Poca tolerancia hacia la camara.' },
  { id: 'normal', label: 'Normal', ratio: 1.35, description: 'Equilibrio entre acercar y alejar.' },
  { id: 'wide', label: 'Amplia', ratio: 1.55, description: 'Mas margen antes de pedir alejarse.' },
] as const

const SHARED_ALIGNMENT = {
  centerToleranceFront: 0.1,
  centerToleranceTurn: 0.3,
  centerTargetY: 0.46,
} as const

export function computeMaxFaceWidth(targetWidthPercent: number, upperWidthRatio: number): number {
  const target = targetWidthPercent / 100
  return Math.min(FACE_COVERAGE_ABSOLUTE_MAX, target * upperWidthRatio)
}

export function computeMaxWidthPercent(targetWidthPercent: number, upperWidthRatio: number): number {
  return Math.round(computeMaxFaceWidth(targetWidthPercent, upperWidthRatio) * 100)
}

export function clampTargetPercent(value: number): number {
  return Math.min(FACE_COVERAGE_MAX_PERCENT, Math.max(FACE_COVERAGE_MIN_PERCENT, Math.round(value)))
}

export function clampUpperWidthRatio(value: number): number {
  const rounded = Math.round(value / FACE_COVERAGE_UPPER_RATIO_STEP) * FACE_COVERAGE_UPPER_RATIO_STEP
  return Math.min(
    FACE_COVERAGE_UPPER_RATIO_MAX,
    Math.max(FACE_COVERAGE_UPPER_RATIO_MIN, Number(rounded.toFixed(2))),
  )
}

function normalizeFaceCoverageSettings(
  raw: Partial<FaceCoverageSettings> | undefined,
  defaults: FaceCoverageSettings,
): FaceCoverageSettings {
  return {
    targetWidthPercent: clampTargetPercent(raw?.targetWidthPercent ?? defaults.targetWidthPercent),
    upperWidthRatio: clampUpperWidthRatio(raw?.upperWidthRatio ?? defaults.upperWidthRatio),
  }
}

export function clampLandmarkPointSize(value: number): number {
  return Math.min(
    FACE_LANDMARK_POINT_SIZE_MAX,
    Math.max(FACE_LANDMARK_POINT_SIZE_MIN, Math.round(value)),
  )
}

function normalizeLandmarkDrawStyle(value: unknown): FaceLandmarkDrawStyle {
  return value === 'dotted' ? 'dotted' : 'continuous'
}

function normalizeLandmarkColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback
}

function normalizeLandmarkAlignmentColors(
  raw: Partial<FaceLandmarkAlignmentColors> | undefined,
  legacy?: { landmarkColorMode?: unknown; landmarkColor?: unknown },
): FaceLandmarkAlignmentColors {
  if (legacy?.landmarkColorMode === 'custom' && typeof legacy.landmarkColor === 'string') {
    const custom = normalizeLandmarkColor(legacy.landmarkColor, DEFAULT_LANDMARK_ALIGNMENT_COLORS.searching)
    return { aligned: custom, searching: custom, warning: custom }
  }

  return {
    aligned: normalizeLandmarkColor(raw?.aligned, DEFAULT_LANDMARK_ALIGNMENT_COLORS.aligned),
    searching: normalizeLandmarkColor(raw?.searching, DEFAULT_LANDMARK_ALIGNMENT_COLORS.searching),
    warning: normalizeLandmarkColor(raw?.warning, DEFAULT_LANDMARK_ALIGNMENT_COLORS.warning),
  }
}

export function hexToRgba(hex: string, alpha = 0.9): string {
  const normalized = normalizeLandmarkColor(hex, DEFAULT_LANDMARK_ALIGNMENT_COLORS.searching)
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function resolveLandmarkDrawColor(
  colors: FaceLandmarkAlignmentColors,
  alignment: FaceAlignment,
): string {
  if (alignment === 'aligned') return hexToRgba(colors.aligned)
  if (alignment === 'searching') return hexToRgba(colors.searching)
  return hexToRgba(colors.warning)
}

function normalizeLandmarkLayers(raw: Partial<FaceLandmarkLayers> | undefined): FaceLandmarkLayers {
  return {
    oval: raw?.oval ?? DEFAULT_FACE_LANDMARK_LAYERS.oval,
    leftEye: raw?.leftEye ?? DEFAULT_FACE_LANDMARK_LAYERS.leftEye,
    rightEye: raw?.rightEye ?? DEFAULT_FACE_LANDMARK_LAYERS.rightEye,
    lips: raw?.lips ?? DEFAULT_FACE_LANDMARK_LAYERS.lips,
    leftEyebrow: raw?.leftEyebrow ?? DEFAULT_FACE_LANDMARK_LAYERS.leftEyebrow,
    rightEyebrow: raw?.rightEyebrow ?? DEFAULT_FACE_LANDMARK_LAYERS.rightEyebrow,
    nose: raw?.nose ?? DEFAULT_FACE_LANDMARK_LAYERS.nose,
    leftIris: raw?.leftIris ?? DEFAULT_FACE_LANDMARK_LAYERS.leftIris,
    rightIris: raw?.rightIris ?? DEFAULT_FACE_LANDMARK_LAYERS.rightIris,
    contours: raw?.contours ?? DEFAULT_FACE_LANDMARK_LAYERS.contours,
    tesselation: raw?.tesselation ?? DEFAULT_FACE_LANDMARK_LAYERS.tesselation,
  }
}

function normalizeFaceGuideSettings(raw: Partial<FaceGuideSettings> | undefined): FaceGuideSettings {
  return {
    showTargetOval: raw?.showTargetOval ?? DEFAULT_FACE_GUIDE_SETTINGS.showTargetOval,
    showDirectionArrows: raw?.showDirectionArrows ?? DEFAULT_FACE_GUIDE_SETTINGS.showDirectionArrows,
    showZoneBar: raw?.showZoneBar ?? DEFAULT_FACE_GUIDE_SETTINGS.showZoneBar,
    dimOutside: raw?.dimOutside ?? DEFAULT_FACE_GUIDE_SETTINGS.dimOutside,
    showProximityRing: raw?.showProximityRing ?? DEFAULT_FACE_GUIDE_SETTINGS.showProximityRing,
  }
}

export function normalizeFaceCoverageConfig(raw: unknown): FaceCoverageConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Partial<FaceCoverageConfig>) : {}

  return {
    attendance: normalizeFaceCoverageSettings(
      source.attendance,
      DEFAULT_FACE_COVERAGE_CONFIG.attendance,
    ),
    registration: normalizeFaceCoverageSettings(
      source.registration,
      DEFAULT_FACE_COVERAGE_CONFIG.registration,
    ),
    showFaceLandmarks: source.showFaceLandmarks ?? DEFAULT_FACE_COVERAGE_CONFIG.showFaceLandmarks,
    showFaceBox: source.showFaceBox ?? DEFAULT_FACE_COVERAGE_CONFIG.showFaceBox,
    faceGuide: normalizeFaceGuideSettings(source.faceGuide),
    landmarkDrawStyle: normalizeLandmarkDrawStyle(source.landmarkDrawStyle),
    landmarkPointSizePx: clampLandmarkPointSize(
      source.landmarkPointSizePx ?? DEFAULT_FACE_COVERAGE_CONFIG.landmarkPointSizePx,
    ),
    landmarkAlignmentColors: normalizeLandmarkAlignmentColors(source.landmarkAlignmentColors, {
      landmarkColorMode: (source as { landmarkColorMode?: unknown }).landmarkColorMode,
      landmarkColor: (source as { landmarkColor?: unknown }).landmarkColor,
    }),
    landmarkLayers: normalizeLandmarkLayers(source.landmarkLayers),
  }
}

export function toRuntimeConfig(flow: FaceCoverageFlow, config: FaceCoverageConfig): FaceAlignmentRuntimeConfig {
  const flowSettings = config[flow]
  const targetWidthPercent = flowSettings.targetWidthPercent
  const upperWidthRatio = flowSettings.upperWidthRatio
  const maxFaceWidth = computeMaxFaceWidth(targetWidthPercent, upperWidthRatio)
  return {
    ...SHARED_ALIGNMENT,
    targetWidthPercent,
    upperWidthRatio,
    minFaceWidth: targetWidthPercent / 100,
    maxFaceWidth,
    maxTargetWidthPercent: Math.round(maxFaceWidth * 100),
  }
}

export function loadFaceCoverageConfig(): FaceCoverageConfig {
  try {
    const raw = localStorage.getItem(FACE_COVERAGE_STORAGE_KEY)
    if (!raw) {
      return {
        ...DEFAULT_FACE_COVERAGE_CONFIG,
        landmarkAlignmentColors: { ...DEFAULT_LANDMARK_ALIGNMENT_COLORS },
        landmarkLayers: { ...DEFAULT_FACE_LANDMARK_LAYERS },
        faceGuide: { ...DEFAULT_FACE_GUIDE_SETTINGS },
      }
    }
    return normalizeFaceCoverageConfig(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_FACE_COVERAGE_CONFIG, landmarkAlignmentColors: { ...DEFAULT_LANDMARK_ALIGNMENT_COLORS }, landmarkLayers: { ...DEFAULT_FACE_LANDMARK_LAYERS }, faceGuide: { ...DEFAULT_FACE_GUIDE_SETTINGS } }
  }
}

export function saveFaceCoverageConfig(config: FaceCoverageConfig): FaceCoverageConfig {
  const normalized = normalizeFaceCoverageConfig(config)
  localStorage.setItem(FACE_COVERAGE_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new Event(FACE_COVERAGE_CONFIG_EVENT))
  return normalized
}

export function resetFaceCoverageConfig(): FaceCoverageConfig {
  localStorage.removeItem(FACE_COVERAGE_STORAGE_KEY)
  window.dispatchEvent(new Event(FACE_COVERAGE_CONFIG_EVENT))
  return { ...DEFAULT_FACE_COVERAGE_CONFIG, landmarkAlignmentColors: { ...DEFAULT_LANDMARK_ALIGNMENT_COLORS }, landmarkLayers: { ...DEFAULT_FACE_LANDMARK_LAYERS }, faceGuide: { ...DEFAULT_FACE_GUIDE_SETTINGS } }
}

function faceGuideSettingsEqual(a: FaceGuideSettings, b: FaceGuideSettings): boolean {
  return (
    a.showTargetOval === b.showTargetOval &&
    a.showDirectionArrows === b.showDirectionArrows &&
    a.showZoneBar === b.showZoneBar &&
    a.dimOutside === b.dimOutside &&
    a.showProximityRing === b.showProximityRing
  )
}

function landmarkLayersEqual(a: FaceLandmarkLayers, b: FaceLandmarkLayers): boolean {
  return (Object.keys(DEFAULT_FACE_LANDMARK_LAYERS) as FaceLandmarkLayerId[]).every((key) => a[key] === b[key])
}

function landmarkAlignmentColorsEqual(
  a: FaceLandmarkAlignmentColors,
  b: FaceLandmarkAlignmentColors,
): boolean {
  return a.aligned === b.aligned && a.searching === b.searching && a.warning === b.warning
}

function faceCoverageSettingsEqual(a: FaceCoverageSettings, b: FaceCoverageSettings): boolean {
  return a.targetWidthPercent === b.targetWidthPercent && a.upperWidthRatio === b.upperWidthRatio
}

export function faceCoverageConfigsEqual(a: FaceCoverageConfig, b: FaceCoverageConfig): boolean {
  return (
    faceCoverageSettingsEqual(a.attendance, b.attendance) &&
    faceCoverageSettingsEqual(a.registration, b.registration) &&
    a.showFaceLandmarks === b.showFaceLandmarks &&
    a.showFaceBox === b.showFaceBox &&
    faceGuideSettingsEqual(a.faceGuide, b.faceGuide) &&
    a.landmarkDrawStyle === b.landmarkDrawStyle &&
    a.landmarkPointSizePx === b.landmarkPointSizePx &&
    landmarkAlignmentColorsEqual(a.landmarkAlignmentColors, b.landmarkAlignmentColors) &&
    landmarkLayersEqual(a.landmarkLayers, b.landmarkLayers)
  )
}
