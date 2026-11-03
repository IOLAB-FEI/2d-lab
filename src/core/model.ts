// Dátový model – jediný zdroj pravdy. Fyzika (parametre, topológia) je oddelená od
// zobrazenia (layout v pixeloch). Poloha telesa xᵢ = posunutie voči nakreslenej polohe [m].

export type Axis = 'horizontal' | 'vertical'

/** a = ľavá/horná strana, b = pravá/dolná strana telesa */
export type Side = 'a' | 'b'

export interface Port {
  body: string
  side: Side
}

export interface Layout {
  x: number
  y: number
  w: number
  h: number
}

export interface MassBody {
  id: string
  kind: 'mass'
  name: string
  layout: Layout
  /** hmotnosť [kg] */
  m: number
  /** počiatočná výchylka [m] */
  x0: number
  /** počiatočná rýchlosť [m/s] */
  v0: number
  /** viskózne trenie o podložku [N·s/m] */
  b: number
}

export interface WallBody {
  id: string
  kind: 'wall'
  name: string
  layout: Layout
}

export type Body = MassBody | WallBody

export type LinkKind = 'spring' | 'damper' | 'springDamper'

export interface Link {
  id: string
  kind: LinkKind
  a: Port
  b: Port
  /** názov tuhosti, napr. k1 (pre spring a springDamper) */
  kName: string
  /** tuhosť [N/m] */
  k: number
  /** názov tlmenia, napr. d1 (pre damper a springDamper) */
  dName: string
  /** koeficient tlmenia [N·s/m] */
  d: number
}

export type ForceSignal =
  | { type: 'constant'; amp: number }
  | { type: 'step'; amp: number; t0: number }
  | { type: 'sine'; amp: number; freq: number; t0: number }

export interface Force {
  id: string
  name: string
  body: string
  signal: ForceSignal
}

export interface Model {
  version: 1
  name: string
  axis: Axis
  gravity: boolean
  /** trvanie simulácie [s] */
  duration: number
  /** krok simulácie [s] */
  dt: number
  /** mierka zobrazenia [px/m] */
  scale: number
  bodies: Body[]
  links: Link[]
  forces: Force[]
}

export const G = 9.81

export const hasSpring = (l: Pick<Link, 'kind'>) => l.kind === 'spring' || l.kind === 'springDamper'
export const hasDamper = (l: Pick<Link, 'kind'>) => l.kind === 'damper' || l.kind === 'springDamper'

export function masses(model: Model): MassBody[] {
  return model.bodies.filter((b): b is MassBody => b.kind === 'mass')
}

export function forceValue(s: ForceSignal, t: number): number {
  switch (s.type) {
    case 'constant':
      return s.amp
    case 'step':
      return t >= s.t0 ? s.amp : 0
    case 'sine':
      return t >= s.t0 ? s.amp * Math.sin(2 * Math.PI * s.freq * (t - s.t0)) : 0
  }
}

export function emptyModel(): Model {
  return {
    version: 1,
    name: 'Nový systém',
    axis: 'horizontal',
    gravity: false,
    duration: 20,
    dt: 0.01,
    scale: 200,
    bodies: [],
    links: [],
    forces: [],
  }
}

let counter = 0
export function newId(prefix: string): string {
  counter++
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`
}

/** Najbližší voľný názov s daným prefixom (M1, M2, k1, …). */
export function nextName(model: Model, prefix: string): string {
  const used = new Set<string>()
  for (const b of model.bodies) used.add(b.name)
  for (const l of model.links) {
    if (hasSpring(l)) used.add(l.kName)
    if (hasDamper(l)) used.add(l.dName)
  }
  for (const f of model.forces) used.add(f.name)
  for (let i = 1; ; i++) if (!used.has(prefix + i)) return prefix + i
}
