const TEMPLATE_112 = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
] as const

export type ArcFaceLandmarks = {
  leftEye: { x: number; y: number }
  rightEye: { x: number; y: number }
  nose: { x: number; y: number }
  leftMouth: { x: number; y: number }
  rightMouth: { x: number; y: number }
}

function scaledTemplate(outputSize: number): number[][] {
  const factor = outputSize / 112
  return TEMPLATE_112.map(([x, y]) => [x * factor, y * factor])
}

function similarityTransform(from: number[][], to: number[][]): DOMMatrix | null {
  const n = from.length
  if (n === 0 || to.length !== n) return null

  let meanFromX = 0
  let meanFromY = 0
  let meanToX = 0
  let meanToY = 0

  for (let i = 0; i < n; i += 1) {
    meanFromX += from[i][0]
    meanFromY += from[i][1]
    meanToX += to[i][0]
    meanToY += to[i][1]
  }

  meanFromX /= n
  meanFromY /= n
  meanToX /= n
  meanToY /= n

  let sxx = 0
  let a = 0
  let b = 0

  for (let i = 0; i < n; i += 1) {
    const px = from[i][0] - meanFromX
    const py = from[i][1] - meanFromY
    const qx = to[i][0] - meanToX
    const qy = to[i][1] - meanToY

    sxx += px * px + py * py
    a += px * qx + py * qy
    b += px * qy - py * qx
  }

  if (sxx === 0) return null

  const scaleCos = a / sxx
  const scaleSin = b / sxx
  const tx = meanToX - (scaleCos * meanFromX - scaleSin * meanFromY)
  const ty = meanToY - (scaleSin * meanFromX + scaleCos * meanFromY)

  const matrix = new DOMMatrix()
  matrix.a = scaleCos
  matrix.b = scaleSin
  matrix.c = -scaleSin
  matrix.d = scaleCos
  matrix.e = tx
  matrix.f = ty
  return matrix
}

export function alignFaceToArcFaceCanvas(
  image: ImageBitmap,
  landmarks: ArcFaceLandmarks,
  outputSize = 112,
): HTMLCanvasElement | null {
  const detected = [
    [landmarks.leftEye.x, landmarks.leftEye.y],
    [landmarks.rightEye.x, landmarks.rightEye.y],
    [landmarks.nose.x, landmarks.nose.y],
    [landmarks.leftMouth.x, landmarks.leftMouth.y],
    [landmarks.rightMouth.x, landmarks.rightMouth.y],
  ]

  const template = scaledTemplate(outputSize)
  const transform = similarityTransform(detected, template)
  if (!transform) return null

  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const context = canvas.getContext('2d')
  if (!context) return null

  context.fillStyle = '#000000'
  context.fillRect(0, 0, outputSize, outputSize)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.setTransform(transform)
  context.drawImage(image, 0, 0)
  context.setTransform(1, 0, 0, 1, 0, 0)

  return canvas
}

export function l2Normalize(values: number[]): number[] {
  const norm = Math.hypot(...values)
  if (norm === 0) return values
  return values.map((value) => value / norm)
}

export function estimateMouthCorners(
  box: { x: number; y: number; width: number; height: number },
  mouthCenter: { x: number; y: number },
): Pick<ArcFaceLandmarks, 'leftMouth' | 'rightMouth'> {
  const halfWidth = box.width * 0.12
  return {
    leftMouth: { x: mouthCenter.x - halfWidth, y: mouthCenter.y + box.height * 0.03 },
    rightMouth: { x: mouthCenter.x + halfWidth, y: mouthCenter.y + box.height * 0.03 },
  }
}
