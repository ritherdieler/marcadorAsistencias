import {
  estimateFacePoseFromLandmarks,
  type FacePose,
  type FacePose3d,
} from './facePose3d'
import type { FaceChallengeConfig, FaceChallengeTurnType } from './faceChallengeConfig'
import type { FaceLandmarkPoint } from './facePresenceDetector'

export type FacePoseAnalysisInput = {
  pose: FacePose
  pose3d?: FacePose3d
  landmarks?: FaceLandmarkPoint[]
}

export type EnrollmentCaptureAngle = 'front' | 'left' | 'right'

export function expectedProfilePose(side: 'left' | 'right', mirrorSelfie: boolean): FacePose {
  if (side === 'left') {
    return mirrorSelfie ? 'right' : 'left'
  }
  return mirrorSelfie ? 'left' : 'right'
}

export function expectedEnrollmentPose(angle: EnrollmentCaptureAngle, mirrorSelfie: boolean): FacePose {
  if (angle === 'front') return 'front'
  return expectedProfilePose(angle, mirrorSelfie)
}

export function expectedTurnPose(type: FaceChallengeTurnType, mirrorSelfie: boolean): FacePose {
  if (type === 'LEFT_TURN') {
    return expectedProfilePose('left', mirrorSelfie)
  }
  return expectedProfilePose('right', mirrorSelfie)
}

export function resolveFacePose(input: FacePoseAnalysisInput, config: FaceChallengeConfig): FacePose {
  if (config.usePose3d && input.pose3d !== undefined) {
    const { yaw } = input.pose3d
    const absYaw = Math.abs(yaw)

    if (absYaw <= config.thresholds.yawFrontDeg) {
      return 'front'
    }

    if (yaw <= -config.thresholds.yawTurnDeg) {
      return 'right'
    }

    if (yaw >= config.thresholds.yawTurnDeg) {
      return 'left'
    }

    return 'unknown'
  }

  if (input.landmarks?.length) {
    return estimateFacePoseFromLandmarks(input.landmarks)
  }

  return input.pose
}
