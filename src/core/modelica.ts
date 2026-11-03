// Export do Modelica (MSL, Modelica.Mechanics.Translational). Polohy sú posunutia voči
// nakreslenému stavu, preto Fixed.s0 = 0, Spring.s_rel0 = 0 a Mass.L = 0.

import { type Model, masses, hasSpring, hasDamper, G } from './model'

const num = (v: number) => {
  if (!Number.isFinite(v)) throw new Error('Neplatné číslo v modeli')
  return String(v)
}

export function identifier(name: string, used: Set<string>): string {
  let id = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]/g, '_').replace(/^(\d)/, '_$1') || 'c'
  const base = id
  for (let i = 2; used.has(id); i++) id = `${base}_${i}`
  used.add(id)
  return id
}

export function toModelica(model: Model): string {
  const used = new Set<string>()
  const modelName = identifier(model.name, used)
  const ids = new Map<string, string>()
  for (const b of model.bodies) ids.set(b.id, identifier(b.name, used))
  const decl: string[] = []
  const eq: string[] = []
  const flange = (body: string, side: 'a' | 'b') => {
    const b = model.bodies.find(x => x.id === body)!
    return b.kind === 'wall' ? `${ids.get(body)}.flange` : `${ids.get(body)}.flange_${side}`
  }

  let ground: string | null = null
  const groundFlange = () => {
    if (!ground) {
      ground = identifier('ground', used)
      decl.push(`  Translational.Components.Fixed ${ground}(s0 = 0);`)
    }
    return `${ground}.flange`
  }

  for (const b of model.bodies) {
    if (b.kind === 'wall') decl.push(`  Translational.Components.Fixed ${ids.get(b.id)}(s0 = 0);`)
    else
      decl.push(
        `  Translational.Components.Mass ${ids.get(b.id)}(m = ${num(b.m)}, L = 0, s(start = ${num(b.x0)}, fixed = true), v(start = ${num(b.v0)}, fixed = true));`,
      )
  }
  for (const m of masses(model)) {
    if (m.b > 0) {
      const id = identifier(`${m.name}_friction`, used)
      decl.push(`  Translational.Components.Damper ${id}(d = ${num(m.b)});`)
      eq.push(`  connect(${groundFlange()}, ${id}.flange_a);`, `  connect(${id}.flange_b, ${ids.get(m.id)}.flange_a);`)
    }
    if (model.gravity && model.axis === 'vertical') {
      const id = identifier(`${m.name}_weight`, used)
      decl.push(`  Translational.Sources.ConstantForce ${id}(f_constant = ${num(m.m * G)});`)
      eq.push(`  connect(${id}.flange, ${ids.get(m.id)}.flange_a);`)
    }
  }
  for (const l of model.links) {
    const a = flange(l.a.body, l.a.side)
    const b = flange(l.b.body, l.b.side)
    const parts: string[] = []
    if (hasSpring(l)) {
      const id = identifier(l.kName, used)
      decl.push(`  Translational.Components.Spring ${id}(c = ${num(l.k)}, s_rel0 = 0);`)
      parts.push(id)
    }
    if (hasDamper(l)) {
      const id = identifier(l.dName, used)
      decl.push(`  Translational.Components.Damper ${id}(d = ${num(l.d)});`)
      parts.push(id)
    }
    for (const p of parts) eq.push(`  connect(${a}, ${p}.flange_a);`, `  connect(${p}.flange_b, ${b});`)
  }
  for (const f of model.forces) {
    const id = identifier(f.name, used)
    const sig = identifier(`${f.name}_signal`, used)
    const s = f.signal
    decl.push(`  Translational.Sources.Force ${id};`)
    if (s.type === 'constant') decl.push(`  Modelica.Blocks.Sources.Constant ${sig}(k = ${num(s.amp)});`)
    if (s.type === 'step') decl.push(`  Modelica.Blocks.Sources.Step ${sig}(height = ${num(s.amp)}, startTime = ${num(s.t0)});`)
    if (s.type === 'sine')
      decl.push(`  Modelica.Blocks.Sources.Sine ${sig}(amplitude = ${num(s.amp)}, f = ${num(s.freq)}, startTime = ${num(s.t0)});`)
    eq.push(`  connect(${sig}.y, ${id}.f);`, `  connect(${id}.flange, ${ids.get(f.body)}.flange_a);`)
  }

  return [
    `model ${modelName}`,
    `  // Vygenerované nástrojom mmodels. Polohy sú posunutia voči nakreslenému stavu [m].`,
    `  import Modelica.Mechanics.Translational;`,
    ...decl,
    `equation`,
    ...eq,
    `  annotation(experiment(StopTime = ${num(model.duration)}, Interval = ${num(model.dt)}));`,
    `end ${modelName};`,
    '',
  ].join('\n')
}
