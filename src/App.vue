<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useModelStore } from './stores/model'
import { usePlayback } from './composables/useSimulation'
import AppToolbar from './components/AppToolbar.vue'
import PalettePanel from './components/PalettePanel.vue'
import EditorCanvas, { type PaletteKind } from './components/EditorCanvas.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import EquationsPanel from './components/EquationsPanel.vue'
import TimeGraph from './components/TimeGraph.vue'
import PlaybackBar from './components/PlaybackBar.vue'

const store = useModelStore()
usePlayback()
const canvas = ref<InstanceType<typeof EditorCanvas>>()

// „Duch“ prvku pri ťahaní z palety.
const ghost = reactive<{ kind: PaletteKind | null; x: number; y: number }>({ kind: null, x: 0, y: 0 })
const ghostIcon = computed(
  () =>
    ({ wall: 'mdi-wall', mass: 'mdi-square-rounded-outline', spring: 'mdi-sine-wave', damper: 'mdi-arrow-collapse-horizontal', springDamper: 'mdi-view-parallel-outline', force: 'mdi-arrow-right-bold-outline' })[ghost.kind ?? 'mass'],
)

function startPalette(kind: PaletteKind, e: PointerEvent) {
  Object.assign(ghost, { kind, x: e.clientX, y: e.clientY })
  const move = (ev: PointerEvent) => Object.assign(ghost, { x: ev.clientX, y: ev.clientY })
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    canvas.value?.drop(kind, ev.clientX, ev.clientY)
    ghost.kind = null
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function onKey(e: KeyboardEvent) {
  const t = e.target as Element | null
  if ((t as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return
  const ctrl = e.ctrlKey || e.metaKey
  if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) (store.undo(), e.preventDefault())
  else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) (store.redo(), e.preventDefault())
  else if ((e.key === 'Delete' || e.key === 'Backspace') && store.selection && store.mode === 'design') store.remove(store.selection)
  else if (e.key === 'Escape') store.fullscreen ? (store.fullscreen = false) : (store.selection = null)
  else if (e.key === ' ') (store.playing = !store.playing, e.preventDefault())
  else if (e.key.toLowerCase() === 'f' && !ctrl && !e.altKey) store.fullscreen = !store.fullscreen
}

// Celá obrazovka: rozloženie sa prepne cez CSS triedu (funguje všade) a navyše sa požiada
// prehliadač o skutočný fullscreen celej stránky (iPhone ho nepovolí – ostane len okno).
watch(
  () => store.fullscreen,
  on => {
    if (on) {
      store.mode = 'sim'
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
    } else if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    nextTick(() => store.fitRequest++)
  },
)
function onFullscreenChange() {
  if (!document.fullscreenElement) store.fullscreen = false
  store.fitRequest++
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})

// Rozdeľovače panelov: šírky bočných panelov a výšky rovníc a grafu (null = predvolená veľkosť).
type Sizes = { palette: number | null; props: number | null; equations: number | null; graph: number | null }
type Splitter = 'palette' | 'props' | 'top' | 'bottom'
const LAYOUT_KEY = 'mechsim:layout'
const layout = ref<HTMLElement>()
const sizes = reactive<Sizes>({ palette: null, props: null, equations: null, graph: null })
try {
  Object.assign(sizes, JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}'))
} catch {
  /* bez uloženého rozloženia */
}
watch(sizes, () => {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(sizes))
  } catch {
    /* bez ukladania */
  }
})
const layoutVars = computed(() => {
  const v: Record<string, string> = {}
  if (sizes.palette != null) v['--palette-w'] = sizes.palette + 'px'
  if (sizes.props != null) v['--props-w'] = sizes.props + 'px'
  if (sizes.equations != null) Object.assign(v, { '--equations-h': sizes.equations + 'px', '--equations-max': 'none' })
  if (sizes.graph != null) v['--graph-h'] = sizes.graph + 'px'
  return v
})

const MIN = { palette: 110, props: 220, equations: 40, graph: 140, canvas: 160 }
function startSplit(which: Splitter, e: PointerEvent) {
  const root = layout.value
  if (!root || e.button !== 0) return
  e.preventDefault()
  const box = (cls: string) => root.querySelector<HTMLElement>('.' + cls)?.getBoundingClientRect()
  const total = root.getBoundingClientRect()
  const start = {
    x: e.clientX,
    y: e.clientY,
    palette: box('palette')?.width ?? 0,
    props: box('props')?.width ?? 0,
    equations: box('equations')?.height ?? 0,
    graph: box('graph')?.height ?? 0,
  }
  // Priestor, ktorý ostane pre plátno, nesmie klesnúť pod minimum.
  const freeW = total.width - 32 - MIN.canvas
  const freeH = total.height - 32 - MIN.canvas
  const clamp = (v: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, v)))
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - start.x
    const dy = ev.clientY - start.y
    if (which === 'palette') sizes.palette = clamp(start.palette + dx, MIN.palette, Math.min(360, freeW - start.props))
    else if (which === 'props') sizes.props = clamp(start.props - dx, MIN.props, Math.min(600, freeW - start.palette))
    else if (which === 'top') {
      sizes.equations = clamp(start.equations - dy, MIN.equations, freeH - start.graph)
      sizes.graph = Math.round(start.graph)
    } else {
      const both = start.equations + start.graph
      sizes.equations = clamp(start.equations + dy, MIN.equations, both - MIN.graph)
      sizes.graph = Math.round(both - sizes.equations)
    }
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    document.body.classList.remove('splitting')
  }
  document.body.classList.add('splitting')
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
/** Dvojklik vráti panel(y) pri rozdeľovači na predvolenú veľkosť. */
function resetSplit(which: Splitter) {
  if (which === 'palette' || which === 'props') sizes[which] = null
  else Object.assign(sizes, { equations: null, graph: null })
}

const snackbar = computed({
  get: () => !!store.message,
  set: v => !v && (store.message = ''),
})
</script>

<template>
  <v-app>
    <AppToolbar />
    <v-main>
      <div ref="layout" class="layout" :class="{ stage: store.fullscreen }" :style="layoutVars">
        <v-sheet border class="palette"><PalettePanel @start="startPalette" /></v-sheet>
        <div
          v-for="s in ['palette', 'props', 'top', 'bottom'] as const"
          :key="s"
          class="splitter"
          :class="`split-${s}`"
          title="Ťahaním zmeníš veľkosť, dvojklikom vrátiš pôvodnú"
          @pointerdown="startSplit(s, $event)"
          @dblclick="resetSplit(s)"
        />
        <v-sheet border class="canvas"><EditorCanvas ref="canvas" /></v-sheet>
        <v-sheet border class="props"><PropertiesPanel /></v-sheet>
        <v-sheet border class="equations"><EquationsPanel /></v-sheet>
        <v-sheet border class="graph">
          <TimeGraph />
          <PlaybackBar />
        </v-sheet>
      </div>
    </v-main>
    <div v-if="ghost.kind" class="ghost" :style="{ left: ghost.x + 'px', top: ghost.y + 'px' }">
      <v-icon :icon="ghostIcon" size="28" />
    </div>
    <v-snackbar v-model="snackbar" timeout="3500">{{ store.message }}</v-snackbar>
  </v-app>
</template>

<style>
/* Desktop: aplikácia vyplní presne výšku okna, posúvajú sa len bočné panely. */
html,
body {
  overflow: hidden !important;
}
/* Medzi panelmi sú 8 px pruhy s rozdeľovačmi; veľkosti nastavené ťahaním prídu cez CSS premenné. */
.layout {
  display: grid;
  grid-template-columns: var(--palette-w, 160px) 8px minmax(0, 1fr) 8px var(--props-w, 290px);
  grid-template-rows: minmax(120px, 1fr) 8px var(--equations-h, auto) 8px var(--graph-h, minmax(170px, 27vh));
  grid-template-areas:
    'palette split-palette canvas split-props props'
    'palette split-palette split-top split-props props'
    'palette split-palette equations split-props props'
    'palette split-palette split-bottom split-props props'
    'palette split-palette graph split-props props';
  padding: 8px;
  height: calc(100dvh - var(--v-layout-top, 48px));
}
.layout > * {
  border-radius: 8px;
  overflow: hidden;
  min-height: 0;
}
.splitter {
  position: relative;
  touch-action: none;
  user-select: none;
}
.split-palette,
.split-props {
  cursor: col-resize;
}
.split-top,
.split-bottom {
  cursor: row-resize;
}
.split-palette { grid-area: split-palette; }
.split-props { grid-area: split-props; }
.split-top { grid-area: split-top; }
.split-bottom { grid-area: split-bottom; }
/* Úchyt: v pokoji krátka bledá čiarka, pri prejdení myšou celá dĺžka vo farbe aplikácie. */
.splitter::after {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.2);
  transition: background-color 0.15s;
}
.split-palette::after,
.split-props::after {
  width: 3px;
  height: 32px;
}
.split-top::after,
.split-bottom::after {
  width: 32px;
  height: 3px;
}
.splitter:hover::after,
.splitter:active::after {
  background: rgb(var(--v-theme-primary));
}
.split-palette:hover::after,
.split-props:hover::after,
.split-palette:active::after,
.split-props:active::after {
  height: 100%;
}
.split-top:hover::after,
.split-bottom:hover::after,
.split-top:active::after,
.split-bottom:active::after {
  width: 100%;
}
/* Počas ťahania drž kurzor a nevyberaj text. */
body.splitting {
  user-select: none;
}
body.splitting * {
  cursor: inherit !important;
}
.palette {
  grid-area: palette;
  overflow-y: auto;
}
.canvas {
  grid-area: canvas;
}
.props {
  grid-area: props;
  overflow-y: auto;
}
.equations {
  grid-area: equations;
  max-height: var(--equations-max, 22vh);
  overflow-y: auto;
}
.graph {
  grid-area: graph;
  display: flex;
  flex-direction: column;
}
.graph > :first-child {
  flex: 1;
  min-height: 0;
}
/* Tablet a mobil: panely pod sebou, stránka sa posúva. */
@media (max-width: 959px) {
  html,
  body {
    overflow-y: auto !important;
  }
  /* Panely pod sebou majú pevné výšky, rozdeľovače tu nie sú. */
  .layout {
    height: auto;
    gap: 8px;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 55dvh auto 300px auto;
    grid-template-areas: 'palette' 'canvas' 'equations' 'graph' 'props';
  }
  .layout > .splitter {
    display: none;
  }
  .equations {
    max-height: none;
  }
}
/* Celá obrazovka: len plátno, rovnice a graf s prehrávačom – prekryje aj hornú lištu. */
.layout.stage {
  position: fixed;
  inset: 0;
  z-index: 1010;
  height: 100dvh;
  background: rgb(var(--v-theme-background));
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) 8px var(--equations-h, auto) 8px var(--graph-h, minmax(170px, 30vh));
  grid-template-areas: 'canvas' 'split-top' 'equations' 'split-bottom' 'graph';
}
.layout.stage > .palette,
.layout.stage > .props,
.layout.stage > .split-palette,
.layout.stage > .split-props {
  display: none;
}
.layout.stage > .equations {
  max-height: var(--equations-max, 20vh);
}
@media (max-width: 959px) {
  .layout.stage {
    gap: 0;
    grid-template-rows: minmax(0, 1fr) 8px var(--equations-h, auto) 8px var(--graph-h, 360px);
  }
  .layout.stage > .split-top,
  .layout.stage > .split-bottom {
    display: block;
  }
  .layout.stage > .equations {
    max-height: var(--equations-max, 16vh);
  }
}
.ghost {
  position: fixed;
  pointer-events: none;
  transform: translate(-50%, -50%);
  opacity: 0.8;
  z-index: 10000;
}
</style>

