import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { type Model, type LinkKind, emptyModel } from '../core/model'
import { twoCarts } from '../core/examples'
import { setAxis } from '../core/geometry'

const AUTOSAVE_KEY = 'mechsim:autosave'
const OLD_AUTOSAVE_KEY = 'mmodels:autosave'
const clone = (m: Model): Model => JSON.parse(JSON.stringify(m))

export function parseModel(text: string): Model {
  const m = JSON.parse(text)
  if (m?.version !== 1 || !Array.isArray(m.bodies) || !Array.isArray(m.links) || !Array.isArray(m.forces))
    throw new Error('Súbor nie je model MechSim (verzia 1).')
  return { ...emptyModel(), ...m }
}

function initialModel(): Model {
  const hash = location.hash.match(/^#m=(.+)$/)
  if (hash) {
    try {
      return parseModel(decompressFromEncodedURIComponent(hash[1]) ?? '')
    } catch {
      /* neplatný odkaz – pokračuj autosave */
    }
  }
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY) ?? localStorage.getItem(OLD_AUTOSAVE_KEY)
    if (saved) return parseModel(saved)
  } catch {
    /* localStorage nedostupný */
  }
  return twoCarts()
}

export const useModelStore = defineStore('model', () => {
  const model = ref<Model>(initialModel())
  const past = ref<string[]>([])
  const future = ref<string[]>([])

  const mode = ref<'design' | 'sim'>('design')
  const selection = ref<string | null>(null)
  const time = ref(0)
  const playing = ref(false)
  const speed = ref(1)
  const linkKind = ref<LinkKind>('spring')
  const numericEquations = ref(false)
  const showVelocity = ref(false)
  const message = ref('')
  /** zvýši sa, keď má plátno prispôsobiť zobrazenie (nový model, otočenie) */
  const fitRequest = ref(0)

  /** Uloží aktuálny stav do histórie – volať pred zmenou (alebo na začiatku ťahania). */
  function checkpoint() {
    const snap = JSON.stringify(model.value)
    if (past.value[past.value.length - 1] === snap) return
    past.value.push(snap)
    if (past.value.length > 200) past.value.shift()
    future.value = []
  }

  function transact(fn: (m: Model) => void) {
    checkpoint()
    fn(model.value)
  }

  function restore(snap: string) {
    model.value = JSON.parse(snap)
    if (selection.value && !findAny(selection.value)) selection.value = null
  }

  function undo() {
    const snap = past.value.pop()
    if (!snap) return
    future.value.push(JSON.stringify(model.value))
    restore(snap)
  }

  function redo() {
    const snap = future.value.pop()
    if (!snap) return
    past.value.push(JSON.stringify(model.value))
    restore(snap)
  }

  function load(m: Model) {
    checkpoint()
    model.value = clone(m)
    selection.value = null
    time.value = 0
    playing.value = false
    mode.value = 'design'
    fitRequest.value++
  }

  function changeAxis(axis: Model['axis']) {
    transact(m => setAxis(m, axis))
    time.value = 0
    fitRequest.value++
  }

  function findAny(id: string) {
    const m = model.value
    return m.bodies.find(b => b.id === id) ?? m.links.find(l => l.id === id) ?? m.forces.find(f => f.id === id)
  }

  function remove(id: string) {
    transact(m => {
      m.bodies = m.bodies.filter(b => b.id !== id)
      m.links = m.links.filter(l => l.id !== id && l.a.body !== id && l.b.body !== id)
      m.forces = m.forces.filter(f => f.id !== id && f.body !== id)
    })
    if (selection.value === id) selection.value = null
  }

  const selected = computed(() => (selection.value ? findAny(selection.value) ?? null : null))

  function shareUrl(): string {
    const url = new URL(location.href)
    url.hash = 'm=' + compressToEncodedURIComponent(JSON.stringify(model.value))
    return url.toString()
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    model,
    () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        try {
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(model.value))
        } catch {
          /* bez autosave */
        }
      }, 300)
    },
    { deep: true },
  )

  return {
    model, past, future, mode, selection, selected, time, playing, speed, linkKind, numericEquations, showVelocity, message, fitRequest,
    checkpoint, transact, undo, redo, load, changeAxis, remove, findAny, shareUrl,
  }
})
