import { type Model, masses, hasSpring, hasDamper } from './model'

export interface Issue {
  level: 'error' | 'warning'
  message: string
  ids: string[]
}

const bad = (v: number, min: number, strict: boolean) => !Number.isFinite(v) || (strict ? v <= min : v < min)

export function validate(model: Model): Issue[] {
  const issues: Issue[] = []
  const ms = masses(model)
  const ids = new Set(model.bodies.map(b => b.id))
  if (ms.length === 0) issues.push({ level: 'error', message: 'Pridaj aspoň jedno teleso.', ids: [] })

  for (const m of ms) {
    if (bad(m.m, 0, true)) issues.push({ level: 'error', message: `${m.name}: hmotnosť musí byť kladná.`, ids: [m.id] })
    if (bad(m.b, 0, false)) issues.push({ level: 'error', message: `${m.name}: trenie nemôže byť záporné.`, ids: [m.id] })
    if (!Number.isFinite(m.x0) || !Number.isFinite(m.v0))
      issues.push({ level: 'error', message: `${m.name}: neplatná počiatočná podmienka.`, ids: [m.id] })
  }
  for (const l of model.links) {
    if (!ids.has(l.a.body) || !ids.has(l.b.body))
      issues.push({ level: 'error', message: `${l.kName || l.dName}: spoj nie je pripojený.`, ids: [l.id] })
    else if (l.a.body === l.b.body)
      issues.push({ level: 'error', message: `${l.kName || l.dName}: oba konce sú na tom istom prvku.`, ids: [l.id] })
    if (hasSpring(l) && bad(l.k, 0, true)) issues.push({ level: 'error', message: `${l.kName}: tuhosť musí byť kladná.`, ids: [l.id] })
    if (hasDamper(l) && bad(l.d, 0, true)) issues.push({ level: 'error', message: `${l.dName}: tlmenie musí byť kladné.`, ids: [l.id] })
  }
  for (const f of model.forces) {
    if (!ms.some(m => m.id === f.body)) issues.push({ level: 'error', message: `${f.name}: sila nie je pripojená k telesu.`, ids: [f.id] })
    const s = f.signal
    if (!Number.isFinite(s.amp) || ('t0' in s && !(s.t0 >= 0)) || (s.type === 'sine' && !(s.freq > 0)))
      issues.push({ level: 'error', message: `${f.name}: neplatné parametre sily.`, ids: [f.id] })
  }
  if (!(model.duration > 0 && model.duration <= 600))
    issues.push({ level: 'error', message: 'Trvanie simulácie musí byť medzi 0 a 600 s.', ids: [] })
  if (!(model.dt >= 0.001 && model.dt <= 0.1)) issues.push({ level: 'error', message: 'Krok simulácie musí byť medzi 0,001 a 0,1 s.', ids: [] })

  // Teleso bez pružnej cesty k stene sa môže „odplávať“ (nulové vlastné číslo K).
  const anchored = new Set(model.bodies.filter(b => b.kind === 'wall').map(b => b.id))
  let grown = true
  while (grown) {
    grown = false
    for (const l of model.links) {
      if (!hasSpring(l)) continue
      for (const [p, q] of [[l.a.body, l.b.body], [l.b.body, l.a.body]])
        if (anchored.has(p) && !anchored.has(q)) {
          anchored.add(q)
          grown = true
        }
    }
  }
  for (const m of ms)
    if (!anchored.has(m.id))
      issues.push({ level: 'warning', message: `${m.name} nie je pružinou spojené so stenou – nemá pevnú rovnovážnu polohu.`, ids: [m.id] })
  return issues
}
