<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useModelStore } from '../stores/model'
import { useSimulation } from '../composables/useSimulation'
import { masses } from '../core/model'

const store = useModelStore()
const sim = useSimulation()
const plot = ref<HTMLDivElement>()
const width = ref(800)
const height = ref(200)
const pad = { l: 52, r: 14, t: 18, b: 24 }

let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => {
    width.value = e.contentRect.width
    height.value = Math.max(120, e.contentRect.height)
  })
  ro.observe(plot.value!)
})
onBeforeUnmount(() => ro?.disconnect())

const series = computed(() => {
  const r = sim.result.value
  if (!r) return []
  const ms = masses(store.model)
  const out = r.massIds.flatMap((id, i) => {
    const name = ms.find(m => m.id === id)?.name ?? id
    const color = sim.colorOf(id)
    const s = [{ key: id + 'x', label: `x${i + 1} (${name})`, unit: 'm', color, data: r.x[i], dashed: false }]
    if (store.showVelocity) s.push({ key: id + 'v', label: `v${i + 1} (${name})`, unit: 'm/s', color, data: r.v[i], dashed: true })
    return s
  })
  return out
})

const yRange = computed(() => {
  let lo = 0, hi = 0
  for (const s of series.value) for (const v of s.data) (lo = Math.min(lo, v)), (hi = Math.max(hi, v))
  if (hi - lo < 1e-9) (lo -= 1), (hi += 1)
  const m = (hi - lo) * 0.08
  return [lo - m, hi + m] as const
})

const X = (t: number) => pad.l + (t / store.model.duration) * (width.value - pad.l - pad.r)
const Y = (v: number) => pad.t + ((yRange.value[1] - v) / (yRange.value[1] - yRange.value[0])) * (height.value - pad.t - pad.b)

function path(data: Float64Array, upto?: number): string {
  const r = sim.result.value!
  const n = upto ?? data.length - 1
  const step = Math.max(1, Math.ceil(data.length / 900))
  let d = ''
  for (let k = 0; k <= n; k += step) d += (k ? 'L' : 'M') + X(r.t[k]).toFixed(1) + ' ' + Y(data[k]).toFixed(1)
  if (n % step) d += 'L' + X(r.t[n]).toFixed(1) + ' ' + Y(data[n]).toFixed(1)
  return d
}

const full = computed(() => series.value.map(s => ({ ...s, d: path(s.data) })))
const past = computed(() => series.value.map(s => ({ ...s, d: path(s.data, sim.sample.value) })))

function ticks(lo: number, hi: number, n = 5) {
  const raw = (hi - lo) / n
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map(f => f * mag).find(s => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-12; v += step) out.push(Number(v.toPrecision(10)))
  return out
}
const xTicks = computed(() => ticks(0, store.model.duration, 8))
const yTicks = computed(() => ticks(yRange.value[0], yRange.value[1], 4))

const cursorX = computed(() => X(store.time))
const values = computed(() => series.value.map(s => ({ ...s, value: s.data[sim.sample.value] })))

let seeking = false
function seek(e: PointerEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  const t = ((e.clientX - rect.left - pad.l) / (rect.width - pad.l - pad.r)) * store.model.duration
  store.time = Math.min(store.model.duration, Math.max(0, t))
  store.mode = 'sim'
}
function down(e: PointerEvent) {
  seeking = true
  store.playing = false
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  seek(e)
}
const move = (e: PointerEvent) => seeking && seek(e)
</script>

<template>
  <div class="graph">
    <div class="legend">
      <span v-for="s in values" :key="s.key" class="item">
        <span class="swatch" :style="{ borderColor: s.color, borderStyle: s.dashed ? 'dashed' : 'solid' }" />
        {{ s.label }} = <b>{{ s.value.toFixed(3) }}</b> {{ s.unit }}
      </span>
      <v-spacer />
      <v-checkbox v-model="store.showVelocity" label="Rýchlosti" density="compact" hide-details class="flex-grow-0" />
    </div>
    <div ref="plot" class="plot">
    <svg :width="width" :height="height" @pointerdown="down" @pointermove="move" @pointerup="seeking = false">
      <g class="axis">
        <line v-for="t in xTicks" :key="'x' + t" :x1="X(t)" :x2="X(t)" :y1="pad.t" :y2="height - pad.b" class="gridline" />
        <line v-for="v in yTicks" :key="'y' + v" :x1="pad.l" :x2="width - pad.r" :y1="Y(v)" :y2="Y(v)" class="gridline" :class="{ zero: v === 0 }" />
        <text v-for="t in xTicks" :key="'xt' + t" :x="X(t)" :y="height - 10" text-anchor="middle">{{ t }}</text>
        <text v-for="v in yTicks" :key="'yt' + v" :x="pad.l - 6" :y="Y(v) + 4" text-anchor="end">{{ v }}</text>
        <text :x="width - pad.r - 2" :y="height - pad.b - 5" text-anchor="end" class="unit">t [s]</text>
        <text :x="4" :y="pad.t - 6" class="unit">{{ store.showVelocity ? 'x [m], v [m/s]' : 'x [m]' }}</text>
      </g>
      <path v-for="s in full" :key="'f' + s.key" :d="s.d" :stroke="s.color" :stroke-dasharray="s.dashed ? '5 4' : undefined" class="future" />
      <path v-for="s in past" :key="'p' + s.key" :d="s.d" :stroke="s.color" :stroke-dasharray="s.dashed ? '5 4' : undefined" class="past" />
      <line :x1="cursorX" :x2="cursorX" :y1="pad.t - 4" :y2="height - pad.b" class="cursor" />
      <text :x="cursorX + 4" :y="pad.t + 8" class="cursor-label">t = {{ store.time.toFixed(2) }} s</text>
      <circle v-for="s in values" :key="'c' + s.key" :cx="cursorX" :cy="Y(s.value)" r="3.5" :fill="s.color" />
    </svg>
    </div>
    <div v-if="!sim.result.value" class="empty text-body-2 text-medium-emphasis">Graf sa zobrazí, keď je systém platný.</div>
  </div>
</template>

<style scoped>
.graph {
  position: relative;
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.plot {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.axis .unit {
  opacity: 1;
  font-weight: 500;
}
svg {
  display: block;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  font-size: 13px;
  min-height: 40px;
}
.swatch {
  display: inline-block;
  width: 18px;
  border-top-width: 3px;
  vertical-align: middle;
  margin-right: 4px;
}
.axis text {
  font-size: 11px;
  fill: currentColor;
  opacity: 0.7;
}
.gridline {
  stroke: currentColor;
  stroke-opacity: 0.08;
}
.gridline.zero {
  stroke-opacity: 0.3;
}
path {
  fill: none;
  stroke-width: 2;
}
.future {
  opacity: 0.22;
}
.cursor {
  stroke: currentColor;
  stroke-width: 1.5;
}
.cursor-label {
  font-size: 12px;
  fill: currentColor;
}
.empty {
  position: absolute;
  inset: 40px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
