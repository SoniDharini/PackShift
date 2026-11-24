export const SCENE_MM = 100

export interface AxisMm {
  l: number
  w: number
  h: number
}

export interface BoxUnits {
  x: number
  y: number
  z: number
}

export interface CentredPlacement {
  fits: boolean
  centered: true
  assumption: string
  clearanceMm: AxisMm
  product: BoxUnits
  internal: BoxUnits
  external: BoxUnits
  productCenterY: number
  internalCenterY: number
  externalCenterY: number
}

const unit = (mm: number) => mm / SCENE_MM

export function centredPlacement(product: AxisMm, internal: AxisMm, external: AxisMm): CentredPlacement {
  const fits = product.l <= internal.l + 0.05 && product.w <= internal.w + 0.05 && product.h <= internal.h + 0.05
  const floor = (external.h - internal.h) / 2
  const cavityCenter = floor + internal.h / 2
  return {
    fits,
    centered: true,
    assumption:
      'The product is centered in the internal cavity. Opposite faces have equal clearance when the internal size is the product size plus twice the clearance.',
    clearanceMm: {
      l: (internal.l - product.l) / 2,
      w: (internal.w - product.w) / 2,
      h: (internal.h - product.h) / 2,
    },
    product: { x: unit(product.l), y: unit(product.h), z: unit(product.w) },
    internal: { x: unit(internal.l), y: unit(internal.h), z: unit(internal.w) },
    external: { x: unit(external.l), y: unit(external.h), z: unit(external.w) },
    productCenterY: unit(cavityCenter),
    internalCenterY: unit(cavityCenter),
    externalCenterY: unit(external.h / 2),
  }
}

export function statedPackTooSmall(product: AxisMm, stated: AxisMm) {
  return product.l > stated.l + 0.05 || product.w > stated.w + 0.05 || product.h > stated.h + 0.05
}
