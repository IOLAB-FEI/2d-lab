<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useModelStore } from '../stores/model'
import { useSimulation } from '../composables/useSimulation'
import { type Body, type Layout, type Port, type MassBody, newId, nextName, forceValue, masses } from '../core/model'
import { type Point, displaced, portPoint, linkEnds, linkOffsets, bounds } from '../core/geometry'
import { COLORS } from '../core/equations'
import { springPath, damperPaths, springDamperPaths, arrowPath } from './shapes/paths'

export type PaletteKind = 'wall' | 'mass' | 'spring' | 'damper' | 'springDamper' | 'force'

const store = useModelStore()
const sim = useSimulation()
const svg = ref<SVGSVGElement>()
const wrap = ref<HTMLDivElement>()
const size = reactive({ w: 800, h: 380 })
const view = reactive({ x: 0, y: 0, k: 1 })
const viewBox = computed(() => `${view.x} ${view.y} ${size.w / view.k} ${size.h / view.k}`)
const isSim = computed(() => store.mode === 'sim')
const model = computed(() => store.model)

const touch = matchMedia('(pointer: coarse)').matches
let ro: ResizeObserver | undefined
/** kým používateľ sám neposunie/nezoomuje, zobrazenie sa prispôsobuje veľkosti plátna */
let userView = false
onMounted(() => {
  ro = new ResizeObserver(([e]) => {
    size.w = e.contentRect.width
    size.h = e.contentRect.height
    if (!userView) fit()
  })
  ro.observe(wrap.value!)
})
onBeforeUnmount(() => ro?.disconnect())

/** Zastaví prehrávanie a vráti telesá do počiatočnej polohy x₀. */
function resetPosition() {
  store.playing = false
  store.time = 0
}

/** Zobrazí celý systém – s rezervou na pohyb telies a popisy. */
function fit() {
  userView = false
  const b = bounds(model.value)
  if (!b || !size.w || !size.h) return
  const margin = 70
  const k = Math.min(1.5, Math.max(0.3, Math.min(size.w / (b.w + 2 * margin), size.h / (b.h + 2 * margin))))
  view.k = k
  view.x = b.x + b.w / 2 - size.w / k / 2
  view.y = b.y + b.h / 2 - size.h / k / 2
}
watch(
  () => store.fitRequest,
  () => nextTick(fit),
)
function zoom(f: number) {
  userView = true
  const c = { x: view.x + size.w / view.k / 2, y: view.y + size.h / view.k / 2 }
  const k = Math.min(3, Math.max(0.3, view.k * f))
  view.x = c.x - size.w / k / 2
  view.y = c.y - size.h / k / 2
  view.k = k
}

const snap = (v: number) => Math.round(v / 10) * 10

function toWorld(e: { clientX: number; clientY: number }): Point {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.value!.getScreenCTM()!.inverse())
  return { x: p.x, y: p.y }
}

function layoutOf(b: Body): Layout {
  return isSim.value && b.kind === 'mass' ? displaced(model.value, b.layout, sim.displacement(b.id)) : b.layout
}

const offsets = computed(() => linkOffsets(model.value))

function rectOf(b: Body) {
  const l = layoutOf(b)
  return { x: l.x, y: l.y, width: l.w, height: l.h }
}

const links = computed(() =>
  model.value.links.flatMap(l => {
    const ends = linkEnds(model.value, l, layoutOf, offsets.value.get(l.id) ?? 0)
    if (!ends) return []
    const [p, q] = ends
    return [{ link: l, p, q, spring: springPath(p, q), damper: damperPaths(p, q), both: springDamperPaths(p, q) }]
  }),
)

const ports = computed(() =>
  isSim.value
    ? []
    : model.value.bodies.flatMap(b => (['a', 'b'] as const).map(side => ({ body: b.id, side, p: portPoint(model.value, b.layout, side) }))),
)

const forces = computed(() =>
  model.value.forces.flatMap(f => {
    const b = model.value.bodies.find(x => x.id === f.body)
    if (!b) return []
    const l = layoutOf(b)
    const amp = Math.abs(f.signal.amp) || 1
    const value = isSim.value ? forceValue(f.signal, store.time) : f.signal.amp
    const len = (Math.max(-1, Math.min(1, value / amp)) || 0) * 34
    const horizontal = model.value.axis === 'horizontal'
    const c: Point = horizontal ? { x: l.x + l.w / 2, y: l.y - 16 } : { x: l.x + l.w + 18, y: l.y + l.h / 2 }
    const from = horizontal ? { x: c.x - len, y: c.y } : { x: c.x, y: c.y - len }
    const to = horizontal ? { x: c.x + len, y: c.y } : { x: c.x, y: c.y + len }
    return [{ force: f, path: arrowPath(from, to), label: horizontal ? { x: c.x, y: c.y - 8 } : { x: c.x + 8, y: c.y + 4 }, anchor: horizontal ? 'middle' : 'start' }]
  }),
)

function massLabel(b: MassBody) {
  const i = masses(model.value).findIndex(m => m.id === b.id)
  return `x${'₀₁₂₃₄₅₆₇₈₉'[i + 1] ?? i + 1} = ${sim.displacement(b.id).toFixed(3)} m`
}

// ---- interakcia ---------------------------------------------------------------
type Drag =
  | { type: 'move'; id: string; start: Point; orig: Layout; moved: boolean }
  | { type: 'x0'; id: string; start: Point; orig: number; moved: boolean }
  | { type: 'connect'; from: Port; p: Point; cursor: Point }
  | { type: 'pan'; start: Point; orig: Point }
const drag = ref<Drag | null>(null)

const connectTarget = computed(() => {
  const d = drag.value
  if (d?.type !== 'connect') return null
  return nearestPort(d.cursor, d.from.body)
})

function nearestPort(p: Point, exclude: string, radius = 22 / view.k) {
  let best: (typeof ports.value)[number] | null = null
  let dist = radius
  for (const port of ports.value) {
    if (port.body === exclude) continue
    const d = Math.hypot(port.p.x - p.x, port.p.y - p.y)
    if (d < dist) [best, dist] = [port, d]
  }
  return best
}

function bodyOf(id: string) {
  return model.value.bodies.find(b => b.id === id)
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  const el = (e.target as Element).closest('[data-port],[data-body],[data-link],[data-force]') as HTMLElement | null
  const p = toWorld(e)
  svg.value!.setPointerCapture(e.pointerId)
  if (el?.dataset.port && !isSim.value) {
    const [body, side] = el.dataset.port.split(':') as [string, 'a' | 'b']
    drag.value = { type: 'connect', from: { body, side }, p: portPoint(model.value, bodyOf(body)!.layout, side), cursor: p }
  } else if (el?.dataset.body) {
    const b = bodyOf(el.dataset.body)!
    store.selection = b.id
    if (!isSim.value) drag.value = { type: 'move', id: b.id, start: p, orig: { ...b.layout }, moved: false }
    else if (b.kind === 'mass') {
      store.playing = false
      drag.value = { type: 'x0', id: b.id, start: p, orig: b.x0, moved: false }
    }
  } else if (el?.dataset.link || el?.dataset.force) {
    store.selection = (el.dataset.link ?? el.dataset.force)!
  } else {
    store.selection = null
    drag.value = { type: 'pan', start: { x: e.clientX, y: e.clientY }, orig: { x: view.x, y: view.y } }
  }
}

function onPointerMove(e: PointerEvent) {
  const d = drag.value
  if (!d) return
  if (d.type === 'pan') {
    userView = true
    view.x = d.orig.x - (e.clientX - d.start.x) / view.k
    view.y = d.orig.y - (e.clientY - d.start.y) / view.k
    return
  }
  const p = toWorld(e)
  if (d.type === 'connect') d.cursor = p
  else if (d.type === 'move') {
    const b = bodyOf(d.id)
    if (!b) return
    const x = snap(d.orig.x + p.x - d.start.x)
    const y = snap(d.orig.y + p.y - d.start.y)
    if (!d.moved && x === d.orig.x && y === d.orig.y) return
    if (!d.moved) store.checkpoint()
    d.moved = true
    b.layout.x = x
    b.layout.y = y
  } else if (d.type === 'x0') {
    const b = bodyOf(d.id)
    if (b?.kind !== 'mass') return
    if (!d.moved) store.checkpoint()
    d.moved = true
    const delta = model.value.axis === 'horizontal' ? p.x - d.start.x : p.y - d.start.y
    b.x0 = Math.round((d.orig + delta / model.value.scale) * 1000) / 1000
    store.time = 0
  }
}

function onPointerUp() {
  const d = drag.value
  drag.value = null
  if (d?.type !== 'connect') return
  const target = nearestPort(d.cursor, d.from.body)
  if (!target) return
  addLink(d.from, { body: target.body, side: target.side })
}

function addLink(a: Port, b: Port, kind = store.linkKind) {
  const id = newId('l')
  store.transact(m => {
    const kName = nextName(m, 'k')
    const dName = nextName(m, 'd')
    m.links.push({ id, kind, a, b, kName, k: 10, dName, d: 1 })
  })
  store.selection = id
}

function onWheel(e: WheelEvent) {
  userView = true
  const p = toWorld(e)
  const k = Math.min(3, Math.max(0.3, view.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
  view.x = p.x - ((p.x - view.x) * view.k) / k
  view.y = p.y - ((p.y - view.y) * view.k) / k
  view.k = k
}

/** Pustenie prvku z palety. Vráti false, ak bod nie je nad plátnom. */
function drop(kind: PaletteKind, clientX: number, clientY: number): boolean {
  const r = svg.value!.getBoundingClientRect()
  if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return false
  const p = toWorld({ clientX, clientY })
  const horizontal = model.value.axis === 'horizontal'
  if (kind === 'mass' || kind === 'wall') {
    const [w, h] = kind === 'mass' ? [80, 60] : horizontal ? [20, 120] : [160, 20]
    const id = newId(kind === 'mass' ? 'm' : 'w')
    const layout = { x: snap(p.x - w / 2), y: snap(p.y - h / 2), w, h }
    store.transact(m => {
      if (kind === 'mass') m.bodies.push({ id, kind, name: nextName(m, 'M'), layout, m: 1, x0: 0, v0: 0, b: 0 })
      else m.bodies.push({ id, kind, name: nextName(m, 'S'), layout })
    })
    store.selection = id
    store.mode = 'design'
  } else if (kind === 'force') {
    const b = masses(model.value).find(m => p.x >= m.layout.x - 10 && p.x <= m.layout.x + m.layout.w + 10 && p.y >= m.layout.y - 30 && p.y <= m.layout.y + m.layout.h + 10)
    if (!b) {
      store.message = 'Silu pusti na teleso.'
      return true
    }
    const id = newId('f')
    store.transact(m => m.forces.push({ id, name: nextName(m, 'F'), body: b.id, signal: { type: 'step', amp: 1, t0: 1 } }))
    store.selection = id
  } else {
    const pair = between(p)
    if (!pair) {
      store.message = 'Spoj pusti medzi dve telesá alebo steny (alebo ťahaj z portu na port).'
      return true
    }
    addLink(pair[0], pair[1], kind)
  }
  return true
}

/** Dve najbližšie protiľahlé strany telies okolo bodu (pozdĺž osi systému). */
function between(p: Point): [Port, Port] | null {
  const ax = model.value.axis === 'horizontal' ? 'x' : 'y'
  let before: { port: Port; d: number } | null = null
  let after: { port: Port; d: number } | null = null
  for (const b of model.value.bodies) {
    const pb = portPoint(model.value, b.layout, 'b')
    const pa = portPoint(model.value, b.layout, 'a')
    if (pb[ax] <= p[ax] + 5) {
      const d = Math.hypot(pb.x - p.x, pb.y - p.y)
      if (!before || d < before.d) before = { port: { body: b.id, side: 'b' }, d }
    }
    if (pa[ax] >= p[ax] - 5) {
      const d = Math.hypot(pa.x - p.x, pa.y - p.y)
      if (!after || d < after.d) after = { port: { body: b.id, side: 'a' }, d }
    }
  }
  if (!before || !after || before.port.body === after.port.body) return null
  return [before.port, after.port]
}

defineExpose({ drop })
</script>

<template>
  <div ref="wrap" class="canvas-wrap">
    <div class="overlay top-left">
      <v-btn-toggle
        :model-value="store.model.axis"
        density="compact"
        variant="outlined"
        divided
        mandatory
        :disabled="isSim"
        class="bg-surface"
        @update:model-value="store.changeAxis"
      >
        <v-btn value="horizontal" size="small" prepend-icon="mdi-arrow-left-right" title="Systém sa hýbe vodorovne">
          <span class="hide-xs">Vodorovne</span>
        </v-btn>
        <v-btn value="vertical" size="small" prepend-icon="mdi-arrow-up-down" title="Systém sa hýbe zvislo (otočí kresbu)">
          <span class="hide-xs">Zvislo</span>
        </v-btn>
      </v-btn-toggle>
      <v-chip
        v-if="store.model.axis === 'vertical'"
        :color="store.model.gravity ? 'primary' : undefined"
        :variant="store.model.gravity ? 'flat' : 'outlined'"
        size="small"
        prepend-icon="mdi-earth"
        :disabled="isSim"
        title="Gravitácia g = 9,81 m/s²"
        @click="store.transact(m => (m.gravity = !m.gravity))"
      >
        Gravitácia {{ store.model.gravity ? 'zap.' : 'vyp.' }}
      </v-chip>
      <v-btn
        v-if="isSim"
        size="small"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-restore"
        :disabled="store.time === 0 && !store.playing"
        title="Zastaví simuláciu a vráti telesá do počiatočnej polohy (t = 0 s)"
        @click="resetPosition"
      >
        <span class="hide-xs">Reset polohy</span>
      </v-btn>
    </div>
    <div class="overlay top-right">
      <v-btn icon="mdi-magnify-minus-outline" size="small" variant="tonal" density="comfortable" title="Oddialiť" @click="zoom(1 / 1.2)" />
      <v-btn icon="mdi-magnify-plus-outline" size="small" variant="tonal" density="comfortable" title="Priblížiť" @click="zoom(1.2)" />
      <v-btn icon="mdi-fit-to-screen-outline" size="small" variant="tonal" density="comfortable" title="Zobraziť celý systém" @click="fit" />
      <v-btn
        :icon="store.fullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
        size="small"
        variant="tonal"
        density="comfortable"
        :title="store.fullscreen ? 'Ukončiť celú obrazovku (Esc)' : 'Simulácia na celú obrazovku (F)'"
        @click="store.fullscreen = !store.fullscreen"
      />
    </div>
    <div v-if="!model.bodies.length" class="empty">
      <v-icon icon="mdi-gesture-tap-hold" size="40" class="mb-2" />
      <div>Začni tým, že z palety potiahneš na plátno stenu a teleso.</div>
    </div>
    <div class="overlay bottom-left hint">
      <template v-if="isSim">Potiahni teleso – nastavíš jeho počiatočnú výchylku.</template>
      <template v-else-if="touch">Ťahaj prvky z palety · spoj: z krúžku na krúžok</template>
      <template v-else>Ťahaj prvky z palety · spoj: z krúžku na krúžok · koliesko: zoom</template>
    </div>
    <svg
      ref="svg"
      :viewBox="viewBox"
      :class="{ sim: isSim, connecting: drag?.type === 'connect' }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="drag = null"
      @wheel.prevent="onWheel"
    >
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" stroke-opacity="0.07" />
        </pattern>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#888780" stroke-width="3" />
        </pattern>
      </defs>
      <rect :x="view.x - 4000" :y="view.y - 4000" width="10000" height="10000" fill="url(#grid)" />

      <g v-for="b in model.bodies" :key="b.id" :data-body="b.id" class="body" :class="{ selected: store.selection === b.id }">
        <template v-if="b.kind === 'wall'">
          <rect v-bind="rectOf(b)" fill="url(#hatch)" stroke="#5F5E5A" stroke-width="1.5" />
        </template>
        <template v-else>
          <rect
            v-bind="rectOf(b)"
            rx="6"
            :fill="sim.colorOf(b.id) + '26'"
            :stroke="sim.colorOf(b.id)"
            :stroke-width="store.selection === b.id ? 3 : 1.5"
          />
          <text :x="layoutOf(b).x + layoutOf(b).w / 2" :y="layoutOf(b).y + layoutOf(b).h / 2 + 5" text-anchor="middle" class="label">
            {{ b.name }}
          </text>
          <text v-if="isSim" :x="layoutOf(b).x + layoutOf(b).w / 2" :y="layoutOf(b).y + layoutOf(b).h + 16" text-anchor="middle" class="small">
            {{ massLabel(b) }}
          </text>
        </template>
      </g>

      <g v-for="s in links" :key="s.link.id" :data-link="s.link.id" class="link" :class="{ selected: store.selection === s.link.id }">
        <line :x1="s.p.x" :y1="s.p.y" :x2="s.q.x" :y2="s.q.y" class="hit" />
        <path v-if="s.link.kind === 'spring'" :d="s.spring" :stroke="COLORS.spring" />
        <template v-else-if="s.link.kind === 'damper'">
          <path :d="s.damper.cylinder" :stroke="COLORS.damper" />
          <path :d="s.damper.piston" :stroke="COLORS.damper" />
        </template>
        <template v-else>
          <path :d="s.both.bars" stroke="#5F5E5A" />
          <path :d="s.both.spring" :stroke="COLORS.spring" />
          <path :d="s.both.damper.cylinder" :stroke="COLORS.damper" />
          <path :d="s.both.damper.piston" :stroke="COLORS.damper" />
        </template>
      </g>

      <g v-for="f in forces" :key="f.force.id" :data-force="f.force.id" class="force" :class="{ selected: store.selection === f.force.id }">
        <path :d="f.path" :stroke="COLORS.force" />
        <text :x="f.label.x" :y="f.label.y" :text-anchor="f.anchor" class="small" :fill="COLORS.force">{{ f.force.name }}</text>
      </g>

      <circle
        v-for="pt in ports"
        :key="pt.body + pt.side"
        :data-port="pt.body + ':' + pt.side"
        :cx="pt.p.x"
        :cy="pt.p.y"
        :r="connectTarget?.body === pt.body && connectTarget.side === pt.side ? 8 : 5"
        class="port"
        :class="{ target: connectTarget?.body === pt.body && connectTarget.side === pt.side }"
      />
      <line v-if="drag?.type === 'connect'" :x1="drag.p.x" :y1="drag.p.y" :x2="drag.cursor.x" :y2="drag.cursor.y" class="rubber" />
    </svg>
  </div>
</template>

<style scoped>
.canvas-wrap {
  position: relative;
  height: 100%;
  min-height: 0;
}
.overlay {
  position: absolute;
  z-index: 1;
  display: flex;
  gap: 6px;
  align-items: center;
}
.top-left {
  top: 8px;
  left: 8px;
}
.top-right {
  top: 8px;
  right: 8px;
}
.bottom-left {
  bottom: 6px;
  left: 10px;
  right: 10px;
  pointer-events: none;
}
.hint {
  font-size: 12px;
  opacity: 0.6;
}
.empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  opacity: 0.6;
  pointer-events: none;
}
@media (max-width: 600px) {
  .hide-xs {
    display: none;
  }
}
svg {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.body {
  cursor: move;
}
svg.sim .body {
  cursor: ew-resize;
}
.label {
  font-size: 15px;
  font-weight: 500;
  fill: currentColor;
  pointer-events: none;
}
.small {
  font-size: 12px;
  fill: currentColor;
  pointer-events: none;
}
.link path,
.force path {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
.link.selected path,
.force.selected path {
  stroke-width: 3.5;
}
.link,
.force {
  cursor: pointer;
}
.hit {
  stroke: transparent;
  stroke-width: 18;
}
.link.selected .hit {
  stroke: #fde68a;
  stroke-opacity: 0.5;
}
.port {
  fill: #fff;
  stroke: #185fa5;
  stroke-width: 2;
  opacity: 0.45;
  cursor: crosshair;
}
.port:hover,
svg.connecting .port {
  opacity: 1;
}
.port.target {
  fill: #b5d4f4;
}
.rubber {
  stroke: #185fa5;
  stroke-width: 2;
  stroke-dasharray: 6 4;
  pointer-events: none;
}
.body.selected rect {
  filter: drop-shadow(0 0 3px rgba(24, 95, 165, 0.5));
}
</style>
