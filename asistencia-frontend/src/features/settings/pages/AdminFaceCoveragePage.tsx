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
import { ChallengeBasicControls } from '../components/ChallengeBasicControls'
import { ChallengeThresholdControls } from '../components/ChallengeThresholdControls'
import { CoverageDistanceControls } from '../components/CoverageDistanceControls'
import { FaceConfigActionBar } from '../components/FaceConfigActionBar'
import { FaceConfigSectionNav } from '../components/FaceConfigSectionNav'
import { FACE_CONFIG_SECTIONS, type FaceConfigSectionId } from '../components/faceConfigSections'
import { FaceCoveragePreview } from '../components/FaceCoveragePreview'
import { LandmarkDiagnosticsControls } from '../components/LandmarkDiagnosticsControls'
import { VisualGuideControls } from '../components/VisualGuideControls'

function cloneChallengeConfig(config: FaceChallengeConfig): FaceChallengeConfig {
  return normalizeFaceChallengeConfig(config)
}

function flowSettingsEqual(
  a: FaceCoverageConfig['attendance'],
  b: FaceCoverageConfig['attendance'],
): boolean {
  return a.targetWidthPercent === b.targetWidthPercent && a.upperWidthRatio === b.upperWidthRatio
}

function faceGuideEqual(a: FaceGuideSettings, b: FaceGuideSettings): boolean {
  return (
    a.showTargetOval === b.showTargetOval &&
    a.showDirectionArrows === b.showDirectionArrows &&
    a.showZoneBar === b.showZoneBar &&
    a.dimOutside === b.dimOutside &&
    a.showProximityRing === b.showProximityRing
  )
}

function landmarkSettingsEqual(draft: FaceCoverageConfig, saved: FaceCoverageConfig): boolean {
  return (
    draft.showFaceLandmarks === saved.showFaceLandmarks &&
    draft.landmarkDrawStyle === saved.landmarkDrawStyle &&
    draft.landmarkPointSizePx === saved.landmarkPointSizePx &&
    JSON.stringify(draft.landmarkAlignmentColors) === JSON.stringify(saved.landmarkAlignmentColors) &&
    JSON.stringify(draft.landmarkLayers) === JSON.stringify(saved.landmarkLayers)
  )
}

function challengeCoreEqual(draft: FaceChallengeConfig, saved: FaceChallengeConfig): boolean {
  return (
    draft.enabled === saved.enabled &&
    draft.mirrorSelfiePerspective === saved.mirrorSelfiePerspective &&
    draft.usePose3d === saved.usePose3d &&
    JSON.stringify(draft.steps) === JSON.stringify(saved.steps)
  )
}

function challengeThresholdsEqual(draft: FaceChallengeConfig, saved: FaceChallengeConfig): boolean {
  return JSON.stringify(draft.thresholds) === JSON.stringify(saved.thresholds)
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
  const [activeSection, setActiveSection] = useState<FaceConfigSectionId>('coverage')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<{ variant: 'success' | 'info'; message: string } | null>(null)

  const hasCoveragePending = useMemo(
    () =>
      !flowSettingsEqual(draft.attendance, config.attendance) ||
      !flowSettingsEqual(draft.registration, config.registration),
    [config.attendance, config.registration, draft.attendance, draft.registration],
  )
  const hasGuidesPending = useMemo(
    () => draft.showFaceBox !== config.showFaceBox || !faceGuideEqual(draft.faceGuide, config.faceGuide),
    [config.faceGuide, config.showFaceBox, draft.faceGuide, draft.showFaceBox],
  )
  const hasLandmarksPending = useMemo(
    () => !landmarkSettingsEqual(draft, config),
    [config, draft],
  )
  const hasChallengeCorePending = useMemo(
    () => !challengeCoreEqual(challengeDraft, challengeConfig),
    [challengeConfig, challengeDraft],
  )
  const hasChallengeThresholdsPending = useMemo(
    () => !challengeThresholdsEqual(challengeDraft, challengeConfig),
    [challengeConfig, challengeDraft],
  )

  const hasPendingChanges = useMemo(
    () => !faceCoverageConfigsEqual(draft, config) || !faceChallengeConfigsEqual(challengeDraft, challengeConfig),
    [challengeConfig, challengeDraft, config, draft],
  )

  const pendingBySection = useMemo(
    () => ({
      coverage: hasCoveragePending,
      guides: hasGuidesPending,
      challenge: hasChallengeCorePending,
      advanced: hasLandmarksPending || hasChallengeThresholdsPending,
    }),
    [
      hasChallengeCorePending,
      hasChallengeThresholdsPending,
      hasCoveragePending,
      hasGuidesPending,
      hasLandmarksPending,
    ],
  )

  const activePanel = FACE_CONFIG_SECTIONS.find((section) => section.id === activeSection)

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
      if (!faceCoverageConfigsEqual(draft, config)) {
        save(draft)
      }
      if (!faceChallengeConfigsEqual(challengeDraft, challengeConfig)) {
        saveChallenge(challengeDraft)
      }
      setAlert({
        variant: 'success',
        message: 'Configuracion facial guardada. Se aplicara en marcacion y registro.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const coverageDefaults = reset()
    const challengeDefaults = resetChallenge()
    setDraft({
      attendance: { ...coverageDefaults.attendance },
      registration: { ...coverageDefaults.registration },
      showFaceLandmarks: coverageDefaults.showFaceLandmarks,
      showFaceBox: coverageDefaults.showFaceBox,
      landmarkDrawStyle: coverageDefaults.landmarkDrawStyle,
      landmarkPointSizePx: coverageDefaults.landmarkPointSizePx,
      landmarkAlignmentColors: { ...coverageDefaults.landmarkAlignmentColors },
      landmarkLayers: { ...coverageDefaults.landmarkLayers },
      faceGuide: { ...coverageDefaults.faceGuide },
    })
    setChallengeDraft(cloneChallengeConfig(challengeDefaults))
    setAlert({
      variant: 'info',
      message: `Valores recomendados restaurados: marcacion ${DEFAULT_FACE_COVERAGE_CONFIG.attendance.targetWidthPercent}% (ratio ${DEFAULT_FACE_COVERAGE_CONFIG.attendance.upperWidthRatio}x), registro ${DEFAULT_FACE_COVERAGE_CONFIG.registration.targetWidthPercent}% (ratio ${DEFAULT_FACE_COVERAGE_CONFIG.registration.upperWidthRatio}x), reto activo incluido.`,
    })
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuracion facial</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ajusta cobertura, guias visuales y reto activo. Los cambios se guardan en este navegador.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
        <div className="space-y-5">
          <FaceConfigSectionNav
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            pendingBySection={pendingBySection}
          />

          <section
            role="tabpanel"
            id={activePanel?.panelId}
            aria-labelledby={`face-config-tab-${activeSection}`}
            className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
          >
            {activeSection === 'coverage' && (
              <CoverageDistanceControls
                activeFlow={activeFlow}
                draft={draft}
                onFlowChange={setActiveFlow}
                onTargetChange={updateTarget}
                onUpperWidthRatioChange={updateUpperWidthRatio}
              />
            )}
            {activeSection === 'guides' && (
              <VisualGuideControls
                draft={draft}
                onFaceGuideChange={updateFaceGuide}
                onShowFaceBoxChange={updateShowFaceBox}
              />
            )}
            {activeSection === 'challenge' && (
              <ChallengeBasicControls draft={challengeDraft} onDraftChange={setChallengeDraft} />
            )}
            {activeSection === 'advanced' && (
              <div className="space-y-8">
                <LandmarkDiagnosticsControls
                  draft={draft}
                  onShowFaceLandmarksChange={updateShowFaceLandmarks}
                  onLandmarkDrawStyleChange={updateLandmarkDrawStyle}
                  onLandmarkPointSizeChange={updateLandmarkPointSize}
                  onLandmarkAlignmentColorChange={updateLandmarkAlignmentColor}
                  onLandmarkLayerChange={updateLandmarkLayer}
                />
                <ChallengeThresholdControls draft={challengeDraft} onDraftChange={setChallengeDraft} />
              </div>
            )}
          </section>

          <FaceConfigActionBar
            hasPendingChanges={hasPendingChanges}
            saving={saving}
            onSave={() => void handleSave()}
            onReset={handleReset}
          />
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
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
        </aside>
      </div>

      {alert && <ModalAlert variant={alert.variant} message={alert.message} onClose={() => setAlert(null)} />}
    </div>
  )
}
