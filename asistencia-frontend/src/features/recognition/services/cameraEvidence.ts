export function captureVideoFrame(video: HTMLVideoElement, quality = 0.82): string | null {
  // Captura el frame actual del video y lo convierte a JPEG Base64 para enviarlo al backend.
  const width = video.videoWidth
  const height = video.videoHeight

  if (!width || !height) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(video, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

type CaptureBlobOptions = {
  quality?: number
  maxWidth?: number
  maxHeight?: number
  format?: 'jpeg' | 'png'
  enhanceLowLight?: boolean
}

const LOW_LIGHT_TARGET_LUMA = 118
const LOW_LIGHT_MAX_GAIN = 1.35
const LOW_LIGHT_CONTRAST = 1.08

// Mejora suavemente frames oscuros para que el backend pueda detectar el rostro con menos luz.
function enhanceLowLightIfNeeded(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const pixels = imageData.data
  let lumaSum = 0
  let sampledPixels = 0

  for (let index = 0; index < pixels.length; index += 16) {
    const r = pixels[index]
    const g = pixels[index + 1]
    const b = pixels[index + 2]
    lumaSum += 0.299 * r + 0.587 * g + 0.114 * b
    sampledPixels++
  }

  const averageLuma = sampledPixels ? lumaSum / sampledPixels : LOW_LIGHT_TARGET_LUMA
  if (averageLuma >= LOW_LIGHT_TARGET_LUMA) return

  const brightnessGain = Math.min(LOW_LIGHT_MAX_GAIN, LOW_LIGHT_TARGET_LUMA / Math.max(averageLuma, 1))

  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = clampColor(((pixels[index] - 128) * LOW_LIGHT_CONTRAST + 128) * brightnessGain)
    pixels[index + 1] = clampColor(((pixels[index + 1] - 128) * LOW_LIGHT_CONTRAST + 128) * brightnessGain)
    pixels[index + 2] = clampColor(((pixels[index + 2] - 128) * LOW_LIGHT_CONTRAST + 128) * brightnessGain)
  }

  ctx.putImageData(imageData, 0, 0)
}

// Mantiene cada canal RGB dentro del rango valido de imagen.
function clampColor(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export async function captureVideoFrameBlob(
  video: HTMLVideoElement,
  options: CaptureBlobOptions | number = 0.82,
): Promise<Blob> {
  // Captura el frame actual como imagen para que el backend genere el embedding con DJL.
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight

  if (!sourceWidth || !sourceHeight) {
    throw new Error('video_not_ready')
  }

  const quality = typeof options === 'number' ? options : options.quality ?? 0.82
  const format = typeof options === 'number' ? 'jpeg' : options.format ?? 'jpeg'
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
  const enhanceLowLight = typeof options === 'number' ? false : options.enhanceLowLight ?? false
  const maxWidth = typeof options === 'number' ? sourceWidth : options.maxWidth ?? sourceWidth
  const maxHeight = typeof options === 'number' ? sourceHeight : options.maxHeight ?? sourceHeight
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1)
  const width = Math.round(sourceWidth * scale)
  const height = Math.round(sourceHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No se pudo preparar la captura de camara.')
  }

  ctx.drawImage(video, 0, 0, width, height)
  if (enhanceLowLight) {
    enhanceLowLightIfNeeded(ctx, width, height)
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('No se pudo capturar la foto facial.'))
      },
      mimeType,
      format === 'jpeg' ? quality : undefined,
    )
  })
}
