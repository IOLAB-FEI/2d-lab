import { computed, watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useModelStore } from '../stores/model'
import { simulate, sampleIndex, type SimResult } from '../core/simulate'
import { validate } from '../core/validate'
import { firstOverlap } from '../core/geometry'
import type { Model } from '../core/model'

export const SERIES_COLORS = ['#534AB7', '#D85A30', '#1D9E75', '#BA7517', '#D4537E', '#185FA5', '#639922', '#888780']

let shared: ReturnType<typeof create> | null = null

function create() {
  const store = useModelStore()
  const { model, time } = storeToRefs(store)

  // JSON kópia: computed sleduje celý model a simulácia beží nad obyčajnými dátami.
  const plain = computed<Model>(() => JSON.parse(JSON.stringify(model.value)))
  const issues = computed(() => validate(plain.value))
  const hasErrors = computed(() => issues.value.some(i => i.level === 'error'))
  const result = computed<SimResult | null>(() => {
    if (hasErrors.value) return null
    try {
      return simulate(plain.value)
    } catch {
      return null
    }
  })
  const overlap = computed(() => (result.value ? firstOverlap(plain.value, result.value) : null))
  const sample = computed(() => (result.value ? sampleIndex(result.value, time.value) : 0))
  const colorOf = (massId: string) => {
    const i = plain.value.bodies.filter(b => b.kind === 'mass').findIndex(b => b.id === massId)
    return SERIES_COLORS[Math.max(0, i) % SERIES_COLORS.length]
  }
  /** posunutie telesa v aktuálnom čase [m] */
  const displacement = (massId: string) => {
    const r = result.value
    if (!r) return 0
    const i = r.massIds.indexOf(massId)
    return i < 0 ? 0 : r.x[i][sample.value]
  }
  return { issues, hasErrors, result, overlap, sample, colorOf, displacement }
}

export function useSimulation() {
  return (shared ??= create())
}

/** Prehrávanie: posúva čas podľa rýchlosti, na konci zastaví. */
export function usePlayback() {
  const store = useModelStore()
  let raf = 0
  let last = 0
  const tick = (now: number) => {
    if (!store.playing) return
    const next = store.time + ((now - last) / 1000) * store.speed
    last = now
    if (next >= store.model.duration) {
      store.time = store.model.duration
      store.playing = false
      return
    }
    store.time = next
    raf = requestAnimationFrame(tick)
  }
  watch(
    () => store.playing,
    p => {
      cancelAnimationFrame(raf)
      if (p) {
        if (store.time >= store.model.duration) store.time = 0
        store.mode = 'sim'
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    },
  )
  watch(
    () => store.model.duration,
    d => {
      if (store.time > d) store.time = d
    },
  )
  onBeforeUnmount(() => cancelAnimationFrame(raf))
}
