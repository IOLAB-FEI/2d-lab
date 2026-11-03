import { describe, expect, it } from 'vitest'
import katex from 'katex'
import { expm } from './linalg'
import { simulate } from './simulate'
import { equations } from './equations'
import { validate } from './validate'
import { toModelica } from './modelica'
import { firstOverlap, setAxis } from './geometry'
import { EXAMPLES, twoCarts, hangingOscillator } from './examples'
import { type Model, emptyModel, G } from './model'

function oscillator(m: number, k: number, d: number, x0: number, extra: Partial<Model> = {}): Model {
  return {
    ...emptyModel(),
    duration: 10,
    dt: 0.01,
    bodies: [
      { id: 'w', kind: 'wall', name: 'S1', layout: { x: 0, y: 0, w: 20, h: 100 } },
      { id: 'm', kind: 'mass', name: 'M1', layout: { x: 200, y: 20, w: 60, h: 60 }, m, x0, v0: 0, b: 0 },
    ],
    links: [{ id: 'l', kind: d > 0 ? 'springDamper' : 'spring', a: { body: 'w', side: 'b' }, b: { body: 'm', side: 'a' }, kName: 'k1', k, dName: 'd1', d }],
    ...extra,
  }
}

describe('linalg', () => {
  it('expm rotácie zodpovedá cos/sin', () => {
    const E = expm([[0, 2], [-2, 0]])
    expect(E[0][0]).toBeCloseTo(Math.cos(2), 12)
    expect(E[0][1]).toBeCloseTo(Math.sin(2), 12)
  })
})

describe('simulácia', () => {
  it('netlmený oscilátor = x0·cos(ωt)', () => {
    const res = simulate(oscillator(2, 50, 0, 0.1))
    const w = Math.sqrt(50 / 2)
    for (let k = 0; k < res.t.length; k += 37) expect(res.x[0][k]).toBeCloseTo(0.1 * Math.cos(w * res.t[k]), 10)
  })

  it('podkritické tlmenie zodpovedá analytickému riešeniu', () => {
    const [m, k, d, x0] = [1, 40, 2, 0.2]
    const res = simulate(oscillator(m, k, d, x0))
    const wn = Math.sqrt(k / m), z = d / (2 * Math.sqrt(k * m)), wd = wn * Math.sqrt(1 - z * z)
    const exact = (t: number) => x0 * Math.exp(-z * wn * t) * (Math.cos(wd * t) + ((z * wn) / wd) * Math.sin(wd * t))
    for (let i = 0; i < res.t.length; i += 41) expect(res.x[0][i]).toBeCloseTo(exact(res.t[i]), 10)
  })

  it('skok sily → ustálená výchylka F/k', () => {
    const model = oscillator(1, 25, 3, 0, { duration: 30, forces: [{ id: 'f', name: 'F1', body: 'm', signal: { type: 'step', amp: 5, t0: 1 } }] })
    const res = simulate(model)
    expect(res.x[0][res.t.length - 1]).toBeCloseTo(5 / 25, 6)
    expect(res.x[0][50]).toBe(0)
  })

  it('gravitácia vo vertikálnom systéme → rovnováha m·g/k', () => {
    const res = simulate({ ...hangingOscillator(), duration: 60 })
    expect(res.x[0][res.t.length - 1]).toBeCloseTo((1 * G) / 80, 6)
  })

  it('dve telesá bez tlmenia zachovávajú energiu', () => {
    const model: Model = {
      ...twoCarts(),
      forces: [],
      bodies: twoCarts().bodies.map(b => (b.kind === 'mass' ? { ...b, b: 0 } : b)),
      links: twoCarts().links.map(l => ({ ...l, kind: 'spring' as const })),
    }
    const res = simulate(model)
    const energy = (i: number) => {
      const [x1, x2, v1, v2] = [res.x[0][i], res.x[1][i], res.v[0][i], res.v[1][i]]
      return 0.5 * 2 * v1 * v1 + 0.5 * 1 * v2 * v2 + 0.5 * 20 * x1 * x1 + 0.5 * 10 * (x2 - x1) ** 2
    }
    const e0 = energy(0)
    for (let i = 0; i < res.t.length; i += 97) expect(energy(i)).toBeCloseTo(e0, 9)
  })
})

describe('rovnice', () => {
  it('odvodí členy z topológie', () => {
    const eq = equations(twoCarts())
    expect(eq.lines[0]).toContain('M_{1}\\,\\ddot{x}_{1} =')
    expect(eq.lines[0]).toContain('k_{1}\\,x_{1}')
    expect(eq.lines[0]).toContain('k_{2}\\,(x_{2} - x_{1})')
    expect(eq.lines[1]).toContain('d_{2}\\,(\\dot{x}_{1} - \\dot{x}_{2})')
    expect(eq.lines[1]).toContain('F_{1}(t)')
    expect(eq.defs[0]).toContain('\\mathbf{1}(t \\ge 5)')
  })

  it('všetky rovnice sa dajú vysádzať KaTeX-om (aj so zvýraznením)', () => {
    for (const ex of EXAMPLES)
      for (const numeric of [false, true])
        for (const highlight of [null, 'l1', 'm1', 'f1']) {
          const eq = equations(ex.make(), { numeric, highlight })
          for (const tex of [...eq.lines, ...eq.defs]) expect(() => katex.renderToString(tex, { throwOnError: true })).not.toThrow()
        }
  })
})

describe('validácia a export', () => {
  it('ukážky sú platné', () => {
    for (const ex of EXAMPLES) expect(validate(ex.make()).filter(i => i.level === 'error')).toEqual([])
  })

  it('odhalí nekladnú hmotnosť a voľné teleso', () => {
    const model = oscillator(0, 10, 0, 0)
    model.links = []
    const issues = validate(model)
    expect(issues.some(i => i.level === 'error' && i.message.includes('hmotnosť'))).toBe(true)
    expect(issues.some(i => i.level === 'warning')).toBe(true)
  })

  it('Modelica export obsahuje komponenty a spojenia', () => {
    const mo = toModelica(twoCarts())
    expect(mo).toContain('model Dva_voziky')
    expect(mo).toContain('end Dva_voziky;')
    expect(mo).toContain('Translational.Components.Mass M1(m = 2')
    expect(mo).toContain('connect(S1.flange, k1.flange_a);')
    expect(mo).toContain('connect(k2.flange_b, M2.flange_a);')
    expect(mo).toContain('Modelica.Blocks.Sources.Step F1_signal(height = 2, startTime = 5);')
  })

  it('prepnutie na vertikálny systém otočí kresbu a zachová fyziku', () => {
    const model = twoCarts()
    setAxis(model, 'vertical')
    const [w, m1] = model.bodies
    expect(model.gravity).toBe(true)
    expect(w.layout.h).toBe(20) // stena je teraz strop
    expect(m1.layout.y).toBeGreaterThan(w.layout.y + w.layout.h) // teleso je pod stropom
    expect(equations(model).lines[0]).toContain('M_{1}\\,g')
    setAxis(model, 'horizontal')
    expect(model.bodies[0].layout).toEqual({ x: 40, y: 40, w: 20, h: 120 })
  })

  it('odhalí prekrytie telies', () => {
    const model = oscillator(1, 10, 0, -0.95)
    const hit = firstOverlap(model, simulate(model))
    expect(hit?.names).toEqual(['S1', 'M1'])
  })
})
