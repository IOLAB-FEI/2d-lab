<script setup lang="ts">
import { useModelStore } from '../stores/model'
import { useSimulation } from '../composables/useSimulation'

const store = useModelStore()
const sim = useSimulation()
const speeds = [0.25, 0.5, 1, 2, 4].map(v => ({ value: v, title: `${v}×` }))

function stepBy(frames: number) {
  store.playing = false
  store.mode = 'sim'
  store.time = Math.min(store.model.duration, Math.max(0, store.time + frames * store.model.dt))
}
function restart() {
  store.time = 0
  store.mode = 'sim'
}
function scrub(v: number) {
  store.playing = false
  store.mode = 'sim'
  store.time = v
}
</script>

<template>
  <div class="bar">
    <v-btn icon="mdi-skip-previous" size="small" variant="text" aria-label="Na začiatok" @click="restart" />
    <v-btn icon="mdi-step-backward" size="small" variant="text" aria-label="O snímku späť" @click="stepBy(-5)" />
    <v-btn
      :icon="store.playing ? 'mdi-pause' : 'mdi-play'"
      color="primary"
      size="small"
      :disabled="!sim.result.value"
      :aria-label="store.playing ? 'Pauza' : 'Prehrať'"
      @click="store.playing = !store.playing"
    />
    <v-btn icon="mdi-step-forward" size="small" variant="text" aria-label="O snímku dopredu" @click="stepBy(5)" />
    <v-slider
      :model-value="store.time"
      :max="store.model.duration"
      :step="store.model.dt"
      hide-details
      color="primary"
      class="mx-2 time-slider"
      @update:model-value="scrub"
    />
    <span class="time">{{ store.time.toFixed(2) }} / {{ store.model.duration }} s</span>
    <v-select v-model="store.speed" :items="speeds" density="compact" variant="outlined" hide-details class="speed" />
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px 8px;
}
.time {
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  min-width: 96px;
  text-align: right;
}
.speed {
  max-width: 96px;
  min-width: 84px;
}
@media (max-width: 600px) {
  .bar {
    flex-wrap: wrap;
  }
  .bar :deep(.v-slider) {
    order: -1;
    flex: 1 1 100%;
  }
  .time {
    margin-left: auto;
  }
}
</style>
