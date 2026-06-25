export type FaceConfigSectionId = 'coverage' | 'guides' | 'challenge' | 'advanced'

export type FaceConfigSection = {
  id: FaceConfigSectionId
  label: string
  hint: string
  panelId: string
}

export const FACE_CONFIG_SECTIONS: FaceConfigSection[] = [
  {
    id: 'coverage',
    label: 'Cobertura y distancia',
    hint: 'Objetivo, tolerancia y presets por flujo',
    panelId: 'face-config-panel-coverage',
  },
  {
    id: 'guides',
    label: 'Guias visuales',
    hint: 'Silueta, flechas, barra y marco',
    panelId: 'face-config-panel-guides',
  },
  {
    id: 'challenge',
    label: 'Reto activo',
    hint: 'Liveness anti-spoofing en kiosko',
    panelId: 'face-config-panel-challenge',
  },
  {
    id: 'advanced',
    label: 'Avanzado / Diagnostico',
    hint: 'Landmarks, colores y umbrales del reto',
    panelId: 'face-config-panel-advanced',
  },
]
