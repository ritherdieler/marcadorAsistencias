import { useEffect, useRef } from 'react'

import {
  FACE_CONTOUR_GROUPS,
  uniqueIndicesFromConnections,
} from '../services/faceLandmarkConnections'
import type { FaceAlignment } from '../services/faceAlignment'
import type {
  FaceLandmarkAlignmentColors,
  FaceLandmarkDrawStyle,
  FaceLandmarkLayers,
} from '../services/faceAlignmentConfig'
import { resolveLandmarkDrawColor } from '../services/faceAlignmentConfig'
import type { FaceLandmarkPoint } from '../services/facePresenceDetector'

type FaceLandmarksOverlayProps = {
  landmarks: FaceLandmarkPoint[] | null | undefined
  alignment: FaceAlignment
  mirror?: boolean
  landmarkLayers: FaceLandmarkLayers
  landmarkDrawStyle: FaceLandmarkDrawStyle
  landmarkPointSizePx: number
  landmarkAlignmentColors: FaceLandmarkAlignmentColors
}

export function FaceLandmarksOverlay({
  landmarks,
  alignment,
  mirror = false,
  landmarkLayers,
  landmarkDrawStyle,
  landmarkPointSizePx,
  landmarkAlignmentColors,
}: FaceLandmarksOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr
      canvas.height = height * dpr
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)

    if (!landmarks || landmarks.length === 0) return

    const toX = (point: FaceLandmarkPoint) => (mirror ? 1 - point.x : point.x) * width
    const toY = (point: FaceLandmarkPoint) => point.y * height
    const color = resolveLandmarkDrawColor(landmarkAlignmentColors, alignment)

    if (landmarkDrawStyle === 'continuous') {
      for (const group of FACE_CONTOUR_GROUPS) {
        if (!landmarkLayers[group.id]) continue

        const isTesselation = group.id === 'tesselation'
        context.strokeStyle = color
        context.lineWidth = isTesselation ? 0.8 : 1.4
        context.lineJoin = 'round'
        context.lineCap = 'round'
        context.globalAlpha = isTesselation ? 0.45 : 1

        context.beginPath()
        for (const [start, end] of group.connections) {
          const from = landmarks[start]
          const to = landmarks[end]
          if (!from || !to) continue
          context.moveTo(toX(from), toY(from))
          context.lineTo(toX(to), toY(to))
        }
        context.stroke()
        context.globalAlpha = 1
      }
      return
    }

    context.fillStyle = color
    const radius = landmarkPointSizePx / 2

    for (const group of FACE_CONTOUR_GROUPS) {
      if (!landmarkLayers[group.id]) continue

      const isTesselation = group.id === 'tesselation'
      const indices = isTesselation
        ? landmarks.map((_, index) => index)
        : uniqueIndicesFromConnections(group.connections)

      context.globalAlpha = isTesselation ? 0.45 : 1

      for (const index of indices) {
        const point = landmarks[index]
        if (!point) continue
        context.beginPath()
        context.arc(toX(point), toY(point), radius, 0, Math.PI * 2)
        context.fill()
      }

      context.globalAlpha = 1
    }
  }, [landmarks, alignment, mirror, landmarkLayers, landmarkDrawStyle, landmarkPointSizePx, landmarkAlignmentColors])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  )
}
