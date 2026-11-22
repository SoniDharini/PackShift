import type { Size3 } from '../types/packaging.ts'

const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })
const litreFormat = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cmFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const moneyFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const percentFormat = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const areaFormat = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 4, maximumFractionDigits: 4 })

export function formatNumber(value: number) {
  return numberFormat.format(value)
}

export function formatMm(value: number) {
  return `${formatNumber(value)} mm`
}

export function formatDims(size: Size3) {
  return `${formatNumber(size.l)} × ${formatNumber(size.w)} × ${formatNumber(size.h)} mm`
}

export function formatLitres(mm3: number) {
  return `${litreFormat.format(mm3 / 1_000_000)} L`
}

export function formatCm3(mm3: number) {
  return `${cmFormat.format(mm3 / 1000)} cm³`
}

export function formatMoney(value: number) {
  return moneyFormat.format(value)
}

export function formatPct(value: number) {
  return `${percentFormat.format(value)}%`
}

export function formatArea(m2: number) {
  return `${areaFormat.format(m2)} m²`
}

export function formatBlank(length: number, width: number) {
  return `${formatNumber(length)} × ${formatNumber(width)} mm`
}

export function formatReduction(value: number | null) {
  if (value === null) return 'No existing pack'
  if (value >= 0) return `${formatPct(value)} smaller`
  return `${formatPct(Math.abs(value))} larger`
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'packaging'
}

export function cents(value: number) {
  return Math.round(value * 100) / 100
}
