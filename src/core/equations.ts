// Pohybové rovnice v LaTeX-e, odvodené z tých istých príspevkov ako matice v assemble.ts.

import { type Model, type ForceSignal, masses, hasSpring, hasDamper, G } from './model'

export const COLORS = {
  spring: '#0F6E56',
  damper: '#993C1D',
  force: '#854F0B',
  friction: '#5F5E5A',
  gravity: '#534AB7',
  highlight: '#FDE68A',
}

interface Term {
  owner: string
  sign: 1 | -1
  sym: string
  num: string
  color: string
}

/** M1 → M_{1}, k12 → k_{12}, iné znaky → \text{…} */
export function texName(name: string): string {
  const m = /^([A-Za-z]+)(\d*)$/.exec(name)
  if (!m) return `\\text{${name.replace(/[\\{}$&#^_%~]/g, '')}}`
  return m[2] ? `${m[1]}_{${m[2]}}` : m[1]
}

export function fmt(v: number): string {
  if (!Number.isFinite(v)) return '?'
  const s = Number(v.toPrecision(4)).toString()
  return s.includes('e') ? s.replace(/e\+?(-?\d+)/, '\\cdot 10^{$1}') : s
}

function signalTex(s: ForceSignal): string {
  const shift = (t0: number) => (t0 === 0 ? 't' : `(t - ${fmt(t0)})`)
  switch (s.type) {
    case 'constant':
      return fmt(s.amp)
    case 'step':
      return `${fmt(s.amp)} \\cdot \\mathbf{1}(t \\ge ${fmt(s.t0)})`
    case 'sine':
      return `${fmt(s.amp)} \\sin\\left(2\\pi \\cdot ${fmt(s.freq)}\\,${shift(s.t0)}\\right)${s.t0 > 0 ? `,\\ t \\ge ${fmt(s.t0)}` : ''}`
  }
}

export interface EquationOptions {
  numeric?: boolean
  highlight?: string | null
}

export interface Equations {
  /** jedna rovnica na teleso */
  lines: string[]
  /** definície vstupných síl */
  defs: string[]
  /** legenda premenných */
  vars: { massId: string; tex: string }[]
}

export function equations(model: Model, opts: EquationOptions = {}): Equations {
  const ms = masses(model)
  const index = new Map(ms.map((m, i) => [m.id, i]))
  const x = (i: number) => `x_{${i + 1}}`
  const xd = (i: number) => `\\dot{x}_{${i + 1}}`
  const wrap = (owner: string, color: string, body: string) =>
    owner === opts.highlight ? `\\colorbox{${COLORS.highlight}}{$${body}$}` : `\\textcolor{${color}}{${body}}`

  const lines = ms.map((m, i) => {
    const terms: Term[] = []
    for (const l of model.links) {
      if (l.a.body === l.b.body) continue
      let other: string
      if (l.a.body === m.id) other = l.b.body
      else if (l.b.body === m.id) other = l.a.body
      else continue
      const j = index.get(other)
      if (hasSpring(l)) {
        const k = texName(l.kName)
        if (j === undefined) terms.push({ owner: l.id, sign: -1, sym: `${k}\\,${x(i)}`, num: `${fmt(l.k)}\\,${x(i)}`, color: COLORS.spring })
        else terms.push({ owner: l.id, sign: 1, sym: `${k}\\,(${x(j)} - ${x(i)})`, num: `${fmt(l.k)}\\,(${x(j)} - ${x(i)})`, color: COLORS.spring })
      }
      if (hasDamper(l)) {
        const d = texName(l.dName)
        if (j === undefined) terms.push({ owner: l.id, sign: -1, sym: `${d}\\,${xd(i)}`, num: `${fmt(l.d)}\\,${xd(i)}`, color: COLORS.damper })
        else terms.push({ owner: l.id, sign: 1, sym: `${d}\\,(${xd(j)} - ${xd(i)})`, num: `${fmt(l.d)}\\,(${xd(j)} - ${xd(i)})`, color: COLORS.damper })
      }
    }
    if (m.b > 0) terms.push({ owner: m.id, sign: -1, sym: `b_{${i + 1}}\\,${xd(i)}`, num: `${fmt(m.b)}\\,${xd(i)}`, color: COLORS.friction })
    if (model.gravity && model.axis === 'vertical')
      terms.push({ owner: m.id, sign: 1, sym: `${texName(m.name)}\\,g`, num: fmt(m.m * G), color: COLORS.gravity })
    for (const f of model.forces)
      if (f.body === m.id) terms.push({ owner: f.id, sign: 1, sym: `${texName(f.name)}(t)`, num: `${texName(f.name)}(t)`, color: COLORS.force })

    const lhsBody = `${opts.numeric ? fmt(m.m) : texName(m.name)}\\,\\ddot{x}_{${i + 1}}`
    const lhs = m.id === opts.highlight ? `\\colorbox{${COLORS.highlight}}{$${lhsBody}$}` : lhsBody
    const rhs = terms.length
      ? terms
          .map((t, n) => {
            const op = t.sign < 0 ? '-' : n === 0 ? '' : '+'
            return `${op} ${wrap(t.owner, t.color, opts.numeric ? t.num : t.sym)}`
          })
          .join(' ')
      : '0'
    return `${lhs} = ${rhs}`
  })

  const defs = model.forces
    .filter(f => index.has(f.body))
    .map(f => `${wrap(f.id, COLORS.force, `${texName(f.name)}(t)`)} = ${signalTex(f.signal)}`)

  const vars = ms.map((m, i) => ({ massId: m.id, tex: `${x(i)}` }))
  return { lines, defs, vars }
}
