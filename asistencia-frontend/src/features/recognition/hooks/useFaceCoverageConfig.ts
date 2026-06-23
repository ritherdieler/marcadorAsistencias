import { useCallback, useEffect, useState } from 'react'

import {
  FACE_COVERAGE_CONFIG_EVENT,
  loadFaceCoverageConfig,
  resetFaceCoverageConfig,
  saveFaceCoverageConfig,
  toRuntimeConfig,
  type FaceCoverageConfig,
  type FaceCoverageFlow,
} from '../services/faceAlignmentConfig'

export function useFaceCoverageConfig() {
  const [config, setConfig] = useState<FaceCoverageConfig>(() => loadFaceCoverageConfig())

  useEffect(() => {
    const sync = () => setConfig(loadFaceCoverageConfig())

    window.addEventListener(FACE_COVERAGE_CONFIG_EVENT, sync)
    window.addEventListener('storage', sync)

    return () => {
      window.removeEventListener(FACE_COVERAGE_CONFIG_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const save = useCallback((next: FaceCoverageConfig) => {
    const normalized = saveFaceCoverageConfig(next)
    setConfig(normalized)
    return normalized
  }, [])

  const reset = useCallback(() => {
    const defaults = resetFaceCoverageConfig()
    setConfig(defaults)
    return defaults
  }, [])

  const getRuntimeConfig = useCallback(
    (flow: FaceCoverageFlow) => toRuntimeConfig(flow, config),
    [config],
  )

  return { config, save, reset, getRuntimeConfig }
}
