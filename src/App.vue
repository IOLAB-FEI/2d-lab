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

const snackbar = computed({
  get: () => !!store.message,
  set: v => !v && (store.message = ''),
})
</script>

<template>
  <v-app>
    <AppToolbar />
    <v-main>
      <div class="layout" :class="{ stage: store.fullscreen }">
        <v-sheet border class="palette"><PalettePanel @start="startPalette" /></v-sheet>
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
.layout {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) 290px;
  grid-template-rows: minmax(200px, 1fr) auto minmax(170px, 27vh);
  grid-template-areas:
    'palette canvas props'
    'palette equations props'
    'palette graph props';
  gap: 8px;
  padding: 8px;
  height: calc(100dvh - var(--v-layout-top, 48px));
}
.layout > * {
  border-radius: 8px;
  overflow: hidden;
  min-height: 0;
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
  max-height: 22vh;
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
  .layout {
    height: auto;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 55dvh auto 300px auto;
    grid-template-areas: 'palette' 'canvas' 'equations' 'graph' 'props';
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
  grid-template-rows: minmax(0, 1fr) auto minmax(170px, 30vh);
  grid-template-areas: 'canvas' 'equations' 'graph';
}
.layout.stage > .palette,
.layout.stage > .props {
  display: none;
}
.layout.stage > .equations {
  max-height: 20vh;
}
@media (max-width: 959px) {
  .layout.stage {
    grid-template-rows: minmax(0, 1fr) auto 360px;
  }
  .layout.stage > .equations {
    max-height: 16vh;
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

