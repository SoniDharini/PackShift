import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateDesign } from '../src/lib/calculations.ts'
import { evaluatePackaging, HEADINGS } from '../src/lib/evaluatePackaging.ts'
import { describeEvaluation } from '../src/lib/evaluationCopy.ts'
import { EXAMPLE_FORM } from '../src/lib/example.ts'
import { cloneMaterials } from '../src/lib/materials.ts'
import { parseForm } from '../src/lib/validation.ts'
import type { MaterialOption, ParsedProject, ProductForm } from '../src/types/packaging.ts'

type Existing = NonNullable<ParsedProject['existing']>

function project(product: [number, number, number], existing: Partial<Existing> = {}, quantity = 10000): ParsedProject {
  return {
    mode: 'redesign',
    name: 'Cookie Container',
    category: 'Food',
    length: product[0],
    width: product[1],
    height: product[2],
    weight: 500,
    fragility: 'medium',
    clearance: 5,
    quantity,
    existing: {
      length: 218,
      width: 168,
      height: 88,
      material: 'Standard corrugated board',
      unitCost: 12,
      basis: 'external',
      thicknessMm: 4,
      ...existing,
    },
  }
}

function designs(input: ParsedProject, materials: MaterialOption[] = cloneMaterials()) {
  const all = materials.map((material) => calculateDesign(input, material))
  return { selected: all[0], all }
}

test('A: 200 mm product in a 218 mm outer box with 4 mm walls is suitable', () => {
  const { selected, all } = designs(project([200, 150, 70]))
  const advice = evaluatePackaging(selected, all)
  assert.deepEqual(selected.internal, { l: 210, w: 160, h: 80 })
  assert.deepEqual(advice.existingInner, { l: 210, w: 160, h: 80 })
  assert.deepEqual(selected.external, { l: 218, w: 168, h: 88 })
  assert.equal(advice.dimensionStatus, 'SUITABLE')
  assert.equal(advice.headline, 'Your Current Box Size Is Suitable')
  assert.equal(advice.volumeValue, '0%')
  assert.equal(advice.sizeLine, 'Current outer size 218 × 168 × 88 mm. Recommended outer size 218 × 168 × 88 mm. Size change: 0%.')
  assert.match(advice.needsChange, /No dimensional redesign is necessary/)
})

test('B: ₹29.39 against ₹12 is ₹17.39 per unit and ₹1,73,900 for 10,000, with the cost reason', () => {
  const { selected, all } = designs(project([200, 150, 70]))
  const advice = evaluatePackaging(selected, all)
  assert.equal(selected.unitCost, 29.39)
  assert.equal(advice.cost.perUnitDifference, 17.39)
  assert.equal(advice.cost.orderDifference, 173900)
  assert.equal(Math.round((advice.cost.changePercent ?? 0) * 10) / 10, 144.9)
  assert.equal(advice.cost.reason, 'Your proposed packaging costs more because of board material and manufacturing charges.')
  assert.match(advice.cost.manufacturing, /reducing manufacturing cost alone cannot reach the target/)
  assert.equal(advice.cost.cheapest, null)
  assert.equal(advice.recommendationTitle, HEADINGS.KEEP)
  assert.equal(
    advice.recommendation,
    'Keep your existing carton dimensions. The proposed replacement costs more, so explore cheaper suitable materials or manufacturing methods. The current carton already meets the geometric requirements, and no lower-cost suitable replacement has been established.',
  )
})

test('C: a hypothetical ₹45/m² board with ₹3.50 conversion reaches ₹11.87 and saves ₹1,300', () => {
  const materials = cloneMaterials()
  materials[0] = { ...materials[0], pricePerM2: 45, conversion: 3.5 }
  const { selected, all } = designs(project([200, 150, 70]), materials)
  const advice = evaluatePackaging(selected, all)
  assert.equal(advice.cost.options[0].boardCost, 8.37)
  assert.equal(selected.unitCost, 11.87)
  assert.equal(advice.cost.perUnitDifference, -0.13)
  assert.equal(advice.cost.orderDifference, -1300)
  assert.equal(advice.cost.cheapest?.id, 'standard')
  assert.equal(advice.cost.cheapest?.protectionTested, false)
  assert.equal(advice.recommendationTitle, 'Explore Cheaper Material')
  assert.equal(advice.recommendation, 'A lower-cost material option is available. Review its estimated savings and protection requirements before switching.')
})

test('D: a 280 × 220 × 120 mm outer box is larger than required with a real outer-volume reduction', () => {
  const { selected, all } = designs(project([200, 150, 70], { length: 280, width: 220, height: 120 }))
  const advice = evaluatePackaging(selected, all)
  assert.equal(advice.headline, 'Your Current Box Is Larger Than Required')
  assert.equal(advice.sizeLine, 'Current outer size 280 × 220 × 120 mm. Recommended outer size 218 × 168 × 88 mm. 56.4% less packaging volume.')
  assert.match(advice.why, /The inside is 62 mm longer, 52 mm wider and 32 mm taller than the 210 × 160 × 80 mm required\./)
  assert.match(advice.recommendation, /compare costs before recommending a change/)
})

test('E: a 205 × 155 × 75 mm box is too small, and the copy says why', () => {
  const outer = designs(project([200, 150, 70], { length: 205, width: 155, height: 75 }))
  const outside = evaluatePackaging(outer.selected, outer.all)
  assert.equal(outside.headline, 'Your Current Box Is Too Small')
  assert.match(outside.why, /The product cannot physically fit: the inside length is 197 mm and the product is 200 mm/)
  assert.match(outside.recommendation, /Correct the dimensions before evaluating cost savings/)

  const inner = designs(project([200, 150, 70], { length: 205, width: 155, height: 75, basis: 'internal', thicknessMm: null }))
  const inside = evaluatePackaging(inner.selected, inner.all)
  assert.equal(inside.headline, 'Your Current Box Is Too Small')
  assert.match(inside.why, /The product fits, but without the clearance you specified\. The box needs 5 mm more internal length/)
})

test('Unknown wall thickness says the box size cannot be verified and still compares cost', () => {
  const { selected, all } = designs(project([200, 150, 70], { thicknessMm: null }))
  const advice = evaluatePackaging(selected, all)
  assert.equal(advice.headline, 'Current Box Size Cannot Be Verified')
  assert.equal(advice.existingInner, null)
  assert.equal(advice.cost.perUnitDifference, 17.39)
  for (const heading of Object.values(HEADINGS)) assert.doesNotMatch(heading, /One More|Further Information|Not Calculated|Conceptual/i)
})

test('F: Design Studio and Optimisation read the same result for the same snapshot', () => {
  const { selected, all } = designs(project([200, 150, 70]))
  const studio = describeEvaluation(selected, null, false, all)
  const apiResult = { sustainability: { current_mass_g: null, proposed_mass_g: null } } as never
  const optimisation = describeEvaluation(selected, apiResult, false, all)
  for (const key of ['headline', 'answerChange', 'answerWhy', 'sizeLine', 'dimensionalValue', 'costHeadline', 'costExplanation', 'recommendationTitle', 'recommendation'] as const) {
    assert.equal(optimisation[key], studio[key], key)
  }
})

function cookieForm(patch: Partial<ProductForm> = {}): ProductForm {
  return {
    name: 'Cookie Container',
    category: 'Food',
    length: '200',
    width: '150',
    height: '70',
    weight: '500',
    fragility: 'medium',
    clearance: '5',
    quantity: '10000',
    existingLength: '218',
    existingWidth: '168',
    existingHeight: '88',
    existingBasis: 'external',
    existingThickness: '4',
    existingMaterial: 'Standard corrugated board',
    existingUnitCost: '12',
    ...patch,
  }
}

test('Form: the cookie inputs parse with the existing 4 mm wall, not the proposed board thickness', () => {
  const parsed = parseForm(cookieForm(), 'redesign')
  assert.ok(parsed.ok)
  assert.equal(parsed.value.existing?.basis, 'external')
  assert.equal(parsed.value.existing?.thicknessMm, 4)
  const recycled = cloneMaterials()[1]
  const advice = evaluatePackaging(calculateDesign(parsed.value, recycled))
  assert.deepEqual(advice.existingInner, { l: 210, w: 160, h: 80 })
  assert.equal(advice.headline, 'Your Current Box Size Is Suitable')
})

test('Test 4: outside size without a wall thickness is stopped at the thickness field', () => {
  const parsed = parseForm(cookieForm({ existingThickness: '' }), 'redesign')
  assert.equal(parsed.ok, false)
  if (!parsed.ok) assert.match(parsed.errors.existingThickness ?? '', /Enter the wall thickness of your current box/)
})

test('Form: no measurement type, or outside size for PET, is asked about at the selector', () => {
  const unspecified = parseForm(cookieForm({ existingBasis: 'unspecified' }), 'redesign')
  assert.equal(unspecified.ok, false)
  if (!unspecified.ok) assert.match(unspecified.errors.existingBasis ?? '', /Choose Outside dimensions or Inside dimensions/)

  const pet = parseForm(cookieForm({ existingMaterial: 'PET clamshell', existingThickness: '' }), 'redesign')
  assert.equal(pet.ok, false)
  if (!pet.ok) assert.match(pet.errors.existingBasis ?? '', /choose Inside dimensions/)

  const petInside = parseForm(cookieForm({ existingMaterial: 'PET clamshell', existingBasis: 'internal', existingThickness: '' }), 'redesign')
  assert.ok(petInside.ok)
})

test('Form: inside dimensions with a wall thickness give an outer-volume comparison', () => {
  const parsed = parseForm(cookieForm({ existingBasis: 'internal', existingLength: '210', existingWidth: '160', existingHeight: '80' }), 'redesign')
  assert.ok(parsed.ok)
  const advice = evaluatePackaging(calculateDesign(parsed.value, cloneMaterials()[0]))
  assert.equal(advice.headline, 'Your Current Box Size Is Suitable')
  assert.deepEqual(advice.existingOuter, { l: 218, w: 168, h: 88 })
  assert.equal(advice.volumeValue, '0%')
})

test('Form: a wall too thick for the box is rejected', () => {
  const parsed = parseForm(cookieForm({ existingThickness: '10', existingHeight: '18' }), 'redesign')
  assert.equal(parsed.ok, false)
  if (!parsed.ok) assert.match(parsed.errors.existingThickness ?? '', /no space inside/)
})

test('The mug example starts with a complete measurement type', () => {
  const parsed = parseForm(EXAMPLE_FORM, 'redesign')
  assert.ok(parsed.ok)
  assert.notEqual(evaluatePackaging(calculateDesign(parsed.value, cloneMaterials()[0])).headline, 'Current Box Size Cannot Be Verified')
})

test('Regenerating at 210 mm replaces the 200 mm result', () => {
  const first = designs(project([200, 150, 70]))
  const second = designs(project([210, 150, 70]))
  const before = evaluatePackaging(first.selected, first.all)
  const after = evaluatePackaging(second.selected, second.all)
  assert.equal(before.requiredInner.l, 210)
  assert.equal(after.requiredInner.l, 220)
  assert.equal(before.proposedOuter.l, 218)
  assert.equal(after.proposedOuter.l, 228)
  assert.equal(before.headline, 'Your Current Box Size Is Suitable')
  assert.equal(after.headline, 'Your Current Box Is Too Small')
  assert.match(after.why, /The box needs 10 mm more internal length to meet your required clearance/)
})
