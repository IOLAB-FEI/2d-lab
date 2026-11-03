// Zostavenie M·ẍ + C·ẋ + K·x = u „stampingom“ z topológie a stavový model.

import { type Mat, solve, zeros } from './linalg'
import { type Model, type MassBody, masses, hasSpring, hasDamper, forceValue, G } from './model'

export interface Assembled {
  masses: MassBody[]
  /** id telesa → index stupňa voľnosti (steny nemajú index) */
  index: Map<string, number>
  M: number[]
  K: Mat
  C: Mat
}

function stamp(T: Mat, a: number | undefined, b: number | undefined, c: number) {
  if (a !== undefined) T[a][a] += c
  if (b !== undefined) T[b][b] += c
  if (a !== undefined && b !== undefined) {
    T[a][b] -= c
    T[b][a] -= c
  }
}

export function assemble(model: Model): Assembled {
  const ms = masses(model)
  const n = ms.length
  const index = new Map(ms.map((m, i) => [m.id, i]))
  const M = ms.map(m => m.m)
  const K = zeros(n, n)
  const C = zeros(n, n)
  ms.forEach((m, i) => (C[i][i] += m.b))
  for (const l of model.links) {
    if (l.a.body === l.b.body) continue
    const a = index.get(l.a.body)
    const b = index.get(l.b.body)
    if (hasSpring(l)) stamp(K, a, b, l.k)
    if (hasDamper(l)) stamp(C, a, b, l.d)
  }
  return { masses: ms, index, M, K, C }
}

/** Vektor vonkajších síl (vrátane gravitácie) v čase t. */
export function inputAt(model: Model, asm: Assembled, t: number): number[] {
  const u = asm.masses.map(m => (model.gravity && model.axis === 'vertical' ? m.m * G : 0))
  for (const f of model.forces) {
    const i = asm.index.get(f.body)
    if (i !== undefined) u[i] += forceValue(f.signal, t)
  }
  return u
}

/** ż = A·z + B·u, z = [x; ẋ], u = sily na telesá. */
export function stateSpace(asm: Assembled): { A: Mat; B: Mat } {
  const n = asm.M.length
  const Minv = asm.M.map(m => 1 / m)
  const A = zeros(2 * n, 2 * n)
  const B = zeros(2 * n, n)
  for (let i = 0; i < n; i++) {
    A[i][n + i] = 1
    B[n + i][i] = Minv[i]
    for (let j = 0; j < n; j++) {
      A[n + i][j] = -asm.K[i][j] * Minv[i]
      A[n + i][n + j] = -asm.C[i][j] * Minv[i]
    }
  }
  return { A, B }
}

/** Statická rovnováha K·x = u (ak je K regulárna), inak null. */
export function equilibrium(asm: Assembled, u: number[]): number[] | null {
  const n = asm.M.length
  if (n === 0) return []
  try {
    return solve(asm.K, u.map(v => [v])).map(r => r[0])
  } catch {
    return null
  }
}

