import { useCallback, useEffect, useRef, useState } from 'react'

import { FACE_CAMERA_CONSTRAINTS } from '../config/faceCaptureConfig'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  const start = useCallback(async (deviceId?: string) => {
    setError(null)
    setPermissionDenied(false)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador o contexto no soporta cámara (mediaDevices no disponible).')
        throw new Error('mediaDevices_not_available')
      }

      streamRef.current?.getTracks().forEach(t => t.stop())

      const video = deviceId
        ? { ...FACE_CAMERA_CONSTRAINTS, deviceId: { exact: deviceId } }
        : FACE_CAMERA_CONSTRAINTS

      const s = await navigator.mediaDevices.getUserMedia({ video, audio: false })
      streamRef.current = s
      setStream(s)
    } catch (e) {
      const name = e instanceof DOMException ? e.name : 'Error'
      if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
        setPermissionDenied(true)
      }
      setError(`No se pudo acceder a la cámara (${name}). Revisa permisos del navegador.`)
      throw e
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setStream(null)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!stream) return
    video.srcObject = stream
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    video.play().catch(() => {})
  }, [stream])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  return { videoRef, stream, error, permissionDenied, start, stop }
}
