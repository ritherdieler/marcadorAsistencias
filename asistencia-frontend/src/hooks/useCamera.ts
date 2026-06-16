import { useCallback, useEffect, useRef, useState } from 'react' // Hooks base de React

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null) // Referencia al <video> para pintar el stream
  const [stream, setStream] = useState<MediaStream | null>(null) // Stream activo de la cámara
  const [error, setError] = useState<string | null>(null) // Mensaje de error si falla getUserMedia
  const streamRef = useRef<MediaStream | null>(null) // Ref para cleanup estable (evita “apagar” por re-renders)

  const start = useCallback(async () => {
    setError(null) // Limpia error previo
    try {
      // Validación: algunos navegadores/contextos no exponen mediaDevices. // Compatibilidad
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador o contexto no soporta cámara (mediaDevices no disponible).')
        throw new Error('mediaDevices_not_available') // Lanza para que el caller lo capture
      }

      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Cámara frontal (si existe)
          width: { ideal: 1280 }, // Preferencia de resolución (no obligatoria)
          height: { ideal: 720 }, // Preferencia de resolución (no obligatoria)
        },
        audio: false, // No se necesita audio
      }) // Solicita permisos y obtiene stream
      streamRef.current = s // Guarda en ref para cleanup estable
      setStream(s) // Guarda en state para renderizarlo
    } catch (e) {
      // Mensaje con pista del error (NotAllowedError, NotFoundError, NotReadableError, etc.). // Debug
      const name = e instanceof DOMException ? e.name : 'Error'
      setError(`No se pudo acceder a la cámara (${name}). Revisa permisos del navegador.`)
      // Importante: re-lanzamos para que el caller no “asuma” que la cámara está lista. // Robustez
      throw e
    }
  }, [])

  const stop = useCallback(() => {
    // Detiene el stream actual (usa ref para asegurar el stream más reciente). // Cleanup
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null) // Limpia el stream (UI)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!stream) return
    video.srcObject = stream // Asigna el stream al <video>
    video.autoplay = true // Ayuda a evitar “pantalla negra” en algunos navegadores
    video.muted = true // Requisito para autoplay en muchos navegadores
    video.playsInline = true // Evita fullscreen forzado en iOS
    video.play().catch(() => {}) // Intenta reproducir (si el navegador lo permite)
  }, [stream])

  // Cleanup SOLO al desmontar el componente (no en cada re-render). // Fix principal
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  return { videoRef, stream, error, start, stop }
}
