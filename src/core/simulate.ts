// Presná diskretizácia lineárneho systému (ZOH, vstup vzorkovaný v strede kroku).

import { expm, zeros } from './linalg'
import { assemble, inputAt, stateSpace } from './assemble'
import type { Model } from './model'

export interface SimResult {
  t: Float64Array
  /** id telies v poradí stupňov voľnosti */
  massIds: string[]
  x: Float64Array[]
  v: Float64Array[]
}

export function simulate(model: Model): SimResult {
  const asm = assemble(model)
  const n = asm.M.length
  const steps = Math.max(1, Math.round(model.duration / model.dt))
  const dt = model.duration / steps
  const t = new Float64Array(steps + 1)
  for (let k = 0; k <= steps; k++) t[k] = k * dt
  const x = asm.masses.map(() => new Float64Array(steps + 1))
  const v = asm.masses.map(() => new Float64Array(steps + 1))
  const result: SimResult = { t, massIds: asm.masses.map(m => m.id), x, v }
  if (n === 0) return result

  const { A, B } = stateSpace(asm)
  // exp([[A, B], [0, 0]]·dt) = [[Φ, Γ], [0, I]]
  const N = 3 * n
  const aug = zeros(N, N)
  for (let i = 0; i < 2 * n; i++) {
    for (let j = 0; j < 2 * n; j++) aug[i][j] = A[i][j] * dt
    for (let j = 0; j < n; j++) aug[i][2 * n + j] = B[i][j] * dt
  }
  const E = expm(aug)

  let z = [...asm.masses.map(m => m.x0), ...asm.masses.map(m => m.v0)]
  const next = new Array<number>(2 * n)
  for (let k = 0; ; k++) {
    for (let i = 0; i < n; i++) {
      x[i][k] = z[i]
      v[i][k] = z[n + i]
    }
    if (k === steps) break
    const u = inputAt(model, asm, (k + 0.5) * dt)
    for (let i = 0; i < 2 * n; i++) {
      let s = 0
      const row = E[i]
      for (let j = 0; j < 2 * n; j++) s += row[j] * z[j]
      for (let j = 0; j < n; j++) s += row[2 * n + j] * u[j]
      next[i] = s
    }
    z = next.slice()
  }
  return result
}

/** Index vzorky najbližšej času t. */
export function sampleIndex(res: SimResult, t: number): number {
  const last = res.t.length - 1
  if (last <= 0) return 0
  const dt = res.t[last] / last
  return Math.min(last, Math.max(0, Math.round(t / dt)))
}
