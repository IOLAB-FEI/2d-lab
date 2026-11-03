// Zobrazenie: z fyzikálneho posunutia [m] sa odvodí poloha na plátne [px].

import type { Body, Layout, Link, Model, Side } from './model'
import type { SimResult } from './simulate'

export interface Point {
  x: number
  y: number
}

/**
 * Zmení orientáciu systému: kresba sa transponuje (ľavá strana → horná, pravá → dolná),
 * takže porty aj spoje ostanú zmysluplné. Vertikálny systém má predvolene gravitáciu.
 */
export function setAxis(model: Model, axis: Model['axis']) {
  if (model.axis === axis) return
  model.axis = axis
  model.gravity = axis === 'vertical'
  for (const b of model.bodies) b.layout = { x: b.layout.y, y: b.layout.x, w: b.layout.h, h: b.layout.w }
  const minX = Math.min(...model.bodies.map(b => b.layout.x))
  const minY = Math.min(...model.bodies.map(b => b.layout.y))
  for (const b of model.bodies) {
    b.layout.x += 40 - minX
    b.layout.y += 40 - minY
  }
}

/** Obálka nakreslených prvkov [px]. */
export function bounds(model: Model): Layout | null {
  if (!model.bodies.length) return null
  const x = Math.min(...model.bodies.map(b => b.layout.x))
  const y = Math.min(...model.bodies.map(b => b.layout.y))
  const r = Math.max(...model.bodies.map(b => b.layout.x + b.layout.w))
  const btm = Math.max(...model.bodies.map(b => b.layout.y + b.layout.h))
  return { x, y, w: r - x, h: btm - y }
}

export function displaced(model: Model, l: Layout, q: number): Layout {
  const d = q * model.scale
  return model.axis === 'horizontal' ? { ...l, x: l.x + d } : { ...l, y: l.y + d }
}

export function portPoint(model: Model, l: Layout, side: Side): Point {
  if (model.axis === 'horizontal') return { x: side === 'a' ? l.x : l.x + l.w, y: l.y + l.h / 2 }
  return { x: l.x + l.w / 2, y: side === 'a' ? l.y : l.y + l.h }
}

const pairKey = (l: Link) => [l.a.body, l.b.body].sort().join('|')

/** Kolmý posun paralelných spojov medzi tou istou dvojicou prvkov [px]. */
export function linkOffsets(model: Model): Map<string, number> {
  const groups = new Map<string, Link[]>()
  for (const l of model.links) groups.set(pairKey(l), [...(groups.get(pairKey(l)) ?? []), l])
  const out = new Map<string, number>()
  for (const g of groups.values()) g.forEach((l, i) => out.set(l.id, (i - (g.length - 1) / 2) * 24))
  return out
}

export function linkEnds(model: Model, link: Link, layoutOf: (b: Body) => Layout, offset: number): [Point, Point] | null {
  const a = model.bodies.find(b => b.id === link.a.body)
  const b = model.bodies.find(b => b.id === link.b.body)
  if (!a || !b) return null
  const p = portPoint(model, layoutOf(a), link.a.side)
  const q = portPoint(model, layoutOf(b), link.b.side)
  if (model.axis === 'horizontal') return [{ x: p.x, y: p.y + offset }, { x: q.x, y: q.y + offset }]
  return [{ x: p.x + offset, y: p.y }, { x: q.x + offset, y: q.y }]
}

const overlaps = (a: Layout, b: Layout) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1

/** Prvý okamih, keď sa telesá (alebo teleso a stena) prekryjú – lineárny model kolízie nepozná. */
export function firstOverlap(model: Model, res: SimResult): { t: number; names: string[] } | null {
  const bodies = model.bodies
  const qIndex = new Map(res.massIds.map((id, i) => [id, i]))
  const pairs: [Body, Body][] = []
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const [a, b] = [bodies[i], bodies[j]]
      if (a.kind === 'wall' && b.kind === 'wall') continue
      if (overlaps(a.layout, b.layout)) continue
      pairs.push([a, b])
    }
  if (!pairs.length) return null
  const at = (b: Body, k: number) => {
    const i = qIndex.get(b.id)
    return i === undefined ? b.layout : displaced(model, b.layout, res.x[i][k])
  }
  for (let k = 0; k < res.t.length; k++)
    for (const [a, b] of pairs) if (overlaps(at(a, k), at(b, k))) return { t: res.t[k], names: [a.name, b.name] }
  return null
}
