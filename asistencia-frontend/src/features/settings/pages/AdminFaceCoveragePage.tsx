import { useEffect, useMemo, useState } from 'react'

import { ModalAlert } from '../../../components/ui/ModalAlert'
import { useFaceChallengeConfig } from '../../recognition/hooks/useFaceChallengeConfig'
import { useFaceCoverageConfig } from '../../recognition/hooks/useFaceCoverageConfig'
import {
  clampLandmarkPointSize,
  clampTargetPercent,
  clampUpperWidthRatio,
  DEFAULT_FACE_COVERAGE_CONFIG,
  faceCoverageConfigsEqual,
  type FaceCoverageConfig,
  type FaceCoverageFlow,
  type FaceGuideSettings,
  type FaceLandmarkAlignmentColorKey,
  type FaceLandmarkDrawStyle,
  type FaceLandmarkLayerId,
} from '../../recognition/services/faceAlignmentConfig'
import {
  faceChallengeConfigsEqual,
  normalizeFaceChallengeConfig,
  type FaceChallengeConfig,
} from '../../recognition/services/faceChallengeConfig'
import { FaceChallengeControls } from '../components/FaceChallengeControls'
import { FaceCoverageControls } from '../components/FaceCoverageControls'
import { FaceCoveragePreview } from '../components/FaceCoveragePreview'

function cloneChallengeConfig(config: FaceChallengeConfig): FaceChallengeConfig {
  return normalizeFaceChallengeConfig(config)
}

export function AdminFaceCoveragePage() {
  const { config, save, reset } = useFaceCoverageConfig()
  const {
    config: challengeConfig,
    save: saveChallenge,
    reset: resetChallenge,
  } = useFaceChallengeConfig()
  const [draft, setDraft] = useState<FaceCoverageConfig>(() => ({
    ...config,
    attendance: { ...config.attendance },
    registration: { ...config.registration },
    landmarkLayers: { ...config.landmarkLayers },
    landmarkAlignmentColors: { ...config.landmarkAlignmentColors },
    faceGuide: { ...config.faceGuide },
  }))
  const [challengeDraft, setChallengeDraft] = useState<FaceChallengeConfig>(() => cloneChallengeConfig(challengeConfig))
  const [activeFlow, setActiveFlow] = useState<FaceCoverageFlow>('attendance')
  const [saving, setSaving] = useState(false)
  const [challengeSaving, setChallengeSaving] = useState(false)
  const [alert, setAlert] = useState<{ variant: 'success' | 'info'; message: string } | null>(null)

  const hasPendingChanges = useMemo(() => !faceCoverageConfigsEqual(draft, config), [config, draft])
  const hasChallengePendingChanges = useMemo(
    () => !faceChallengeConfigsEqual(challengeDraft, challengeConfig),
    [challengeConfig, challengeDraft],
  )

  useEffect(() => {
    setDraft({
      attendance: { ...config.attendance },
      registration: { ...config.registration },
      showFaceLandmarks: config.showFaceLandmarks,
      showFaceBox: config.showFaceBox,
      landmarkDrawStyle: config.landmarkDrawStyle,
      landmarkPointSizePx: config.landmarkPointSizePx,
      landmarkAlignmentColors: { ...config.landmarkAlignmentColors },
      landmarkLayers: { ...config.landmarkLayers },
      faceGuide: { ...config.faceGuide },
    })
  }, [config])

  useEffect(() => {
    setChallengeDraft(cloneChallengeConfig(challengeConfig))
  }, [challengeConfig])

  const updateTarget = (flow: FaceCoverageFlow, percent: number) => {
    setDraft((current) => ({
      ...current,
      [flow]: { ...current[flow], targetWidthPercent: clampTargetPercent(percent) },
    }))
  }

  const updateUpperWidthRatio = (flow: FaceCoverageFlow, ratio: number) => {
    setDraft((current) => ({
      ...current,
      [flow]: { ...current[flow], upperWidthRatio: clampUpperWidthRatio(ratio) },
    }))
  }

  const updateShowFaceLandmarks = (value: boolean) => {
    setDraft((current) => ({ ...current, showFaceLandmarks: value }))
  }

  const updateShowFaceBox = (value: boolean) => {
    setDraft((current) => ({ ...current, showFaceBox: value }))
  }

  const updateLandmarkDrawStyle = (value: FaceLandmarkDrawStyle) => {
    setDraft((current) => ({ ...current, landmarkDrawStyle: value }))
  }

  const updateLandmarkPointSize = (value: number) => {
    setDraft((current) => ({ ...current, landmarkPointSizePx: clampLandmarkPointSize(value) }))
  }

  const updateLandmarkAlignmentColor = (key: FaceLandmarkAlignmentColorKey, value: string) => {
    setDraft((current) => ({
      ...current,
      landmarkAlignmentColors: { ...current.landmarkAlignmentColors, [key]: value },
    }))
  }

  const updateLandmarkLayer = (layerId: FaceLandmarkLayerId, value: boolean) => {
    setDraft((current) => ({
      ...current,
      landmarkLayers: { ...current.landmarkLayers, [layerId]: value },
    }))
  }

  const updateFaceGuide = (key: keyof FaceGuideSettings, value: boolean) => {
    setDraft((current) => ({
      ...current,
      faceGuide: { ...current.faceGuide, [key]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      save(draft)
      setAlert({ variant: 'success', message: 'Configuracion facial guardada. Se aplicara en marcacion y registro.' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const defaults = reset()
    setDraft({
      attendance: { ...defaults.attendance },
      registration: { ...defaults.registration },
      showFaceLandmarks: defaults.showFaceLandmarks,
      showFaceBox: defaults.showFaceBox,
      landmarkDrawStyle: defaults.landmarkDrawStyle,
      landmarkPointSizePx: defaults.landmarkPointSizePx,
      landmarkAlignmentColors: { ...defaults.landmarkAlignmentColors },
      landmarkLayers: { ...defaults.landmarkLayers },
      faceGuide: { ...defaults.faceGuide },
    })
    setAlert({
      variant: 'info',
      message: `Valores recomendados restaurados: marcacion ${DEFAULT_FACE_COVERAGE_CONFIG.attendance.targetWidthPercent}% (ratio ${DEFAULT_FACE_COVERAGE_CONFIG.attendance.upperWidthRatio}x), registro ${DEFAULT_FACE_COVERAGE_CONFIG.registration.targetWidthPercent}% (ratio ${DEFAULT_FACE_COVERAGE_CONFIG.registration.upperWidthRatio}x).`,
    })
  }

  const handleChallengeSave = async () => {
    setChallengeSaving(true)
    try {
      saveChallenge(challengeDraft)
      setAlert({ variant: 'success', message: 'Configuracion del reto activo guardada. Se aplicara en marcacion.' })
    } finally {
      setChallengeSaving(false)
    }
  }

  const handleChallengeReset = () => {
    const defaults = resetChallenge()
    setChallengeDraft(cloneChallengeConfig(defaults))
    setAlert({
      variant: 'info',
      message: 'Valores recomendados del reto activo restaurados.',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuracion facial</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ajusta de forma interactiva la cobertura minima del rostro y el reto activo anti-spoofing. Los cambios se guardan en este navegador.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="order-2 xl:order-1">
          <FaceCoverageControls
            activeFlow={activeFlow}
            draft={draft}
            hasPendingChanges={hasPendingChanges}
            saving={saving}
            onFlowChange={setActiveFlow}
            onTargetChange={updateTarget}
            onUpperWidthRatioChange={updateUpperWidthRatio}
            onShowFaceLandmarksChange={updateShowFaceLandmarks}
            onShowFaceBoxChange={updateShowFaceBox}
            onLandmarkDrawStyleChange={updateLandmarkDrawStyle}
            onLandmarkPointSizeChange={updateLandmarkPointSize}
            onLandmarkAlignmentColorChange={updateLandmarkAlignmentColor}
            onLandmarkLayerChange={updateLandmarkLayer}
            onFaceGuideChange={updateFaceGuide}
            onSave={() => void handleSave()}
            onReset={handleReset}
          />
        </section>

        <section className="order-1 xl:order-2">
          <FaceCoveragePreview
            activeFlow={activeFlow}
            flowSettings={draft[activeFlow]}
            showFaceLandmarks={draft.showFaceLandmarks}
            showFaceBox={draft.showFaceBox}
            landmarkDrawStyle={draft.landmarkDrawStyle}
            landmarkPointSizePx={draft.landmarkPointSizePx}
            landmarkAlignmentColors={draft.landmarkAlignmentColors}
            landmarkLayers={draft.landmarkLayers}
            faceGuide={draft.faceGuide}
          />
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <FaceChallengeControls
          draft={challengeDraft}
          onDraftChange={setChallengeDraft}
          hasPendingChanges={hasChallengePendingChanges}
          saving={challengeSaving}
          onSave={() => void handleChallengeSave()}
          onReset={handleChallengeReset}
        />
      </section>

      {alert && <ModalAlert variant={alert.variant} message={alert.message} onClose={() => setAlert(null)} />}
    </div>
  )
}
