import { FaceLandmarker } from '@mediapipe/tasks-vision'

import type { FaceLandmarkLayerId } from './faceAlignmentConfig'

export type LandmarkConnection = readonly [number, number]

const toConnections = (
  connections: { start: number; end: number }[],
): LandmarkConnection[] => connections.map(({ start, end }) => [start, end] as const)

export const FACE_OVAL_CONNECTIONS = toConnections(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL)
export const LEFT_EYE_CONNECTIONS = toConnections(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE)
export const RIGHT_EYE_CONNECTIONS = toConnections(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE)
export const LIPS_CONNECTIONS = toConnections(FaceLandmarker.FACE_LANDMARKS_LIPS)
export const LEFT_EYEBROW_CONNECTIONS = toConnections(FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW)
export const RIGHT_EYEBROW_CONNECTIONS = toConnections(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW)
export const LEFT_IRIS_CONNECTIONS = toConnections(FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS)
export const RIGHT_IRIS_CONNECTIONS = toConnections(FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS)
export const FACE_NOSE_CONNECTIONS: LandmarkConnection[] = [
  [168, 6],
  [6, 197],
  [197, 195],
  [195, 5],
  [5, 4],
  [4, 1],
  [1, 19],
  [19, 94],
  [94, 2],
  [98, 97],
  [97, 2],
  [2, 326],
  [326, 327],
  [327, 294],
  [294, 278],
  [278, 344],
  [344, 440],
  [440, 275],
  [275, 4],
  [4, 45],
  [45, 220],
  [220, 115],
  [115, 48],
  [48, 64],
  [64, 98],
]

export const FACE_CONTOURS_CONNECTIONS = toConnections(FaceLandmarker.FACE_LANDMARKS_CONTOURS)
export const FACE_TESSELATION_CONNECTIONS = toConnections(FaceLandmarker.FACE_LANDMARKS_TESSELATION)

export type FaceContourGroup = {
  id: FaceLandmarkLayerId
  connections: LandmarkConnection[]
}

export const FACE_CONTOUR_GROUPS: FaceContourGroup[] = [
  { id: 'tesselation', connections: FACE_TESSELATION_CONNECTIONS },
  { id: 'oval', connections: FACE_OVAL_CONNECTIONS },
  { id: 'contours', connections: FACE_CONTOURS_CONNECTIONS },
  { id: 'leftEyebrow', connections: LEFT_EYEBROW_CONNECTIONS },
  { id: 'rightEyebrow', connections: RIGHT_EYEBROW_CONNECTIONS },
  { id: 'nose', connections: FACE_NOSE_CONNECTIONS },
  { id: 'leftEye', connections: LEFT_EYE_CONNECTIONS },
  { id: 'rightEye', connections: RIGHT_EYE_CONNECTIONS },
  { id: 'leftIris', connections: LEFT_IRIS_CONNECTIONS },
  { id: 'rightIris', connections: RIGHT_IRIS_CONNECTIONS },
  { id: 'lips', connections: LIPS_CONNECTIONS },
]

export function uniqueIndicesFromConnections(connections: LandmarkConnection[]): number[] {
  const indices = new Set<number>()
  for (const [start, end] of connections) {
    indices.add(start)
    indices.add(end)
  }
  return Array.from(indices)
}
