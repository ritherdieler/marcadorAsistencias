import { getAuthUser } from './features/auth/utils/authStorage'
import { initObservability, initWebVitals, installAxiosObservability, readObsEnv } from './lib/observability'
import { http } from './services/httpClient'

const env = readObsEnv('web-asistencias')

initObservability({
  ...env,
  getUser: () => getAuthUser(),
  enableReplay: true,
})

initWebVitals(env)

installAxiosObservability(http)
