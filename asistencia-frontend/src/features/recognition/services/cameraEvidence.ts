import {
  FACE_CAPTURE_MAX_ADAPTIVE_ITERATIONS,
  FACE_CAPTURE_MIN_QUALITY,
  FACE_CAPTURE_PROFILES,
  FACE_CAPTURE_QUALITY_STEP,
  FACE_CAPTURE_RESIZE_STEP,
  type FaceCaptureProfile,
  type FaceCaptureProfileName,
} from '../../../config/faceCaptureConfig'
import { createMonotonicProgress, type ProgressCallback } from '../../../utils/monotonicProgress'
import { yieldToUi } from '../../../utils/yieldToUi'

export type CaptureProgressCallback = ProgressCallback

export function captureVideoFrame(video: HTMLVideoElement, quality = 0.82): string | null {
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
  targetSizeBytes?: number
}

const LOW_LIGHT_TARGET_LUMA = 118
const LOW_LIGHT_MAX_GAIN = 1.35
const LOW_LIGHT_CONTRAST = 1.08

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

function clampColor(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function canvasToBlob(canvas: HTMLCanvasElement, format: 'jpeg' | 'png', quality: number): Promise<Blob> {
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob)
        else reject(new Error('No se pudo capturar la foto facial.'))
      },
      mimeType,
      format === 'jpeg' ? quality : undefined,
    )
  })
}

async function renderVideoFrameBlob(
  video: HTMLVideoElement,
  options: Required<Pick<CaptureBlobOptions, 'quality' | 'maxWidth' | 'maxHeight' | 'format' | 'enhanceLowLight'>>,
  report?: ProgressCallback,
): Promise<Blob> {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight

  if (!sourceWidth || !sourceHeight) {
    throw new Error('video_not_ready')
  }

  const scale = Math.min(options.maxWidth / sourceWidth, options.maxHeight / sourceHeight, 1)
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No se pudo preparar la captura de camara.')
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(video, 0, 0, width, height)
  report?.(35)
  await yieldToUi()

  if (options.enhanceLowLight) {
    enhanceLowLightIfNeeded(ctx, width, height)
    report?.(55)
    await yieldToUi()
  }

  return canvasToBlob(canvas, options.format, options.quality)
}

function compressionIterationProgress(iteration: number): number {
  const maxIterations = FACE_CAPTURE_MAX_ADAPTIVE_ITERATIONS + 1
  return 60 + Math.round((iteration / maxIterations) * 25)
}

async function compressToTargetSize(
  video: HTMLVideoElement,
  baseOptions: Required<Pick<CaptureBlobOptions, 'quality' | 'maxWidth' | 'maxHeight' | 'format' | 'enhanceLowLight'>> & {
    targetSizeBytes: number
  },
  report?: ProgressCallback,
): Promise<Blob> {
  let quality = baseOptions.quality
  let maxWidth = baseOptions.maxWidth
  let maxHeight = baseOptions.maxHeight

  for (let iteration = 0; iteration <= FACE_CAPTURE_MAX_ADAPTIVE_ITERATIONS; iteration++) {
    report?.(compressionIterationProgress(iteration))
    await yieldToUi()

    const blob = await renderVideoFrameBlob(
      video,
      {
        quality,
        maxWidth,
        maxHeight,
        format: baseOptions.format,
        enhanceLowLight: baseOptions.enhanceLowLight,
      },
      report,
    )

    if (blob.size <= baseOptions.targetSizeBytes) {
      return blob
    }

    if (quality - FACE_CAPTURE_QUALITY_STEP >= FACE_CAPTURE_MIN_QUALITY) {
      quality = Number((quality - FACE_CAPTURE_QUALITY_STEP).toFixed(2))
      continue
    }

    if (iteration < FACE_CAPTURE_MAX_ADAPTIVE_ITERATIONS) {
      maxWidth = Math.max(320, Math.round(maxWidth * FACE_CAPTURE_RESIZE_STEP))
      maxHeight = Math.max(240, Math.round(maxHeight * FACE_CAPTURE_RESIZE_STEP))
      quality = baseOptions.quality
      continue
    }

    return blob
  }

  return renderVideoFrameBlob(video, baseOptions, report)
}

function resolveCaptureOptions(
  options: CaptureBlobOptions | number,
): Required<Pick<CaptureBlobOptions, 'quality' | 'maxWidth' | 'maxHeight' | 'format' | 'enhanceLowLight'>> & {
  targetSizeBytes?: number
} {
  const sourceWidth = 1280
  const sourceHeight = 720

  if (typeof options === 'number') {
    return {
      quality: options,
      format: 'jpeg',
      maxWidth: sourceWidth,
      maxHeight: sourceHeight,
      enhanceLowLight: false,
    }
  }

  return {
    quality: options.quality ?? 0.82,
    format: options.format ?? 'jpeg',
    maxWidth: options.maxWidth ?? sourceWidth,
    maxHeight: options.maxHeight ?? sourceHeight,
    enhanceLowLight: options.enhanceLowLight ?? false,
    targetSizeBytes: options.targetSizeBytes,
  }
}

export async function captureVideoFrameBlob(
  video: HTMLVideoElement,
  options: CaptureBlobOptions | number = 0.82,
  onProgress?: CaptureProgressCallback,
): Promise<Blob> {
  const report = createMonotonicProgress(onProgress)
  const resolved = resolveCaptureOptions(options)

  if (resolved.targetSizeBytes) {
    return compressToTargetSize(
      video,
      {
        quality: resolved.quality,
        maxWidth: resolved.maxWidth,
        maxHeight: resolved.maxHeight,
        format: resolved.format,
        enhanceLowLight: resolved.enhanceLowLight,
        targetSizeBytes: resolved.targetSizeBytes,
      },
      report,
    )
  }

  return renderVideoFrameBlob(video, resolved, report)
}

function profileToCaptureOptions(profile: FaceCaptureProfile): CaptureBlobOptions {
  return {
    maxWidth: profile.maxWidth,
    maxHeight: profile.maxHeight,
    quality: profile.quality,
    format: profile.format,
    enhanceLowLight: profile.enhanceLowLight,
    targetSizeBytes: profile.targetSizeBytes,
  }
}

export async function captureFacePhoto(
  video: HTMLVideoElement,
  profile: FaceCaptureProfileName,
  onProgress?: CaptureProgressCallback,
): Promise<Blob> {
  const report = createMonotonicProgress(onProgress)
  report(5)
  await yieldToUi()

  const blob = await captureVideoFrameBlob(video, profileToCaptureOptions(FACE_CAPTURE_PROFILES[profile]), report)
  report(90)
  return blob
}
