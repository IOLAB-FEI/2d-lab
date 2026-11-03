<script setup lang="ts">
import { computed } from 'vue'
import katex from 'katex'
import { useModelStore } from '../stores/model'
import { useSimulation } from '../composables/useSimulation'
import { equations } from '../core/equations'

const store = useModelStore()
const sim = useSimulation()

const eq = computed(() => equations(store.model, { numeric: store.numericEquations, highlight: store.selection }))
const render = (tex: string) => katex.renderToString(tex, { throwOnError: false, displayMode: true })
const lines = computed(() => eq.value.lines.map(render))
const defs = computed(() => eq.value.defs.map(render))
</script>

<template>
  <div class="eq">
    <div class="head">
      <div class="title">
        <div class="text-subtitle-2">Pohybové rovnice</div>
        <div class="text-caption text-medium-emphasis">
          odvodené z nakresleného systému · x = posunutie voči nakreslenej polohe{{ store.model.axis === 'vertical' ? ', kladné nadol' : ', kladné doprava' }}
        </div>
      </div>
      <v-btn-toggle v-model="store.numericEquations" density="compact" variant="outlined" divided mandatory class="flex-shrink-0">
        <v-btn :value="false" size="small">Symbolicky</v-btn>
        <v-btn :value="true" size="small">S číslami</v-btn>
      </v-btn-toggle>
    </div>
    <div v-if="!lines.length" class="text-body-2 text-medium-emphasis">Pridaj teleso – rovnice sa zobrazia tu.</div>
    <div class="lines">
      <div v-for="(html, i) in lines" :key="i" v-html="html" />
      <div v-for="(html, i) in defs" :key="'d' + i" class="def" v-html="html" />
    </div>
    <div v-for="(issue, i) in sim.issues.value" :key="'i' + i" class="issue" :class="issue.level">
      <v-icon :icon="issue.level === 'error' ? 'mdi-alert-circle-outline' : 'mdi-alert-outline'" size="16" />
      <span>{{ issue.message }}</span>
    </div>
    <div v-if="sim.overlap.value" class="issue warning">
      <v-icon icon="mdi-alert-outline" size="16" />
      <span>
        {{ sim.overlap.value.names.join(' a ') }} sa prekryjú v čase {{ sim.overlap.value.t.toFixed(2) }} s – lineárny model kolízie nepozná.
      </span>
    </div>
  </div>
</template>

<style scoped>
.eq {
  padding: 8px 12px;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
  margin-bottom: 4px;
}
.title {
  min-width: 0;
  flex: 1 1 240px;
}
.lines {
  overflow-x: auto;
}
.lines :deep(.katex-display) {
  margin: 4px 0;
}
.lines :deep(.katex-display > .katex) {
  text-align: left;
}
.lines :deep(.katex) {
  font-size: 1.12em;
}
.def :deep(.katex) {
  font-size: 1em;
}
.issue {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  margin-top: 4px;
}
.issue.error {
  color: rgb(var(--v-theme-error));
}
.issue.warning {
  color: rgb(var(--v-theme-warning));
}
</style>
