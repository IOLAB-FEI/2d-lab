// Parametrické tvary spojov – tvar sa vždy odvodí z koncových bodov, takže animácia je len
// zmena koncových bodov.

import type { Point } from '../../core/geometry'

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const at = (p: Point, u: Point, n: Point, s: number, o = 0): Point => ({ x: p.x + u.x * s + n.x * o, y: p.y + u.y * s + n.y * o })
const pts = (ps: Point[]) => ps.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

function frame(p: Point, q: Point) {
  const d = sub(q, p)
  const len = Math.hypot(d.x, d.y) || 1
  const u = { x: d.x / len, y: d.y / len }
  return { len, u, n: { x: -u.y, y: u.x } }
}

export function springPath(p: Point, q: Point, coils = 7, amp = 9): string {
  const { len, u, n } = frame(p, q)
  const lead = Math.min(12, len * 0.15)
  const body = len - 2 * lead
  const list: Point[] = [p, at(p, u, n, lead)]
  for (let i = 0; i < coils * 2; i++) list.push(at(p, u, n, lead + (body * (i + 0.5)) / (coils * 2), i % 2 ? -amp : amp))
  list.push(at(p, u, n, len - lead), q)
  return `M ${pts(list).replace(/ /g, ' L ')}`
}

/** Valec pri bode p, piest s tyčou pri bode q. */
export function damperPaths(p: Point, q: Point, width = 18): { cylinder: string; piston: string } {
  const { len, u, n } = frame(p, q)
  const cyl = Math.min(36, len * 0.55)
  const start = Math.max(6, (len - cyl) * 0.3)
  const h = width / 2
  const c0 = at(p, u, n, start)
  const cylinder = `M ${pts([p, c0])} M ${pts([at(p, u, n, start + cyl, -h), at(p, u, n, start, -h), at(p, u, n, start, h), at(p, u, n, start + cyl, h)]).replace(/ /g, ' L ')}`
  const plate = Math.max(start + 4, Math.min(start + cyl - 4, len - 10))
  const piston = `M ${pts([at(p, u, n, plate, -h + 3), at(p, u, n, plate, h - 3)])} M ${pts([at(p, u, n, plate), q])}`
  return { cylinder, piston }
}

/** Paralelné zapojenie pružiny a tlmiča: krátke priečky na koncoch + dve vetvy. */
export function springDamperPaths(p: Point, q: Point) {
  const { len, u, n } = frame(p, q)
  const lead = Math.min(10, len * 0.12)
  const o = 12
  const a1 = at(p, u, n, lead, -o), a2 = at(p, u, n, lead, o)
  const b1 = at(p, u, n, len - lead, -o), b2 = at(p, u, n, len - lead, o)
  const bars = `M ${pts([p, at(p, u, n, lead)])} M ${pts([a1, a2])} M ${pts([b1, b2])} M ${pts([at(p, u, n, len - lead), q])}`
  return { bars, spring: springPath(a1, b1, 6, 6), damper: damperPaths(a2, b2, 14) }
}

export function arrowPath(from: Point, to: Point, head = 8): string {
  const { len, u, n } = frame(from, to)
  if (len < 2) return ''
  const h = Math.min(head, len)
  const base = at(from, u, n, len - h)
  const wing = (s: number) => at(base, u, n, 0, s * h * 0.6)
  return `M ${pts([from, to])} M ${pts([wing(1), to, wing(-1)]).replace(/ /g, ' L ')}`
}
