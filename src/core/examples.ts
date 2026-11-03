import type { Model } from './model'

export function twoCarts(): Model {
  return {
    version: 1,
    name: 'Dva vozíky',
    axis: 'horizontal',
    gravity: false,
    duration: 20,
    dt: 0.01,
    scale: 200,
    bodies: [
      { id: 'w1', kind: 'wall', name: 'S1', layout: { x: 40, y: 80, w: 20, h: 120 } },
      { id: 'm1', kind: 'mass', name: 'M1', layout: { x: 200, y: 110, w: 80, h: 60 }, m: 2, x0: 0.3, v0: 0, b: 0 },
      { id: 'm2', kind: 'mass', name: 'M2', layout: { x: 420, y: 110, w: 80, h: 60 }, m: 1, x0: 0, v0: 0, b: 0.2 },
    ],
    links: [
      { id: 'l1', kind: 'spring', a: { body: 'w1', side: 'b' }, b: { body: 'm1', side: 'a' }, kName: 'k1', k: 20, dName: 'd1', d: 1 },
      { id: 'l2', kind: 'springDamper', a: { body: 'm1', side: 'b' }, b: { body: 'm2', side: 'a' }, kName: 'k2', k: 10, dName: 'd2', d: 0.8 },
    ],
    forces: [{ id: 'f1', name: 'F1', body: 'm2', signal: { type: 'step', amp: 2, t0: 5 } }],
  }
}

export function hangingOscillator(): Model {
  return {
    version: 1,
    name: 'Zavesený oscilátor',
    axis: 'vertical',
    gravity: true,
    duration: 10,
    dt: 0.01,
    scale: 200,
    bodies: [
      { id: 'w1', kind: 'wall', name: 'S1', layout: { x: 200, y: 30, w: 160, h: 20 } },
      { id: 'm1', kind: 'mass', name: 'M1', layout: { x: 240, y: 190, w: 80, h: 60 }, m: 1, x0: 0, v0: 0, b: 0 },
    ],
    links: [
      { id: 'l1', kind: 'springDamper', a: { body: 'w1', side: 'b' }, b: { body: 'm1', side: 'a' }, kName: 'k1', k: 80, dName: 'd1', d: 1.5 },
    ],
    forces: [],
  }
}

export const EXAMPLES = [
  { title: 'Dva vozíky', make: twoCarts },
  { title: 'Zavesený oscilátor', make: hangingOscillator },
]
