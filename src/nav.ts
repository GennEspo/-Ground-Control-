// Geometria del terminal e motore di navigazione.
// Logica pura, separata dal rendering per poter essere verificata in isolamento.

export type Node = { x: number; y: number }
export type Zone = { id: string; x: number; y: number; w: number; h: number }
export type Rect = { x: number; y: number; w: number; h: number; r: number }

// ────────────────────────────────────────────────────────────
// SCALA · 1 unità = 1 METRO. Le coordinate del codice sono le quote reali.
// Origine al centro del CENTRAL HUB, y negativo verso nord.
// Terminale medio: ~700 × 610 m d'ingombro — moli di transito da 260 m.
// ────────────────────────────────────────────────────────────

export const ZONES: Zone[] = [
  // ── Landside (sud) ──
  { id: 'MAIN HALL (CHECK-IN)', x: -80, y: 200, w: 160, h: 60 },
  { id: 'BAGGAGE CLAIM (ARRIVI)', x: -180, y: 200, w: 100, h: 60 },
  { id: 'HANGAR AMR (BASE)', x: 80, y: 200, w: 90, h: 60 },
  // ── Filtro ──
  { id: 'FILTRI SICUREZZA', x: -40, y: 140, w: 80, h: 60 },
  { id: 'SERVIZI IGIENICI', x: -100, y: 140, w: 60, h: 60 },
  // ── Airside (centro) ──
  { id: 'DUTY FREE PLAZA', x: -60, y: 60, w: 120, h: 80 },
  { id: 'FOOD COURT', x: -140, y: 60, w: 80, h: 80 },
  { id: 'VIP LOUNGE', x: 60, y: 60, w: 80, h: 80 },
  { id: 'MOLO SUD (TRANSITO)', x: -6, y: 20, w: 12, h: 40 },
  // ── Central Hub ──
  { id: 'CENTRAL HUB (SMISTAMENTO)', x: -20, y: -20, w: 40, h: 40 },
  // ── Moli e teste d'imbarco ──
  { id: 'MOLO NORD (TRANSITO)', x: -6, y: -280, w: 12, h: 260 },
  { id: 'MOLO OVEST (TRANSITO)', x: -280, y: -6, w: 260, h: 12 },
  { id: 'MOLO EST (TRANSITO)', x: 20, y: -6, w: 260, h: 12 },
  { id: 'WAYSTATION NORD', x: 6, y: -150, w: 20, h: 20 },
  { id: "TERMINALE D'IMBARCO NORD", x: -45, y: -350, w: 90, h: 70 },
  { id: "TERMINALE D'IMBARCO OVEST", x: -350, y: -45, w: 70, h: 90 },
  { id: "TERMINALE D'IMBARCO EST", x: 280, y: -45, w: 70, h: 90 },
]

// Varchi: aperture nei muri perimetrali delle zone
export const GAPS: [number, number, number, number][] = [
  // Ingressi esterni Landside
  [-50, 260, -30, 260], // Ingresso Esterno Ovest (Check-in)
  [30, 260, 50, 260],   // Ingresso Esterno Est (Check-in)
  [-160, 260, -140, 260], // Uscita Passeggeri Arrivi (Baggage Claim)

  // Varchi interni
  [-12, 200, 12, 200], // main hall ↔ filtri
  [-80, 215, -80, 240], // main hall ↔ baggage claim
  [80, 215, 80, 240], // main hall ↔ hangar AMR
  [-40, 155, -40, 180], // filtri ↔ servizi
  [-12, 140, 12, 140], // filtri ↔ duty free
  [-60, 90, -60, 110], // duty free ↔ food court
  [60, 90, 60, 110], // duty free ↔ vip lounge
  [-6, 60, 6, 60], // duty free ↔ molo sud
  [-6, 20, 6, 20], // molo sud ↔ hub
  [-6, -20, 6, -20], // hub ↔ molo nord
  [-20, -6, -20, 6], // hub ↔ molo ovest
  [20, -6, 20, 6], // hub ↔ molo est
  [6, -145, 6, -135], // molo nord ↔ waystation
  [-6, -280, 6, -280], // molo nord ↔ terminale nord
  [-280, -6, -280, 6], // molo ovest ↔ terminale ovest
  [280, -6, 280, 6], // molo est ↔ terminale est
]

// Ostacoli solidi interni (Arredi, Tappeti Mobili, Totem, Banchi)
function buildDecor(): Rect[] {
  const d: Rect[] = []

  // MAIN HALL · Banchi check-in + Colonne
  for (let i = 0; i < 3; i++) d.push({ x: -55, y: 208 + i * 17, w: 110, h: 2.5, r: 0.3 })
  for (let i = 0; i < 8; i++) d.push({ x: -72 + i * 20, y: 252, w: 0.8, h: 0.8, r: 0 })
  // FIDS totem centrale ingressi
  d.push({ x: -6, y: 246, w: 12, h: 1.8, r: 0.2 })

  // BAGGAGE CLAIM · Nastri riconsegna
  for (let i = 0; i < 2; i++) d.push({ x: -170, y: 212 + i * 26, w: 60, h: 5, r: 2.5 })

  // HANGAR AMR · Stazioni di ricarica
  for (let i = 0; i < 6; i++) d.push({ x: 86 + i * 13, y: 203, w: 5, h: 2, r: 0.3 })

  // FILTRI SICUREZZA · Scanner e banchi
  for (let i = 0; i < 6; i++) {
    d.push({ x: -36 + i * 12, y: 162, w: 4.5, h: 1.6, r: 0.2 })
    d.push({ x: -36 + i * 12, y: 168, w: 4.5, h: 6, r: 0.2 })
  }

  // SERVIZI IGIENICI
  d.push({ x: -70.4, y: 145, w: 0.8, h: 50, r: 0 })

  // DUTY FREE PLAZA · Isole espositive + Info Desk
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) d.push({ x: -50 + c * 34, y: 72 + r * 36, w: 14, h: 6, r: 1 })
  }
  d.push({ x: -3, y: 130, w: 6, h: 2.5, r: 0.5 })

  // FOOD COURT & VIP LOUNGE
  d.push({ x: -136, y: 66, w: 3, h: 68, r: 0.5 })
  for (let i = 0; i < 4; i++) d.push({ x: -122, y: 70 + i * 17, w: 50, h: 6, r: 3 })
  for (let i = 0; i < 4; i++) d.push({ x: 66, y: 70 + i * 17, w: 60, h: 5, r: 2.5 })

  // CENTRAL HUB · Core tecnico + Info desk
  d.push({ x: -2, y: -2, w: 4, h: 4, r: 0 })
  d.push({ x: -14, y: -14, w: 3.5, h: 3.5, r: 0.8 })
  d.push({ x: 10.5, y: 10.5, w: 3.5, h: 3.5, r: 0.8 })

  // TAPPETI MOBILI DI TRANSITO (TRAVELATORS) NEI MOLI (Centrati su larghezza 12 m: -1.2 to 1.2)
  // Molo Nord
  d.push({ x: -1.2, y: -250, w: 2.4, h: 75, r: 0.4 })
  d.push({ x: -1.2, y: -115, w: 2.4, h: 75, r: 0.4 })

  // Molo Ovest
  d.push({ x: -250, y: -1.2, w: 75, h: 2.4, r: 0.4 })
  d.push({ x: -115, y: -1.2, w: 75, h: 2.4, r: 0.4 })

  // Molo Est
  d.push({ x: 40, y: -1.2, w: 75, h: 2.4, r: 0.4 })
  d.push({ x: 175, y: -1.2, w: 75, h: 2.4, r: 0.4 })

  // TERMINALI D'IMBARCO SATELLITI
  for (let i = 0; i < 4; i++) d.push({ x: -38 + i * 20, y: -340, w: 12, h: 45, r: 0.5 })
  for (let i = 0; i < 4; i++) d.push({ x: -345, y: -38 + i * 20, w: 45, h: 12, r: 0.5 })
  for (let i = 0; i < 4; i++) d.push({ x: 288, y: -38 + i * 20, w: 45, h: 12, r: 0.5 })

  return d
}

export const DECOR = buildDecor()

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const dist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1)

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export const CELL = 1

function buildWalls(): [number, number, number, number][] {
  const out: [number, number, number, number][] = []
  const EPS = 0.02

  const cut = (fixed: number, from: number, to: number, axis: 'h' | 'v') => {
    const holes: [number, number][] = []
    for (const [gx1, gy1, gx2, gy2] of GAPS) {
      if (axis === 'h') {
        if (Math.abs(gy1 - fixed) > EPS || Math.abs(gy2 - fixed) > EPS) continue
        holes.push([Math.min(gx1, gx2), Math.max(gx1, gx2)])
      } else {
        if (Math.abs(gx1 - fixed) > EPS || Math.abs(gx2 - fixed) > EPS) continue
        holes.push([Math.min(gy1, gy2), Math.max(gy1, gy2)])
      }
    }
    holes.sort((a, b) => a[0] - b[0])

    let cursor = from
    const pieces: [number, number][] = []
    for (const [hs, he] of holes) {
      if (he <= cursor || hs >= to) continue
      if (hs > cursor) pieces.push([cursor, Math.min(hs, to)])
      cursor = Math.max(cursor, he)
    }
    if (cursor < to) pieces.push([cursor, to])

    for (const [ps, pe] of pieces) {
      if (pe - ps < EPS) continue
      if (axis === 'h') out.push([ps, fixed, pe, fixed])
      else out.push([fixed, ps, fixed, pe])
    }
  }

  for (const z of ZONES) {
    cut(z.y, z.x, z.x + z.w, 'h')
    cut(z.y + z.h, z.x, z.x + z.w, 'h')
    cut(z.x, z.y, z.y + z.h, 'v')
    cut(z.x + z.w, z.y, z.y + z.h, 'v')
  }
  return out
}

export const WALLS = buildWalls()

const BOUND = {
  minX: Math.min(...ZONES.map((z) => z.x)) - CELL * 2,
  maxX: Math.max(...ZONES.map((z) => z.x + z.w)) + CELL * 2,
  minY: Math.min(...ZONES.map((z) => z.y)) - CELL * 2,
  maxY: Math.max(...ZONES.map((z) => z.y + z.h)) + CELL * 2,
}
const COLS = Math.ceil((BOUND.maxX - BOUND.minX) / CELL)
const ROWS = Math.ceil((BOUND.maxY - BOUND.minY) / CELL)

const cellCenter = (cx: number, cy: number) => ({
  x: BOUND.minX + cx * CELL + CELL / 2,
  y: BOUND.minY + cy * CELL + CELL / 2,
})

function buildOccupancy(): Uint8Array {
  const occ = new Uint8Array(COLS * ROWS).fill(1)

  for (const z of ZONES) {
    const cx0 = Math.max(0, Math.floor((z.x - BOUND.minX) / CELL))
    const cx1 = Math.min(COLS - 1, Math.ceil((z.x + z.w - BOUND.minX) / CELL))
    const cy0 = Math.max(0, Math.floor((z.y - BOUND.minY) / CELL))
    const cy1 = Math.min(ROWS - 1, Math.ceil((z.y + z.h - BOUND.minY) / CELL))
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const p = cellCenter(cx, cy)
        if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) occ[cy * COLS + cx] = 0
      }
    }
  }

  for (const d of DECOR) {
    const cx0 = Math.max(0, Math.floor((d.x - BOUND.minX) / CELL))
    const cx1 = Math.min(COLS - 1, Math.ceil((d.x + d.w - BOUND.minX) / CELL))
    const cy0 = Math.max(0, Math.floor((d.y - BOUND.minY) / CELL))
    const cy1 = Math.min(ROWS - 1, Math.ceil((d.y + d.h - BOUND.minY) / CELL))
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const p = cellCenter(cx, cy)
        if (p.x > d.x && p.x < d.x + d.w && p.y > d.y && p.y < d.y + d.h) occ[cy * COLS + cx] = 1
      }
    }
  }

  for (const [x1, y1, x2, y2] of WALLS) {
    const len = Math.hypot(x2 - x1, y2 - y1)
    const steps = Math.max(1, Math.ceil(len / (CELL / 2)))
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const cx = Math.floor((lerp(x1, x2, t) - BOUND.minX) / CELL)
      const cy = Math.floor((lerp(y1, y2, t) - BOUND.minY) / CELL)
      if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) occ[cy * COLS + cx] = 1
    }
  }
  return occ
}

function edt1d(f: Float64Array, n: number, out: Float64Array) {
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  let k = 0
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    const d = q - v[k]
    out[q] = d * d + f[v[k]]
  }
}

function buildClearance(occ: Uint8Array): Float32Array {
  const INF = 1e12
  const sq = new Float64Array(COLS * ROWS)
  for (let i = 0; i < sq.length; i++) sq[i] = occ[i] ? 0 : INF

  const colBuf = new Float64Array(ROWS)
  const colOut = new Float64Array(ROWS)
  for (let cx = 0; cx < COLS; cx++) {
    for (let cy = 0; cy < ROWS; cy++) colBuf[cy] = sq[cy * COLS + cx]
    edt1d(colBuf, ROWS, colOut)
    for (let cy = 0; cy < ROWS; cy++) sq[cy * COLS + cx] = colOut[cy]
  }
  const rowBuf = new Float64Array(COLS)
  const rowOut = new Float64Array(COLS)
  const res = new Float32Array(COLS * ROWS)
  for (let cy = 0; cy < ROWS; cy++) {
    const base = cy * COLS
    for (let cx = 0; cx < COLS; cx++) rowBuf[cx] = sq[base + cx]
    edt1d(rowBuf, COLS, rowOut)
    for (let cx = 0; cx < COLS; cx++) res[base + cx] = Math.sqrt(rowOut[cx]) * CELL
  }
  return res
}

const CLEARANCE = buildClearance(buildOccupancy())

function insideAnyZone(x: number, y: number) {
  for (const z of ZONES) {
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return true
  }
  return false
}

export function isFree(x: number, y: number, clear: number) {
  if (!insideAnyZone(x, y)) return false
  for (const d of DECOR) {
    if (x > d.x - clear && x < d.x + d.w + clear && y > d.y - clear && y < d.y + d.h + clear) return false
  }
  for (const [x1, y1, x2, y2] of WALLS) {
    if (distToSegment(x, y, x1, y1, x2, y2) <= clear) return false
  }
  return true
}

export const BASE = ZONES.find((z) => z.id === 'HANGAR AMR (BASE)') as Zone
const BASE_LANE = { x: 80, y: 212, w: 14, h: 40 }

export function assignBaseSlots(bodies: { id: string; radius: number }[]): Record<string, Node> {
  const STEP = 1
  const MARGIN = 1.6
  const candidates: Node[] = []
  for (let x = BASE.x + STEP; x < BASE.x + BASE.w; x += STEP) {
    for (let y = BASE.y + STEP; y < BASE.y + BASE.h; y += STEP) {
      candidates.push({ x, y })
    }
  }
  candidates.sort((a, b) => b.x - a.x || a.y - b.y)

  const placed: { x: number; y: number; r: number }[] = []
  const slots: Record<string, Node> = {}

  for (const body of [...bodies].sort((a, b) => b.radius - a.radius)) {
    const clear = body.radius + 0.15
    for (const c of candidates) {
      if (
        c.x > BASE_LANE.x - clear &&
        c.x < BASE_LANE.x + BASE_LANE.w + clear &&
        c.y > BASE_LANE.y - clear &&
        c.y < BASE_LANE.y + BASE_LANE.h + clear
      ) {
        continue
      }
      if (!isFree(c.x, c.y, clear)) continue
      let clash = false
      for (const p of placed) {
        if (dist(c.x, c.y, p.x, p.y) < body.radius + p.r + MARGIN) {
          clash = true
          break
        }
      }
      if (clash) continue
      slots[body.id] = { x: c.x, y: c.y }
      placed.push({ x: c.x, y: c.y, r: body.radius })
      break
    }
  }
  return slots
}

const SAFE_MARGIN = CELL * 1.5
function guaranteedClearance(x: number, y: number) {
  const cx = Math.floor((x - BOUND.minX) / CELL)
  const cy = Math.floor((y - BOUND.minY) / CELL)
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return 0
  return CLEARANCE[cy * COLS + cx] - SAFE_MARGIN
}

function lineOfSight(
  a: Node, 
  b: Node, 
  clear: number, 
  blockers: { x: number; y: number; r: number }[],
  costMultiplier?: (x: number, y: number, dx: number, dy: number) => number
) {
  const d = dist(a.x, a.y, b.x, b.y)
  if (d === 0) return isFree(a.x, a.y, clear)
  const fine = Math.min(CELL / 3, Math.max(0.1, clear / 3))
  const ux = (b.x - a.x) / d
  const uy = (b.y - a.y) / d
  const startCost = costMultiplier ? costMultiplier(a.x, a.y, ux, uy) : 1.0

  let s = 0
  for (;;) {
    const px = a.x + ux * s
    const py = a.y + uy * s
    if (!isFree(px, py, clear)) return false
    for (const bl of blockers) {
      if (dist(px, py, bl.x, bl.y) < bl.r + clear) return false
    }
    if (costMultiplier) {
      const currentCost = costMultiplier(px, py, ux, uy)
      if (currentCost > startCost + 0.1) return false
    }
    if (s >= d) return true
    const slack = guaranteedClearance(px, py) - clear
    s = Math.min(d, s + Math.max(fine, slack))
  }
}

export function planRoute(
  start: Node,
  goal: Node,
  bodyClear: number,
  blockers: { x: number; y: number; r: number }[],
  safety = 0.35,
  costMultiplier?: (x: number, y: number, dx: number, dy: number) => number
): Node[] | null {
  const clear = bodyClear + safety
  const idx = (cx: number, cy: number) => cy * COLS + cx
  const toCell = (p: Node) => ({
    cx: Math.floor((p.x - BOUND.minX) / CELL),
    cy: Math.floor((p.y - BOUND.minY) / CELL),
  })

  const passableCache = new Int8Array(COLS * ROWS)
  const passable = (cx: number, cy: number) => {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false
    const i = idx(cx, cy)
    const c = passableCache[i]
    if (c !== 0) return c === 1
    const p = cellCenter(cx, cy)
    let ok = isFree(p.x, p.y, clear)
    if (ok) {
      for (const bl of blockers) {
        if (dist(p.x, p.y, bl.x, bl.y) < bl.r + clear) {
          ok = false
          break
        }
      }
    }
    passableCache[i] = ok ? 1 : 2
    return ok
  }

  const snap = (p: Node) => {
    const c = toCell(p)
    if (passable(c.cx, c.cy)) return c
    for (let r = 1; r <= 12; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          if (passable(c.cx + dx, c.cy + dy)) return { cx: c.cx + dx, cy: c.cy + dy }
        }
      }
    }
    return null
  }

  const s = snap(start)
  const g = snap(goal)
  if (!s || !g) return null

  const total = COLS * ROWS
  const gScore = new Float64Array(total).fill(Infinity)
  const fScore = new Float64Array(total).fill(Infinity)
  const cameFrom = new Int32Array(total).fill(-1)
  const closed = new Uint8Array(total)

  const EPS_H = costMultiplier ? 0.35 : 1.15;
  const h = (cx: number, cy: number) => {
    const dx = Math.abs(cx - g.cx)
    const dy = Math.abs(cy - g.cy)
    return EPS_H * (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy))
  }

  const startI = idx(s.cx, s.cy)
  const goalI = idx(g.cx, g.cy)
  gScore[startI] = 0
  fScore[startI] = h(s.cx, s.cy)

  const heap: number[] = [startI]
  const push = (i: number) => {
    heap.push(i)
    let c = heap.length - 1
    while (c > 0) {
      const p = (c - 1) >> 1
      if (fScore[heap[p]] <= fScore[heap[c]]) break
      ;[heap[p], heap[c]] = [heap[c], heap[p]]
      c = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop() as number
    if (heap.length > 0) {
      heap[0] = last
      let p = 0
      for (;;) {
        const l = 2 * p + 1
        const r = l + 1
        let m = p
        if (l < heap.length && fScore[heap[l]] < fScore[heap[m]]) m = l
        if (r < heap.length && fScore[heap[r]] < fScore[heap[m]]) m = r
        if (m === p) break
        ;[heap[p], heap[m]] = [heap[m], heap[p]]
        p = m
      }
    }
    return top
  }

  const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ]

  let found = false
  let guard = 0
  while (heap.length > 0 && guard++ < 400000) {
    const cur = pop()
    if (closed[cur]) continue
    closed[cur] = 1
    if (cur === goalI) {
      found = true
      break
    }
    const cx = cur % COLS
    const cy = (cur / COLS) | 0

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx
      const ny = cy + dy
      if (!passable(nx, ny)) continue
      if (dx !== 0 && dy !== 0 && (!passable(cx + dx, cy) || !passable(cx, cy + dy))) continue
      const ni = idx(nx, ny)
      if (closed[ni]) continue
      
      const step = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1
      const realX = BOUND.minX + nx * CELL + CELL / 2
      const realY = BOUND.minY + ny * CELL + CELL / 2
      const mult = costMultiplier ? costMultiplier(realX, realY, dx, dy) : 1.0
      const tentative = gScore[cur] + (step * mult)
      
      if (tentative < gScore[ni]) {
        gScore[ni] = tentative
        fScore[ni] = tentative + h(nx, ny)
        cameFrom[ni] = cur
        push(ni)
      }
    }
  }

  if (!found) return null

  const raw: Node[] = []
  for (let i = goalI; i !== -1; i = cameFrom[i]) {
    const cx = i % COLS
    const cy = (i / COLS) | 0
    raw.push(cellCenter(cx, cy))
    if (i === startI) break
  }
  raw.reverse()

  raw[0] = { x: start.x, y: start.y }
  const freeForBody = (p: Node) => {
    if (!isFree(p.x, p.y, bodyClear)) return false
    for (const bl of blockers) if (dist(p.x, p.y, bl.x, bl.y) < bl.r + bodyClear) return false
    return true
  }
  if (freeForBody(goal)) raw[raw.length - 1] = { x: goal.x, y: goal.y }

  const out: Node[] = [raw[0]]
  let anchor = 0
  while (anchor < raw.length - 1) {
    let far = anchor + 1
    for (let j = anchor + 2; j < raw.length; j++) {
      if (!lineOfSight(raw[anchor], raw[j], clear, blockers, costMultiplier)) break
      far = j
    }
    out.push(raw[far])
    anchor = far
  }
  return out
}