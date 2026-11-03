// Malá hustá lineárna algebra – systémy majú rádovo desiatky stavov.

export type Mat = number[][]

export const zeros = (r: number, c: number): Mat => Array.from({ length: r }, () => new Array<number>(c).fill(0))

export function eye(n: number): Mat {
  const I = zeros(n, n)
  for (let i = 0; i < n; i++) I[i][i] = 1
  return I
}

export function mul(A: Mat, B: Mat): Mat {
  const r = A.length, c = B[0]?.length ?? 0, m = B.length
  const C = zeros(r, c)
  for (let i = 0; i < r; i++)
    for (let k = 0; k < m; k++) {
      const a = A[i][k]
      if (a === 0) continue
      for (let j = 0; j < c; j++) C[i][j] += a * B[k][j]
    }
  return C
}

export const add = (A: Mat, B: Mat, s = 1): Mat => A.map((row, i) => row.map((v, j) => v + s * B[i][j]))
export const scale = (A: Mat, s: number): Mat => A.map(row => row.map(v => v * s))

export function norm1(A: Mat): number {
  let best = 0
  for (let j = 0; j < (A[0]?.length ?? 0); j++) {
    let s = 0
    for (let i = 0; i < A.length; i++) s += Math.abs(A[i][j])
    best = Math.max(best, s)
  }
  return best
}

/** Rieši A·X = B (LU s čiastočným pivotovaním). */
export function solve(A: Mat, B: Mat): Mat {
  const n = A.length
  const M = A.map(r => r.slice())
  const X = B.map(r => r.slice())
  for (let k = 0; k < n; k++) {
    let p = k
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i
    if (Math.abs(M[p][k]) < 1e-300) throw new Error('Singulárna matica')
    if (p !== k) {
      ;[M[p], M[k]] = [M[k], M[p]]
      ;[X[p], X[k]] = [X[k], X[p]]
    }
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k]
      if (f === 0) continue
      for (let j = k; j < n; j++) M[i][j] -= f * M[k][j]
      for (let j = 0; j < X[0].length; j++) X[i][j] -= f * X[k][j]
    }
  }
  for (let k = n - 1; k >= 0; k--) {
    for (let j = 0; j < X[0].length; j++) {
      let s = X[k][j]
      for (let i = k + 1; i < n; i++) s -= M[k][i] * X[i][j]
      X[k][j] = s / M[k][k]
    }
  }
  return X
}

/** Maticová exponenciála: Padé (q = 6) so scaling & squaring. */
export function expm(A: Mat): Mat {
  const n = A.length
  const s = Math.max(0, Math.ceil(Math.log2(norm1(A) / 0.5)))
  const X = scale(A, 1 / 2 ** s)
  const q = 6
  let c = 1
  let N = eye(n)
  let D = eye(n)
  let P = eye(n)
  for (let k = 1; k <= q; k++) {
    c = (c * (q - k + 1)) / (k * (2 * q - k + 1))
    P = mul(P, X)
    N = add(N, P, c)
    D = add(D, P, k % 2 === 0 ? c : -c)
  }
  let E = solve(D, N)
  for (let i = 0; i < s; i++) E = mul(E, E)
  return E
}
