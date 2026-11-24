# PackShift redesign backend

FastAPI service that redesigns a rectangular carton from the product and the current package. Recommended dimensions are calculated here. The request has no field for a new carton size.

The laptop check below is the evaluation example: a 325 × 225 × 20 mm product, 30 mm prototype clearance on every side, and a 500 × 400 × 150 mm internal carton become an internal size of **385 × 285 × 80 mm**.

## Run locally

Python 3.11 or newer is required. This workspace was verified with Python 3.14.2.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

- API: `http://127.0.0.1:8000`
- Interactive docs: `http://127.0.0.1:8000/docs`
- Health: `GET /health`

Development CORS allows `http://localhost:5173` and `http://127.0.0.1:5173`. Set `PACKSHIFT_CORS_ORIGINS` to a comma-separated list to add another local origin.

No database, account, or external AI service is used. Materials and clearances live in `data/materials.json` and `data/packaging_rules.json`.

## Tests

`pytest` — **28 passed** (23 November 2026). One Starlette deprecation warning says its TestClient would prefer the `httpx2` package. The suite still runs on `httpx` 0.28.1.

Covered cases: the laptop example and its 70.74% volume reduction, a changed product length, low and medium clearances, `flat_only` orientation, negative and zero dimensions, unsupported shapes, unknown materials, products that do not fit, external-to-internal conversion, geometry that matches the recommended carton, a missing board rate, a rate change that does not resize the carton, unique feasible recommendations, and identical output for identical inputs.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service status |
| `GET` | `/api/materials` | Boards, cushioning, and configurations |
| `POST` | `/api/redesign` | Validate, size, cost, and rank |
| `POST` | `/api/optimise` | Compare FEFCO 0201 candidates with the current pack |

Dimensions are millimetres. Weight is kilograms. Money is INR, rounded half-up to the paisa on the unit total.

### Successful request

```json
{
  "product": {
    "name": "14-inch Laptop",
    "category": "electronics",
    "dimensions_mm": { "length": 325, "width": 225, "height": 20 },
    "weight_kg": 1.5,
    "fragility": "high",
    "orientation_constraint": "flat_only",
    "quantity_per_package": 1
  },
  "current_packaging": {
    "dimensions_mm": { "length": 500, "width": 400, "height": 150 },
    "dimension_type": "internal",
    "material_id": "corrugated_standard",
    "cushioning_material_id": "foam_insert",
    "cost_per_unit_inr": 120
  },
  "monthly_quantity": 500,
  "preferences": { "box_style": "fefco_0201", "dimension_increment_mm": 5 }
}
```

`product.shape` defaults to `rectangular`. Any other shape is rejected. Extra fields, including a proposed carton size, are rejected.

Verified response for that request:

- Current internal volume: 30 L
- Recommended internal size: 385 × 285 × 80 mm, volume 8.778 L
- Volume reduction: 70.74%
- Reference board: standard corrugated, 4 mm, external 393 × 293 × 88 mm
- Blank: 1375 × 365 mm, 0.501875 m², about 276.03 g of board
- Illustrative unit cost: ₹52.14, which is ₹67.86 below the entered ₹120
- Three recommendations: minimum board (`corrugated_standard`, ₹52.14), lowest illustrative cost (`corrugated_recycled`, ₹49.12), and an insert alternative (`corrugated_foam`, ₹74.14)
- Geometry: 13 panels, 12 fold lines, a 51-point cut outline, and 7 dimension annotations

The current blank for the 500 × 400 × 150 mm carton is about 1.00925 m². Board-area reduction is about 50.27%, which is not the same number as the 70.74% volume reduction.

### Validation failure

`POST /api/redesign` with a negative length returns HTTP 422:

```json
{
  "status": "error",
  "errors": [
    {
      "field": "product.dimensions_mm.length",
      "message": "Input should be greater than 0"
    }
  ]
}
```

A product that cannot fit the current package in a permitted orientation also returns 422, with a message that quotes both sizes in millimetres. A valid product that no catalogue configuration can carry returns HTTP 200 with `"status": "no_feasible_configuration"` and a reason for each rejected configuration.

## What drives the drawings

Use one recommendation's `geometry` object, or the top-level `geometry`, which is the minimum-board recommendation.

- 3D model: `geometry.three_js.internal_dimensions_mm` and `external_dimensions_mm`, in millimetres. Do not scale one view from volume and another from the blank.
- 2D dieline: `geometry.cut_lines[0].points_mm` is the cut outline. `fold_lines` are crease segments. `panels` are nominal rectangles. `dimension_annotations` are the labels. `bounding_rectangle_mm` is the unfolded blank.
- Coordinates are millimetres. The origin is the top-left of the blank, X runs along the blank length, and Y increases downward so the same numbers can go into an SVG `viewBox`.
- Costs and the monthly comparison come from `recommendations[].cost`. Read `cost.status` before displaying a saving. `unavailable` means a rate was missing and no cost was invented.

## Calculation pipeline

1. Validate types, units, catalogue ids, limits, and whether the product fits inside the current internal carton in a permitted orientation.
2. If the current carton was supplied as external, convert it with internal = external − 2 × thickness on each axis. Thickness comes from `board_thickness_mm` or, if that is omitted, from the catalogue entry for `material_id`.
3. Choose clearance from `packaging_rules.json` for the fragility level. A material configuration may override the three clearances.
4. Keep the declared length, width, and height when that pose is allowed. `flat_only` and `upright_only` keep the declared height axis vertical. Other poses are reported and are not selected just to shrink the volume.
5. Internal size = product + clearance on both ends of each axis, then rounded **up** to `dimension_increment_mm`.
6. Build one FEFCO 0201-style blank from those internal dimensions and the selected board thickness.
7. Price the rectangular blank from the catalogue rate, insert cost, and conversion cost. Compare it with the entered current unit cost when that cost was sent.
8. Rank up to three distinct feasible configurations: lowest board area, lowest complete illustrative cost, and a different insert configuration.

## Formulas

Clearance for this prototype catalogue:

- Low fragility: 5 mm per side
- Medium fragility: 15 mm per side
- High fragility: 30 mm per side

```text
minimum length = product length + 2 × length clearance
internal length = round up to the manufacturing increment
volume (L) = length × width × height / 1,000,000
blank length (mm) = 2 × (L + W) + joint
blank width (mm) = H + W
flap depth = W / 2
blank area (m²) = blank length × blank width / 1,000,000
external = internal + 2 × board thickness on each axis
board cost = billed area × rate per m²
unit cost = board cost + insert cost + conversion cost + other configured costs
```

The joint allowance is 35 mm. The manufacturing waste factor is 0, so the billed area is the rectangular blank. Slot notches are cut from inside that rectangle and do not make it larger. Slot width follows the same planning rule as the studio: at least 8 mm, at most one third of the smaller panel, and normally twice the board thickness. Slot depth is at most 12 mm or one fifth of the height.

External caliper is not added a second time inside the blank. The blank is sized from the internal panels.

## Assumptions and limitations

- Clearances are prototype planning values dated 2026-11-22. They are not a certified cushion specification, and nothing here claims a drop test has been passed.
- Prices, grammage, and insert masses are illustrative catalogue assumptions, not supplier quotes. Every priced result is labelled as an illustrative estimate.
- No CO₂, recyclability, biodegradability, or other environmental score is calculated. Recycled board and paper inserts are not treated as automatically preferable to other materials.
- Only one rectangular item and a conceptual FEFCO 0201 carton are supported.
- The declared orientation is kept. A laptop marked `flat_only` is not turned onto its side.
- Inserts are assumed to occupy the clearance rather than add another gap, unless that configuration sets `clearance_override_mm`.
- Volume, board area, mass, and cost are separate results.
- The geometry is for preview. It is not a manufacturing-certified CAD file.
- Configurations above their catalogue weight limit are rejected instead of being forced into a recommendation. The default limit is 30 kg.

## Frontend integration

The studio still sizes the selected carton in the browser through `frontend/src/lib/calculations.ts`. The Optimisation page also `POST`s the committed redesign to `/api/optimise` through the Vite proxy at `http://127.0.0.1:8000`. If that service is down, the page keeps the local comparison and shows the API error.

`POST /api/redesign` is unchanged. It selects clearance from fragility and `packaging_rules.json`. Do not send the studio's typed clearance to that endpoint. `POST /api/optimise` uses the clearance the user entered and does not replace it with the fragility policy.

`POST /api/redesign` still expects product weight in kilograms and a catalogue `material_id`. `POST /api/optimise` expects product weight in grams, the typed clearance, and the current material as a name.

## Optimisation endpoint

`POST /api/optimise` builds FEFCO 0201 candidates from the product, the entered clearance, and the current pack. It does not change the product dimensions and it does not recalculate the current pack's cost.

### Cookie container

Input: Cookie Container, Food, 200 × 150 × 70 mm, 500 g, medium fragility, 5 mm clearance on each face, quantity 10,000. Current pack: PET plastic container, stated outer size 200 × 150 × 70 mm, ₹12 per unit.

Studio simplified C-flute result, using the same formula as the browser calculator:

| Result | Value |
| --- | --- |
| Internal size | 210 × 160 × 80 mm |
| Outer estimate | 218 × 168 × 88 mm, 4 mm board, tolerance not included |
| Internal volume | 2.688 L |
| Outer volume | 3.222912 L, displayed as 3.223 L |
| Unused internal volume | 21.875%, displayed as 21.9% |
| Blank | 775 × 240 mm, 0.1860 m² |
| Unit cost | ₹29.39, demonstration rate ₹72/m² plus ₹16 conversion |
| Current order | ₹120,000 |
| Proposed order | ₹293,900 |
| Difference | ₹173,900 increase |

The converter-adjusted blank uses a separate documented profile: 35 mm joint, 1.5 mm score allowance at each of four wall boundaries (6 mm), and 3 mm flap relief. For this product that blank is 781 × 237 mm. It is one converter's planning allowance, not a universal die.

### Formulas used by this endpoint

```text
internal = product + 2 × entered clearance on that axis
outer = internal + 2 × board thickness
simplified blank length = 35 + 2 × (L + W)
simplified blank width = H + W
converter blank length = joint + 2 × (L + W) + score allowance × score count
converter flap = W / 2 − flap relief / 2
converter blank width = H + 2 × flap
area (m²) = blank length × blank width / 1,000,000
unused % = (1 − product volume / internal volume) × 100
unit cost = billed area × rate + conversion + cutting + printing + joining + cushioning
order cost = rounded unit cost × quantity
```

Missing board rate or conversion cost returns `Cost unavailable — pricing data required` and a null unit cost. Printing is omitted while its rate is null. Waste, cutting, joining, and cushioning are 0 in the demonstration catalogue so the simplified C-flute quote matches the studio.

### Catalogue and decisions

`data/board_profiles.json` holds demonstration E-flute (1.5 mm), B-flute (3 mm), and C-flute (4 mm) profiles. Grammage, ECT, compression, recycled content, food-contact documentation, and environmental factors are null. The shared ₹72/m² and ₹16 conversion figures are labelled demonstration assumptions, dated 2026-11-22, and are not supplier quotes.

Each candidate is Eligible only when the product fits, the pose is the declared one, strength evidence exists, and food-contact documentation exists for a food product. The demonstration catalogue therefore returns Needs validation. A carton that cannot hold the product at the entered clearance is Rejected. `safe_to_ship` is always false.

Pareto comparison minimises unit cost, sheet area, and outer volume, and only among candidates that have every one of those values. Mass is left out while grammage is missing. A preference chooses the study focus on that nondominated set. It does not override a Keep existing packaging decision.

The cookie case returns Keep existing packaging: every priced candidate costs more than ₹12, none is Eligible, and PET is not treated as equivalent to corrugated board. A cheaper candidate that still lacks strength or functional evidence returns Prototype testing. A missing current cost or an unpriced set returns Insufficient data.

### Files added for this engine

- `data/board_profiles.json`, `data/geometry_profiles.json` — demonstration boards and the two blank profiles
- `services/blank_geometry.py` — internal, outer, blank, and unused-volume math
- `services/optimise_cost.py` — itemised cost and the current-pack comparison
- `services/pareto.py` — objective filtering and nondominated ids
- `services/optimise_engine.py` — validation, candidates, feasibility, decision
- `routes/optimise.py` — `POST /api/optimise`
- `tests/test_optimise.py` — cookie numbers, separate converter blank, missing price, validation, and Pareto

### Remaining work

Supplier ECT or BCT, a validated compression model, grammage, a real converting quote, printing, and a documented food-contact specification are still absent. Until those exist, the engine can compare geometry and the loaded demonstration cost, and it cannot call a carton safe, certified, or lower impact.
