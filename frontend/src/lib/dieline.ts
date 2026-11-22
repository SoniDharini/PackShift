import { formatDims, formatMm, formatNumber } from './format.ts'
import { escapeXml, num, type VectorDrawing } from './svg.ts'
import type { PackagingDesign } from '../types/packaging.ts'

type Panel = { name: string; x: number; w: number }

function outlinePath(panels: Panel[], flap: number, height: number, slot: number, slotDepth: number) {
  const s = slot / 2
  const first = panels[0]
  const last = panels[panels.length - 1]
  const totalW = last.x + last.w
  const yTop = 0
  const yFoldTop = flap
  const ySlotTop = flap + slotDepth
  const yFoldBot = flap + height
  const ySlotBot = flap + height - slotDepth
  const yBot = flap * 2 + height
  const pts: number[][] = [[first.x + s, yTop]]

  for (let index = 0; index < panels.length; index += 1) {
    const panel = panels[index]
    const left = panel.x + s
    const right = panel.x + panel.w - s
    if (index > 0) {
      pts.push([left, yFoldTop])
      pts.push([left, yTop])
    }
    pts.push([right, yTop])
    pts.push([right, yFoldTop])
    if (index < panels.length - 1) {
      pts.push([right, ySlotTop])
      pts.push([panels[index + 1].x + s, ySlotTop])
    }
  }

  pts.push([totalW, yFoldTop])
  pts.push([totalW, yFoldBot])

  for (let index = panels.length - 1; index >= 0; index -= 1) {
    const panel = panels[index]
    const left = panel.x + s
    const right = panel.x + panel.w - s
    pts.push([right, yFoldBot])
    pts.push([right, yBot])
    pts.push([left, yBot])
    pts.push([left, yFoldBot])
    if (index > 0) {
      pts.push([left, ySlotBot])
      const previous = panels[index - 1]
      pts.push([previous.x + previous.w - s, ySlotBot])
    }
  }

  const inset = Math.min(14, height / 4)
  pts.push([first.x, yFoldBot])
  pts.push([0, yFoldBot - inset])
  pts.push([0, yFoldTop + inset])
  pts.push([first.x, yFoldTop])
  pts.push([first.x + s, yFoldTop])
  pts.push([first.x + s, yTop])

  return pts.map((point, index) => `${index === 0 ? 'M' : 'L'} ${num(point[0])} ${num(point[1])}`).join(' ') + ' Z'
}

function hDim(id: string, x1: number, x2: number, y: number, label: string, font: number) {
  const mid = (x1 + x2) / 2
  return `
    <line x1="${num(x1)}" y1="${num(y - font)}" x2="${num(x1)}" y2="${num(y + 4)}" stroke="#9AA79F" stroke-width="1.2"/>
    <line x1="${num(x2)}" y1="${num(y - font)}" x2="${num(x2)}" y2="${num(y + 4)}" stroke="#9AA79F" stroke-width="1.2"/>
    <line x1="${num(x1)}" y1="${num(y)}" x2="${num(x2)}" y2="${num(y)}" stroke="#142923" stroke-width="1.5" marker-start="url(#${id}-start)" marker-end="url(#${id}-end)"/>
    <text x="${num(mid)}" y="${num(y - 6)}" text-anchor="middle" font-size="${num(font)}" fill="#142923">${escapeXml(label)}</text>
  `
}

function vDim(id: string, x: number, y1: number, y2: number, label: string, font: number) {
  const mid = (y1 + y2) / 2
  const textX = x + font
  return `
    <line x1="${num(x - 4)}" y1="${num(y1)}" x2="${num(x + font)}" y2="${num(y1)}" stroke="#9AA79F" stroke-width="1.2"/>
    <line x1="${num(x - 4)}" y1="${num(y2)}" x2="${num(x + font)}" y2="${num(y2)}" stroke="#9AA79F" stroke-width="1.2"/>
    <line x1="${num(x)}" y1="${num(y1)}" x2="${num(x)}" y2="${num(y2)}" stroke="#142923" stroke-width="1.5" marker-start="url(#${id}-start)" marker-end="url(#${id}-end)"/>
    <text x="${num(textX)}" y="${num(mid)}" text-anchor="middle" font-size="${num(font)}" fill="#142923" transform="rotate(-90 ${num(textX)} ${num(mid)})">${escapeXml(label)}</text>
  `
}

export function buildDieline(design: PackagingDesign, idPrefix: string): VectorDrawing {
  const length = design.internal.l
  const width = design.internal.w
  const height = design.internal.h
  const flap = design.flapDepth
  const glue = design.glueFlap
  const slot = design.slotWidth
  const slotDepth = design.slotDepth
  const panels: Panel[] = [
    { name: 'Length', x: glue, w: length },
    { name: 'Width', x: glue + length, w: width },
    { name: 'Length', x: glue + length + width, w: length },
    { name: 'Width', x: glue + length + width + length, w: width },
  ]
  const totalW = design.blankLength
  const totalH = design.blankWidth
  const font = Math.max(15, totalW * 0.024)
  const small = font * 0.78
  const stroke = Math.max(1.7, totalW * 0.0028)
  const inset = Math.min(14, height / 4)
  const yBody = flap
  const scores = [
    `M ${num(glue)} ${num(yBody)} L ${num(glue)} ${num(yBody + height)}`,
    ...panels.slice(1).map((panel) => `M ${num(panel.x)} ${num(yBody + slotDepth)} L ${num(panel.x)} ${num(yBody + height - slotDepth)}`),
    ...panels.flatMap((panel) => {
      const x1 = panel.x + slot / 2
      const x2 = panel.x + panel.w - slot / 2
      return [
        `M ${num(x1)} ${num(yBody)} L ${num(x2)} ${num(yBody)}`,
        `M ${num(x1)} ${num(yBody + height)} L ${num(x2)} ${num(yBody + height)}`,
      ]
    }),
  ].join(' ')

  const labels = panels
    .map((panel) => {
      const x = panel.x + panel.w / 2
      const y = yBody + height / 2
      return `<text x="${num(x)}" y="${num(y)}" text-anchor="middle" fill="#142923" font-size="${num(font)}">
        <tspan x="${num(x)}" dy="${num(-small * 0.2)}" font-weight="600">${escapeXml(panel.name)}</tspan>
        <tspan x="${num(x)}" dy="${num(small * 1.25)}" font-size="${num(small)}" fill="#4A5C54">${escapeXml(formatMm(panel.w))}</tspan>
      </text>`
    })
    .join('')

  const first = panels[0]
  const glueLabelX = glue / 2
  const glueLabelY = yBody + height / 2
  const legendY = totalH + font * 3.3
  const inner = `
    <g font-family="Inter, ui-sans-serif, system-ui, sans-serif">
      <defs>
        <marker id="${idPrefix}-end" markerWidth="${num(font * 0.7)}" markerHeight="${num(font * 0.7)}" refX="${num(font * 0.55)}" refY="${num(font * 0.35)}" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0 L${num(font * 0.7)} ${num(font * 0.35)} L0 ${num(font * 0.7)} Z" fill="#142923"/>
        </marker>
        <marker id="${idPrefix}-start" markerWidth="${num(font * 0.7)}" markerHeight="${num(font * 0.7)}" refX="${num(font * 0.12)}" refY="${num(font * 0.35)}" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M${num(font * 0.7)} 0 L0 ${num(font * 0.35)} L${num(font * 0.7)} ${num(font * 0.7)} Z" fill="#142923"/>
        </marker>
      </defs>
      <text x="0" y="${num(-font * 2.5)}" font-size="${num(font * 1.15)}" font-weight="600" fill="#142923">${escapeXml(design.productName)}</text>
      <text x="0" y="${num(-font * 1.15)}" font-size="${num(small)}" fill="#4A5C54">FEFCO 0201 · internal ${escapeXml(formatDims(design.internal))} · conceptual</text>
      <path d="${outlinePath(panels, flap, height, slot, slotDepth)}" fill="#F6F1E6" stroke="#142923" stroke-width="${num(stroke)}" stroke-linejoin="round"/>
      <polygon points="${num(glue)},${num(yBody)} 0,${num(yBody + inset)} 0,${num(yBody + height - inset)} ${num(glue)},${num(yBody + height)}" fill="#E9B969" fill-opacity="0.38"/>
      <path d="${scores}" fill="none" stroke="#146E54" stroke-width="${num(stroke * 0.7)}" stroke-dasharray="${num(font * 0.45)} ${num(font * 0.32)}"/>
      ${labels}
      <text x="${num(first.x + first.w / 2)}" y="${num(flap / 2)}" text-anchor="middle" font-size="${num(small)}" fill="#4A5C54">Flap ${escapeXml(formatMm(flap))}</text>
      <text x="${num(glueLabelX)}" y="${num(glueLabelY)}" text-anchor="middle" font-size="${num(small)}" fill="#6A5428" transform="rotate(-90 ${num(glueLabelX)} ${num(glueLabelY)})">Glue ${escapeXml(formatNumber(glue))}</text>
      ${hDim(idPrefix, 0, totalW, totalH + font * 1.7, formatMm(totalW), small)}
      ${vDim(idPrefix, -font * 2.1, 0, flap, formatMm(flap), small)}
      ${vDim(idPrefix, totalW + font * 2.2, 0, totalH, formatMm(totalH), small)}
      <line x1="0" y1="${num(legendY)}" x2="${num(font * 2)}" y2="${num(legendY)}" stroke="#142923" stroke-width="${num(stroke)}"/>
      <text x="${num(font * 2.3)}" y="${num(legendY + small * 0.35)}" font-size="${num(small)}" fill="#142923">Cut</text>
      <line x1="${num(font * 5)}" y1="${num(legendY)}" x2="${num(font * 7)}" y2="${num(legendY)}" stroke="#146E54" stroke-width="${num(stroke * 0.75)}" stroke-dasharray="${num(font * 0.4)} ${num(font * 0.28)}"/>
      <text x="${num(font * 7.3)}" y="${num(legendY + small * 0.35)}" font-size="${num(small)}" fill="#142923">Fold</text>
      <text x="${num(font * 11)}" y="${num(legendY + small * 0.35)}" font-size="${num(small)}" fill="#4A5C54">Slots are illustrative. Validate before production.</text>
    </g>
  `
  const padL = font * 5.2
  const padT = font * 4.4
  const padR = font * 5.4
  const padB = font * 5.2

  return {
    viewBox: `${num(-padL)} ${num(-padT)} ${num(totalW + padL + padR)} ${num(totalH + padT + padB)}`,
    label: `${design.productName} regular slotted carton dieline, conceptual`,
    inner,
  }
}
