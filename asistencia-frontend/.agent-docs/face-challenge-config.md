# Face challenge config (Fase 0)

> Documento consolidado: [`face-vision-unified.md`](face-vision-unified.md)

Added 2026-06-25. Configurable active liveness challenge stored in `localStorage` (`giga-face-challenge-config`).

## Module

- [`src/features/recognition/services/faceChallengeConfig.ts`](../src/features/recognition/services/faceChallengeConfig.ts): types, defaults, normalize/clamp, load/save/reset
- [`src/features/recognition/hooks/useFaceChallengeConfig.ts`](../src/features/recognition/hooks/useFaceChallengeConfig.ts): React hook with cross-tab sync
- [`src/features/settings/components/FaceChallengeControls.tsx`](../src/features/settings/components/FaceChallengeControls.tsx): admin UI (Spanish)
- [`src/features/recognition/services/activeFaceChallenge.ts`](../src/features/recognition/services/activeFaceChallenge.ts): dynamic step sequence from config; `submitAnalysis` + `submitPose` wrapper

## Defaults

| Field | Value |
|-------|-------|
| enabled | true |
| center / turn / recenter samples | 2 / 1 / 2 |
| blink enabled + samples | true / 1 |
| yawFrontDeg / yawTurnDeg | 8° / 18° |
| blinkOpenMax / blinkClosedMin | 0.25 / 0.55 |

## Admin page

[`AdminFaceCoveragePage`](../src/features/settings/pages/AdminFaceCoveragePage.tsx) includes challenge controls below coverage settings.

## Integration status

- `AttendanceMarker.tsx`: wired via `useFaceChallengeConfig`, `submitAnalysis` (pose3d + blink), skip gating when `enabled=false`.
- `faceIdentityService.ts`: online/offline identify extracted from marker (Fase 5).

## Build verification (2026-06-25)

- `npm run build` — OK (Fase 3 + Fase 5 integration)
