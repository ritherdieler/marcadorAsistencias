export type FaceCoverageFlow = 'attendance' | 'registration'

export type FaceCoverageSettings = {
  targetWidthPercent: number
}

export type FaceCoverageConfig = {
  attendance: FaceCoverageSettings
  registration: FaceCoverageSettings
}

export type FaceAlignmentRuntimeConfig = {
  minFaceWidth: number
  maxFaceWidth: number
  targetWidthPercent: number
  centerToleranceFront: number
  centerToleranceTurn: number
  centerTargetY: number
}

export const FACE_COVERAGE_MIN_PERCENT = 15
export const FACE_COVERAGE_MAX_PERCENT = 45
export const FACE_COVERAGE_MAX_FACE_WIDTH = 0.75

export const FACE_COVERAGE_STORAGE_KEY = 'giga-face-coverage-config'
export const FACE_COVERAGE_CONFIG_EVENT = 'giga-face-coverage-config-changed'

export const DEFAULT_FACE_COVERAGE_CONFIG: FaceCoverageConfig = {
  attendance: { targetWidthPercent: 20 },
  registration: { targetWidthPercent: 25 },
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

const SHARED_ALIGNMENT = {
  maxFaceWidth: FACE_COVERAGE_MAX_FACE_WIDTH,
  centerToleranceFront: 0.16,
  centerToleranceTurn: 0.3,
  centerTargetY: 0.46,
} as const

export function clampTargetPercent(value: number): number {
  return Math.min(FACE_COVERAGE_MAX_PERCENT, Math.max(FACE_COVERAGE_MIN_PERCENT, Math.round(value)))
}

export function normalizeFaceCoverageConfig(raw: unknown): FaceCoverageConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Partial<FaceCoverageConfig>) : {}

  return {
    attendance: {
      targetWidthPercent: clampTargetPercent(
        source.attendance?.targetWidthPercent ?? DEFAULT_FACE_COVERAGE_CONFIG.attendance.targetWidthPercent,
      ),
    },
    registration: {
      targetWidthPercent: clampTargetPercent(
        source.registration?.targetWidthPercent ?? DEFAULT_FACE_COVERAGE_CONFIG.registration.targetWidthPercent,
      ),
    },
  }
}

export function toRuntimeConfig(flow: FaceCoverageFlow, config: FaceCoverageConfig): FaceAlignmentRuntimeConfig {
  const targetWidthPercent = config[flow].targetWidthPercent
  return {
    ...SHARED_ALIGNMENT,
    targetWidthPercent,
    minFaceWidth: targetWidthPercent / 100,
  }
}

export function loadFaceCoverageConfig(): FaceCoverageConfig {
  try {
    const raw = localStorage.getItem(FACE_COVERAGE_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_FACE_COVERAGE_CONFIG }
    return normalizeFaceCoverageConfig(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_FACE_COVERAGE_CONFIG }
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
  return { ...DEFAULT_FACE_COVERAGE_CONFIG }
}

export function faceCoverageConfigsEqual(a: FaceCoverageConfig, b: FaceCoverageConfig): boolean {
  return (
    a.attendance.targetWidthPercent === b.attendance.targetWidthPercent &&
    a.registration.targetWidthPercent === b.registration.targetWidthPercent
  )
}
