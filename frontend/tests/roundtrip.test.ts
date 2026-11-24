import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateDesign, internalFromOuter, outerFromInternal, requiredInternal } from '../src/lib/calculations.ts'
import { evaluatePackaging, evaluatePackagingDimensions, FIT_TOLERANCE_MM, HEADINGS } from '../src/lib/evaluatePackaging.ts'
import { describeEvaluation } from '../src/lib/evaluationCopy.ts'
import { cloneMaterials } from '../src/lib/materials.ts'
import { generatedCartonForm, parseForm } from '../src/lib/validation.ts'
import type { MaterialOption, PackagingDesign, ProductForm } from '../src/types/packaging.ts'

function createForm(product: [number, number, number], clearance: number, quantity = 10000): ProductForm {
  return {
    name: 'Round trip product',
    category: 'General',
    length: String(product[0]),
    width: String(product[1]),
    height: String(product[2]),
    weight: '500',
    fragility: 'medium',
    clearance: String(clearance),
    quantity: String(quantity),
    existingLength: '',
    existingWidth: '',
    existingHeight: '',
    existingBasis: 'unspecified',
    existingThickness: '',
    existingMaterial: '',
    existingUnitCost: '',
  }
}

function generate(form: ProductForm, mode: 'create' | 'redesign', material: MaterialOption): PackagingDesign {
  const parsed = parseForm(form, mode)
  if (!parsed.ok) throw new Error(`Form rejected: ${JSON.stringify(parsed.errors)}`)
  return calculateDesign(parsed.value, material)
}

/** Create a carton, then enter it in Redesign exactly as the transfer action does. */
function roundTrip(product: [number, number, number], clearance: number, material: MaterialOption, existingCost = '12') {
  const form = createForm(product, clearance)
  const created = generate(form, 'create', material)
  const redesignForm = generatedCartonForm(form, created, existingCost)
  const redesign = generate(redesignForm, 'redesign', material)
  return { created, redesignForm, redesign }
}

test('Test 1: the 200 × 150 × 70 mm carton from Create is suitable in Redesign', () => {
  const standard = cloneMaterials()[0]
  const { created, redesignForm, redesign } = roundTrip([200, 150, 70], 5, standard)
  assert.deepEqual(created.internal, { l: 210, w: 160, h: 80 })
  assert.deepEqual(created.external, { l: 218, w: 168, h: 88 })
  assert.equal(evaluatePackagingDimensions(created).headline, HEADINGS.NEW_DESIGN)

  assert.equal(redesignForm.existingLength, '218')
  assert.equal(redesignForm.existingThickness, '4')
  assert.equal(redesignForm.existingBasis, 'external')
  assert.equal(redesignForm.length, '200')

  const advice = evaluatePackaging(redesign, [redesign])
  assert.equal(advice.dimensionStatus, 'SUITABLE')
  assert.equal(advice.headline, 'Your Current Box Size Is Suitable')
  assert.deepEqual(advice.existingInner, { l: 210, w: 160, h: 80 })
  assert.deepEqual(advice.requiredInner, { l: 210, w: 160, h: 80 })
  assert.equal(advice.volumeValue, '0%')
  assert.equal(
    advice.why,
    'Your existing packaging already provides the required space for the product and the specified clearance. No dimensional redesign is necessary.',
  )
  assert.equal(advice.recommendationTitle, 'Keep Existing Packaging')
})

test('Test 1: with no current price to compare, the suitable box keeps its dimensions', () => {
  const standard = { ...cloneMaterials()[0], pricePerM2: 0, conversion: 0 }
  const { redesign } = roundTrip([200, 150, 70], 5, standard, '0')
  const advice = evaluatePackaging(redesign, [redesign])
  assert.equal(advice.headline, HEADINGS.SUITABLE)
  assert.equal(advice.recommendation, 'Keep your current box dimensions. You can still explore cost, material and manufacturing improvements.')
})

test('Test 4: a 100 × 80 × 40 mm product round-trips to a suitable 118 × 98 × 58 mm carton', () => {
  const { created, redesign } = roundTrip([100, 80, 40], 5, cloneMaterials()[0])
  assert.deepEqual(created.internal, { l: 110, w: 90, h: 50 })
  assert.deepEqual(created.external, { l: 118, w: 98, h: 58 })
  const advice = evaluatePackagingDimensions(redesign)
  assert.equal(advice.dimensionStatus, 'SUITABLE')
  assert.equal(advice.volumeValue, '0%')
})

test('Test 1 with the 5 mm recycled board: the existing wall is the generated wall, not a leftover 4 mm', () => {
  const recycled = cloneMaterials()[1]
  const { created, redesignForm, redesign } = roundTrip([200, 150, 70], 5, recycled)
  assert.deepEqual(created.external, { l: 220, w: 170, h: 90 })
  assert.equal(redesignForm.existingThickness, '5')
  assert.equal(evaluatePackagingDimensions(redesign).dimensionStatus, 'SUITABLE')
})

test('Test 5: changing the product length to 210 mm makes the same 218 mm box 10 mm too short inside', () => {
  const standard = cloneMaterials()[0]
  const { redesignForm } = roundTrip([200, 150, 70], 5, standard)
  const longer = generate({ ...redesignForm, length: '210' }, 'redesign', standard)
  const advice = evaluatePackagingDimensions(longer)
  assert.equal(longer.internal.l, 220)
  assert.equal(advice.existingInner?.l, 210)
  assert.equal(advice.dimensionStatus, 'UNDERSIZED')
  assert.match(advice.why, /The box needs 10 mm more internal length to meet your required clearance\./)
})

test('Test 6: identical outer sizes give a 0% volume change, measured outer against outer', () => {
  const { redesign } = roundTrip([200, 150, 70], 5, cloneMaterials()[0])
  const advice = evaluatePackagingDimensions(redesign)
  assert.equal(advice.volumeChangePercent, 0)
  assert.deepEqual(advice.existingOuter, redesign.external)
  assert.doesNotMatch(advice.sizeLine, /less packaging volume|larger/)
})

test('Tolerance: 0.3 mm extra inside is still suitable; 1 mm extra is larger than required', () => {
  const standard = cloneMaterials()[0]
  const { redesignForm } = roundTrip([200, 150, 70], 5, standard)
  const near = evaluatePackagingDimensions(generate({ ...redesignForm, existingLength: '218.3' }, 'redesign', standard))
  assert.equal(near.dimensionStatus, 'SUITABLE')
  const over = evaluatePackagingDimensions(generate({ ...redesignForm, existingLength: '219' }, 'redesign', standard))
  assert.equal(over.dimensionStatus, 'OVERSIZED')
  assert.match(over.why, /The inside is 1 mm longer than the 210 × 160 × 80 mm required\./)
  const short = evaluatePackagingDimensions(generate({ ...redesignForm, existingHeight: '87' }, 'redesign', standard))
  assert.equal(short.dimensionStatus, 'UNDERSIZED')
  assert.ok(FIT_TOLERANCE_MM < 1)
})

test('Test 8: Design Studio, Redesign and Optimisation read the same result for the round-trip carton', () => {
  const materials = cloneMaterials()
  const form = createForm([200, 150, 70], 5)
  const created = generate(form, 'create', materials[0])
  const redesignForm = generatedCartonForm(form, created, '12')
  const peers = materials.map((material) => generate(redesignForm, 'redesign', material))
  const studio = describeEvaluation(peers[0], null, false, peers)
  const optimisation = describeEvaluation(peers[0], { sustainability: { current_mass_g: null, proposed_mass_g: null } } as never, false, peers)
  assert.equal(studio.headline, HEADINGS.SUITABLE)
  for (const key of ['headline', 'answerChange', 'answerWhy', 'sizeLine', 'dimensionalValue', 'costHeadline', 'costExplanation', 'recommendationTitle', 'recommendation'] as const) {
    assert.equal(optimisation[key], studio[key], key)
  }
  assert.equal(peers[0].unitCostDelta, 17.39)
  assert.equal(peers[0].orderCostDelta, 173900)
})

function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

test('Test 9: 600 generated products, clearances and board thicknesses all round-trip as suitable', () => {
  const random = seeded(20261125)
  const pick = (min: number, max: number, decimals: number) => Number((min + random() * (max - min)).toFixed(decimals))
  const base = cloneMaterials()
  for (let index = 0; index < 600; index += 1) {
    const product: [number, number, number] = [pick(5, 600, 1), pick(5, 600, 1), pick(5, 600, 1)]
    const clearance = pick(0, 40, 1)
    const material = { ...base[index % base.length], thickness: pick(1, 15, 2) }
    const { created, redesign } = roundTrip(product, clearance, material)
    const advice = evaluatePackagingDimensions(redesign)
    const label = `${product.join('×')} c${clearance} t${material.thickness}`
    assert.equal(advice.dimensionStatus, 'SUITABLE', label)
    assert.equal(advice.volumeValue, '0%', label)
    for (const key of ['l', 'w', 'h'] as const) {
      assert.ok(Math.abs((advice.existingInner?.[key] ?? Number.NaN) - created.internal[key]) < 1e-6, label)
    }
  }
})

test('Shared geometry helpers are exact inverses', () => {
  const random = seeded(7)
  for (let index = 0; index < 200; index += 1) {
    const inner = requiredInternal({ l: random() * 500, w: random() * 500, h: random() * 500 }, random() * 30)
    const thickness = 1 + random() * 14
    const back = internalFromOuter(outerFromInternal(inner, thickness), thickness)
    for (const key of ['l', 'w', 'h'] as const) assert.ok(Math.abs(back[key] - inner[key]) < 1e-9)
  }
})
