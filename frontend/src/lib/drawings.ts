import { formatDims, formatMm } from './format.ts'
import { escapeXml, num, type VectorDrawing } from './svg.ts'
import type { PackagingDesign } from '../types/packaging.ts'

function rect(x: number, y: number, w: number, h: number, attrs: string) {
  return `<rect x="${num(x)}" y="${num(y)}" width="${num(Math.max(w, 0))}" height="${num(Math.max(h, 0))}" ${attrs}/>`
}

export function buildDimensions(design: PackagingDesign, idPrefix: string): VectorDrawing {
  const longest = Math.max(design.external.l, design.external.w, design.external.h, 1)
  const unit = 280 / longest
  const scale = (value: number) => value * unit
  const font = 15
  const small = 12.5
  const gap = 92
  const originX = 28
  const originY = 64
  const thickness = scale(design.thickness)
  const clearance = scale(design.clearance)

  const views = [
    {
      title: 'Front elevation',
      x: originX,
      y: originY,
      w: scale(design.external.l),
      h: scale(design.external.h),
      productW: scale(design.product.l),
      productH: scale(design.product.h),
      widthLabel: formatMm(design.external.l),
      heightLabel: formatMm(design.external.h),
    },
    {
      title: 'Side elevation',
      x: originX + scale(design.external.l) + gap,
      y: originY,
      w: scale(design.external.w),
      h: scale(design.external.h),
      productW: scale(design.product.w),
      productH: scale(design.product.h),
      widthLabel: formatMm(design.external.w),
      heightLabel: formatMm(design.external.h),
    },
    {
      title: 'Top view',
      x: originX,
      y: originY + scale(design.external.h) + gap,
      w: scale(design.external.l),
      h: scale(design.external.w),
      productW: scale(design.product.l),
      productH: scale(design.product.w),
      widthLabel: formatMm(design.external.l),
      heightLabel: formatMm(design.external.w),
    },
  ]

  const viewMarkup = views
    .map((view) => {
      const internalX = view.x + thickness
      const internalY = view.y + thickness
      const internalW = Math.max(view.w - thickness * 2, 0)
      const internalH = Math.max(view.h - thickness * 2, 0)
      const productX = view.x + thickness + clearance
      const productY = view.y + thickness + clearance
      const midX = view.x + view.w / 2
      const midY = view.y + view.h / 2
      const dimY = view.y + view.h + 28
      const dimX = view.x + view.w + 30
      return `
        <text x="${num(view.x)}" y="${num(view.y - 12)}" font-size="${font}" font-weight="600" fill="#142923">${escapeXml(view.title)}</text>
        ${rect(view.x, view.y, view.w, view.h, 'fill="#F6F1E6" stroke="#142923" stroke-width="1.8"')}
        ${rect(internalX, internalY, internalW, internalH, 'fill="none" stroke="#146E54" stroke-width="1.4" stroke-dasharray="5 3.5"')}
        ${rect(productX, productY, view.productW, view.productH, 'fill="#E9B969" fill-opacity="0.35" stroke="#8A6232" stroke-width="1.3" stroke-dasharray="2 2.5"')}
        <line x1="${num(view.x)}" y1="${num(view.y + view.h)}" x2="${num(view.x)}" y2="${num(dimY)}" stroke="#9AA79F" stroke-width="1"/>
        <line x1="${num(view.x + view.w)}" y1="${num(view.y + view.h)}" x2="${num(view.x + view.w)}" y2="${num(dimY)}" stroke="#9AA79F" stroke-width="1"/>
        <line x1="${num(view.x)}" y1="${num(dimY)}" x2="${num(view.x + view.w)}" y2="${num(dimY)}" stroke="#142923" stroke-width="1.3" marker-start="url(#${idPrefix}-start)" marker-end="url(#${idPrefix}-end)"/>
        <text x="${num(midX)}" y="${num(dimY - 6)}" text-anchor="middle" font-size="${small}" fill="#142923">${escapeXml(view.widthLabel)}</text>
        <line x1="${num(view.x + view.w)}" y1="${num(view.y)}" x2="${num(dimX)}" y2="${num(view.y)}" stroke="#9AA79F" stroke-width="1"/>
        <line x1="${num(view.x + view.w)}" y1="${num(view.y + view.h)}" x2="${num(dimX)}" y2="${num(view.y + view.h)}" stroke="#9AA79F" stroke-width="1"/>
        <line x1="${num(dimX)}" y1="${num(view.y)}" x2="${num(dimX)}" y2="${num(view.y + view.h)}" stroke="#142923" stroke-width="1.3" marker-start="url(#${idPrefix}-start)" marker-end="url(#${idPrefix}-end)"/>
        <text x="${num(dimX + 12)}" y="${num(midY)}" text-anchor="middle" font-size="${small}" fill="#142923" transform="rotate(-90 ${num(dimX + 12)} ${num(midY)})">${escapeXml(view.heightLabel)}</text>
      `
    })
    .join('')

  const top = views[2]
  const legendY = top.y + top.h + 62
  const width = views[1].x + views[1].w + 78
  const height = legendY + 28
  const inner = `
    <g font-family="Inter, ui-sans-serif, system-ui, sans-serif">
      <defs>
        <marker id="${idPrefix}-end" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0 0 L9 4.5 L0 9 Z" fill="#142923"/>
        </marker>
        <marker id="${idPrefix}-start" markerWidth="9" markerHeight="9" refX="1" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M9 0 L0 4.5 L9 9 Z" fill="#142923"/>
        </marker>
      </defs>
      <text x="${num(originX)}" y="22" font-size="18" font-weight="600" fill="#142923">${escapeXml(design.productName)}</text>
      <text x="${num(originX)}" y="42" font-size="12" fill="#4A5C54">Outer ${escapeXml(formatDims(design.external))} · nested product, internal opening, and board · conceptual</text>
      ${viewMarkup}
      ${rect(originX, legendY - 10, 14, 10, 'fill="#F6F1E6" stroke="#142923" stroke-width="1.2"')}
      <text x="${num(originX + 20)}" y="${num(legendY)}" font-size="12" fill="#142923">Outer board</text>
      <line x1="${num(originX + 108)}" y1="${num(legendY - 5)}" x2="${num(originX + 136)}" y2="${num(legendY - 5)}" stroke="#146E54" stroke-width="1.5" stroke-dasharray="5 3"/>
      <text x="${num(originX + 142)}" y="${num(legendY)}" font-size="12" fill="#142923">Internal</text>
      ${rect(originX + 210, legendY - 10, 14, 10, 'fill="#E9B969" fill-opacity="0.45" stroke="#8A6232" stroke-width="1.2"')}
      <text x="${num(originX + 230)}" y="${num(legendY)}" font-size="12" fill="#142923">Product</text>
    </g>
  `

  return {
    viewBox: `0 0 ${num(width)} ${num(height)}`,
    label: `${design.productName} dimensioned packaging views, conceptual`,
    inner,
  }
}
