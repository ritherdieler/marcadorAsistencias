import type { ObsEnvironment, ObsPlatform } from './types'

interface RawObsEnv {
  VITE_OBS_BASE_URL?: string
  VITE_OBS_WS_URL?: string
  VITE_OBS_API_KEY?: string
  VITE_OBS_RELEASE?: string
  VITE_OBS_ENVIRONMENT?: string
  VITE_OBS_ENABLED?: string
  MODE?: string
  PROD?: boolean
  DEV?: boolean
}

function resolveEnvironment(env: RawObsEnv): ObsEnvironment {
  const explicit = env.VITE_OBS_ENVIRONMENT
  if (explicit === 'prod' || explicit === 'dev' || explicit === 'local') return explicit
  return env.PROD ? 'prod' : 'dev'
}

export interface ObsEnvConfig {
  platform: ObsPlatform
  baseUrl: string
  apiKey: string
  wsUrl?: string
  release?: string
  environment: ObsEnvironment
  enabled: boolean
}

export function readObsEnv(platform: ObsPlatform): ObsEnvConfig {
  const env = import.meta.env as unknown as RawObsEnv
  const enabledFlag = env.VITE_OBS_ENABLED
  return {
    platform,
    baseUrl: (env.VITE_OBS_BASE_URL ?? '').replace(/\/+$/, ''),
    apiKey: env.VITE_OBS_API_KEY ?? '',
    wsUrl: env.VITE_OBS_WS_URL,
    release: env.VITE_OBS_RELEASE ?? env.MODE,
    environment: resolveEnvironment(env),
    enabled: enabledFlag !== 'false',
  }
}
