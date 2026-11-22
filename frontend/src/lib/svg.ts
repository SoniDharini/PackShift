export type VectorDrawing = {
  viewBox: string
  label: string
  inner: string
}

export function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function num(value: number) {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

export function svgDocument(drawing: VectorDrawing) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${drawing.viewBox}">
  <title>${escapeXml(drawing.label)}</title>
  <rect x="-20000" y="-20000" width="40000" height="40000" fill="#ffffff"/>
  ${drawing.inner}
</svg>
`
}

export function downloadSvg(filename: string, drawing: VectorDrawing) {
  const blob = new Blob([svgDocument(drawing)], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
