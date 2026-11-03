import type { Body, Force, Link, LinkKind, Model } from './model'

// Ukážkové systémy – rovnaká sada ako základné modely v OVL. Vodorovné telesá sú
// 80×60 px na osi y = 140, steny 20×120 px; mierka 200 px/m.

const Y = 110

function wall(id: string, name: string, x: number): Body {
  return { id, kind: 'wall', name, layout: { x, y: 80, w: 20, h: 120 } }
}

function mass(id: string, name: string, x: number, p: { m?: number; x0?: number; v0?: number; b?: number } = {}): Body {
  return { id, kind: 'mass', name, layout: { x, y: Y, w: 80, h: 60 }, m: p.m ?? 1, x0: p.x0 ?? 0, v0: p.v0 ?? 0, b: p.b ?? 0 }
}

/** Spoj z pravej (dolnej) strany telesa `from` na ľavú (hornú) stranu telesa `to`. */
function link(id: string, kind: LinkKind, from: string, to: string, n: number, k: number, d: number): Link {
  return { id, kind, a: { body: from, side: 'b' }, b: { body: to, side: 'a' }, kName: `k${n}`, k, dName: `d${n}`, d }
}

function horizontal(name: string, bodies: Body[], links: Link[], forces: Force[] = [], duration = 20): Model {
  return { version: 1, name, axis: 'horizontal', gravity: false, duration, dt: 0.01, scale: 200, bodies, links, forces }
}

/** S1 – k1 – M1 – k2 – M2 – k3 – S2, bez tlmenia: dva vlastné módy a rázy. */
export function twoBodiesBetweenWalls(): Model {
  return horizontal(
    'Dve telesá medzi stenami',
    [wall('w1', 'S1', 40), mass('m1', 'M1', 200, { x0: 0.2 }), mass('m2', 'M2', 400), wall('w2', 'S2', 600)],
    [
      link('l1', 'spring', 'w1', 'm1', 1, 20, 1),
      link('l2', 'spring', 'm1', 'm2', 2, 5, 1),
      link('l3', 'spring', 'm2', 'w2', 3, 20, 1),
    ],
  )
}

/** To isté, ale krajné spoje sú pružina s tlmičom – kmity doznejú. */
export function twoBodiesBetweenWallsDamped(): Model {
  return horizontal(
    'Dve telesá medzi stenami s tlmením',
    [wall('w1', 'S1', 40), mass('m1', 'M1', 200, { x0: 0.2 }), mass('m2', 'M2', 400), wall('w2', 'S2', 600)],
    [
      link('l1', 'springDamper', 'w1', 'm1', 1, 20, 0.8),
      link('l2', 'spring', 'm1', 'm2', 2, 10, 1),
      link('l3', 'springDamper', 'm2', 'w2', 3, 20, 0.8),
    ],
  )
}

/** S1 – k1 – M1, vozík s valivým odporom o podložku. */
export function bodyOnCart(): Model {
  return horizontal(
    'Teleso na vozíku',
    [wall('w1', 'S1', 40), mass('m1', 'M1', 240, { m: 1, x0: 0.25, b: 0.4 })],
    [link('l1', 'spring', 'w1', 'm1', 1, 20, 1)],
    [],
    15,
  )
}

/** S1 – k1 – M1 – k2 – M2, oba vozíky s malým trením. */
export function twoBodiesSpring(): Model {
  return horizontal(
    'Dve telesá spojené pružinou',
    [wall('w1', 'S1', 40), mass('m1', 'M1', 200, { b: 0.1 }), mass('m2', 'M2', 400, { x0: 0.2, b: 0.1 })],
    [link('l1', 'spring', 'w1', 'm1', 1, 20, 1), link('l2', 'spring', 'm1', 'm2', 2, 10, 1)],
  )
}

/** Strop – (k1 ∥ d1) – M1, so (zapnutou) gravitáciou. */
export function hangingOscillator(): Model {
  return {
    version: 1,
    name: 'Tlmený harmonický oscilátor',
    axis: 'vertical',
    gravity: true,
    duration: 10,
    dt: 0.01,
    scale: 200,
    bodies: [
      { id: 'w1', kind: 'wall', name: 'S1', layout: { x: 200, y: 30, w: 160, h: 20 } },
      { id: 'm1', kind: 'mass', name: 'M1', layout: { x: 240, y: 190, w: 80, h: 60 }, m: 1, x0: 0, v0: 0, b: 0 },
    ],
    links: [link('l1', 'spring', 'w1', 'm1', 1, 80, 1), link('l2', 'damper', 'w1', 'm1', 1, 1, 1.5)],
    forces: [],
  }
}

/** S1 – d1 – M1 – k1 – M2: telesá kmitajú proti sebe, tlmič ich ťahá k pokoju. */
export function coupledBodiesSpringDamper(): Model {
  return horizontal(
    'Dve viazané telesá (pružina–tlmič)',
    [wall('w1', 'S1', 40), mass('m1', 'M1', 200), mass('m2', 'M2', 400, { x0: 0.2 })],
    [link('l1', 'damper', 'w1', 'm1', 1, 1, 2), link('l2', 'spring', 'm1', 'm2', 1, 10, 1)],
  )
}

/** Pôvodná úvodná ukážka: dva vozíky so skokom sily. */
export function twoCarts(): Model {
  return horizontal(
    'Dva vozíky',
    [wall('w1', 'S1', 40), mass('m1', 'M1', 200, { m: 2, x0: 0.3 }), mass('m2', 'M2', 420, { b: 0.2 })],
    [link('l1', 'spring', 'w1', 'm1', 1, 20, 1), link('l2', 'springDamper', 'm1', 'm2', 2, 10, 0.8)],
    [{ id: 'f1', name: 'F1', body: 'm2', signal: { type: 'step', amp: 2, t0: 5 } }],
  )
}

export const EXAMPLES = [
  { title: 'Dve telesá medzi stenami', make: twoBodiesBetweenWalls },
  { title: 'Dve telesá medzi stenami s tlmením', make: twoBodiesBetweenWallsDamped },
  { title: 'Teleso na vozíku', make: bodyOnCart },
  { title: 'Dve telesá spojené pružinou', make: twoBodiesSpring },
  { title: 'Tlmený harmonický oscilátor', make: hangingOscillator },
  { title: 'Dve viazané telesá (pružina–tlmič)', make: coupledBodiesSpringDamper },
  { title: 'Dva vozíky so silou', make: twoCarts },
]
