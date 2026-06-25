import { useCallback, useEffect, useState } from 'react'

import {
  FACE_CHALLENGE_CONFIG_EVENT,
  loadFaceChallengeConfig,
  resetFaceChallengeConfig,
  saveFaceChallengeConfig,
  type FaceChallengeConfig,
} from '../services/faceChallengeConfig'

export function useFaceChallengeConfig() {
  const [config, setConfig] = useState<FaceChallengeConfig>(() => loadFaceChallengeConfig())

  useEffect(() => {
    const sync = () => setConfig(loadFaceChallengeConfig())

    window.addEventListener(FACE_CHALLENGE_CONFIG_EVENT, sync)
    window.addEventListener('storage', sync)

    return () => {
      window.removeEventListener(FACE_CHALLENGE_CONFIG_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const save = useCallback((next: FaceChallengeConfig) => {
    const normalized = saveFaceChallengeConfig(next)
    setConfig(normalized)
    return normalized
  }, [])

  const reset = useCallback(() => {
    const defaults = resetFaceChallengeConfig()
    setConfig(defaults)
    return defaults
  }, [])

  return {
    config,
    save,
    reset,
    enabled: config.enabled,
  }
}
