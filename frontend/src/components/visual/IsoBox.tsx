export type IsoPalette = {
  top: string
  left: string
  right: string
  stroke: string
}

export const proposedPalette: IsoPalette = {
  top: '#F3D7A4',
  left: '#E4C184',
  right: '#C99655',
  stroke: '#146E54',
}

export const existingPalette: IsoPalette = {
  top: '#E6E2D8',
  left: '#D2CEC6',
  right: '#B9B5AD',
  stroke: '#5C6B64',
}

const COS = Math.cos(Math.PI / 6)
const SIN = Math.sin(Math.PI / 6)

export function project(x: number, y: number, z: number): [number, number] {
  return [(x - z) * COS, (x + z) * SIN - y]
}

export interface IsoModel {
  points: [number, number][]
  faces: { id: string; d: string; fill: string }[]
  stroke: string
  label: [number, number]
}

function path(points: [number, number][]) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(2)} ${point[1].toFixed(2)}`).join(' ') + ' Z'
}

export function isoBox(length: number, width: number, height: number, offsetX: number, palette: IsoPalette): IsoModel {
  const point = (x: number, y: number, z: number) => project(x + offsetX, y, z)
  const top = [point(0, height, 0), point(length, height, 0), point(length, height, width), point(0, height, width)]
  const right = [point(length, 0, 0), point(length, height, 0), point(length, height, width), point(length, 0, width)]
  const left = [point(0, 0, width), point(0, height, width), point(length, height, width), point(length, 0, width)]
  const points = [...top, ...right, ...left, point(0, 0, 0), point(length, 0, 0)]
  const lowest = Math.max(...points.map((item) => item[1]))
  const labelX = (point(0, 0, 0)[0] + point(length, 0, width)[0]) / 2
  return {
    points,
    faces: [
      { id: 'left', d: path(left), fill: palette.left },
      { id: 'right', d: path(right), fill: palette.right },
      { id: 'top', d: path(top), fill: palette.top },
    ],
    stroke: palette.stroke,
    label: [labelX, lowest],
  }
}

export function boundsOf(points: [number, number][], pad: number) {
  const xs = points.map((point) => point[0])
  const ys = points.map((point) => point[1])
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const maxX = Math.max(...xs) + pad
  const maxY = Math.max(...ys) + pad
  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
    viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
  }
}

export function FittedIso({
  length,
  width,
  height,
  label,
}: {
  length: number
  width: number
  height: number
  label: string
}) {
  const model = isoBox(length, width, height, 0, proposedPalette)
  const bounds = boundsOf(model.points, 12)
  return (
    <svg viewBox={bounds.viewBox} role="img" aria-label={label} className="h-full w-full">
      {model.faces.map((face) => (
        <path key={face.id} d={face.d} fill={face.fill} stroke={model.stroke} strokeWidth={1.4} strokeLinejoin="round" />
      ))}
    </svg>
  )
}
