<script setup lang="ts">
import { computed } from 'vue'
import { useModelStore } from '../stores/model'
import { type ForceSignal, type LinkKind, hasSpring, hasDamper, nextName } from '../core/model'

const store = useModelStore()
const sel = computed(() => store.selected)
const isSim = computed(() => store.mode === 'sim')

const linkKinds: { value: LinkKind; title: string }[] = [
  { value: 'spring', title: 'Pružina' },
  { value: 'damper', title: 'Tlmič' },
  { value: 'springDamper', title: 'Pružina + tlmič' },
]
const signalTypes = [
  { value: 'constant', title: 'Konštantná' },
  { value: 'step', title: 'Skok' },
  { value: 'sine', title: 'Sínus' },
]

function setLinkKind(kind: LinkKind) {
  const l = sel.value
  if (!l || !('kName' in l)) return
  store.transact(m => {
    // novo pridaná časť spoja dostane voľný názov (k…, d…)
    const others = { ...m, links: m.links.filter(x => x.id !== l.id) }
    if (hasSpring({ kind }) && !hasSpring(l)) l.kName = nextName(others, 'k')
    if (hasDamper({ kind }) && !hasDamper(l)) l.dName = nextName(others, 'd')
    l.kind = kind
  })
}

function setSignalType(type: ForceSignal['type']) {
  const f = sel.value
  if (!f || !('signal' in f)) return
  store.checkpoint()
  const amp = f.signal.amp
  const t0 = 't0' in f.signal ? f.signal.t0 : 0
  f.signal = type === 'constant' ? { type, amp } : type === 'step' ? { type, amp, t0 } : { type, amp, t0, freq: 0.5 }
}

const field = { density: 'compact', variant: 'outlined', hideDetails: 'auto', type: 'number' } as const
const text = { density: 'compact', variant: 'outlined', hideDetails: true } as const
</script>

<template>
  <div class="props">
    <template v-if="!sel">
      <div class="text-subtitle-2 mb-2">Systém</div>
      <v-text-field v-bind="text" v-model="store.model.name" label="Názov" :disabled="isSim" @focus="store.checkpoint()" />
      <v-text-field v-bind="field" v-model.number="store.model.duration" label="Trvanie" suffix="s" @focus="store.checkpoint()" />
      <v-text-field v-bind="field" v-model.number="store.model.dt" label="Krok" suffix="s" step="0.005" @focus="store.checkpoint()" />
      <v-text-field v-bind="field" v-model.number="store.model.scale" label="Mierka zobrazenia" suffix="px/m" @focus="store.checkpoint()" />
      <p class="text-caption text-medium-emphasis mt-2">
        Klikni na prvok na plátne a uprav jeho vlastnosti. Orientáciu systému a gravitáciu nastavíš v ľavom hornom rohu plátna.
      </p>
    </template>

    <template v-else-if="'layout' in sel && sel.kind === 'mass'">
      <div class="text-subtitle-2 mb-2">Teleso</div>
      <v-text-field v-bind="text" v-model="sel.name" label="Názov" :disabled="isSim" @focus="store.checkpoint()" />
      <v-text-field v-bind="field" v-model.number="sel.m" label="Hmotnosť m" suffix="kg" @focus="store.checkpoint()" />
      <v-text-field v-bind="field" v-model.number="sel.x0" label="Počiatočná výchylka x₀" suffix="m" step="0.05" @focus="store.checkpoint()" />
      <v-text-field v-bind="field" v-model.number="sel.v0" label="Počiatočná rýchlosť v₀" suffix="m/s" step="0.1" @focus="store.checkpoint()" />
      <v-text-field v-bind="field" v-model.number="sel.b" label="Trenie o podložku b" suffix="N·s/m" step="0.1" @focus="store.checkpoint()" />
    </template>

    <template v-else-if="'layout' in sel">
      <div class="text-subtitle-2 mb-2">Stena</div>
      <v-text-field v-bind="text" v-model="sel.name" label="Názov" :disabled="isSim" @focus="store.checkpoint()" />
      <p class="text-caption text-medium-emphasis">Pevný bod – poloha sa nemení.</p>
    </template>

    <template v-else-if="'kName' in sel">
      <div class="text-subtitle-2 mb-2">Spoj</div>
      <v-select
        :model-value="sel.kind"
        :items="linkKinds"
        density="compact"
        variant="outlined"
        hide-details
        label="Typ"
        :disabled="isSim"
        @update:model-value="setLinkKind"
      />
      <template v-if="sel.kind !== 'damper'">
        <v-text-field v-bind="text" v-model="sel.kName" label="Názov tuhosti" :disabled="isSim" @focus="store.checkpoint()" />
        <v-text-field v-bind="field" v-model.number="sel.k" label="Tuhosť k" suffix="N/m" @focus="store.checkpoint()" />
      </template>
      <template v-if="sel.kind !== 'spring'">
        <v-text-field v-bind="text" v-model="sel.dName" label="Názov tlmenia" :disabled="isSim" @focus="store.checkpoint()" />
        <v-text-field v-bind="field" v-model.number="sel.d" label="Tlmenie d" suffix="N·s/m" step="0.1" @focus="store.checkpoint()" />
      </template>
    </template>

    <template v-else-if="'signal' in sel">
      <div class="text-subtitle-2 mb-2">Sila</div>
      <v-text-field v-bind="text" v-model="sel.name" label="Názov" :disabled="isSim" @focus="store.checkpoint()" />
      <v-select
        :model-value="sel.signal.type"
        :items="signalTypes"
        density="compact"
        variant="outlined"
        hide-details
        label="Priebeh"
        @update:model-value="setSignalType"
      />
      <v-text-field v-bind="field" v-model.number="sel.signal.amp" label="Amplitúda" suffix="N" @focus="store.checkpoint()" />
      <v-text-field v-if="'t0' in sel.signal" v-bind="field" v-model.number="sel.signal.t0" label="Začiatok" suffix="s" @focus="store.checkpoint()" />
      <v-text-field
        v-if="sel.signal.type === 'sine'"
        v-bind="field"
        v-model.number="sel.signal.freq"
        label="Frekvencia"
        suffix="Hz"
        step="0.1"
        @focus="store.checkpoint()"
      />
    </template>

    <v-btn
      v-if="sel && !isSim"
      class="mt-3"
      variant="tonal"
      color="error"
      size="small"
      prepend-icon="mdi-delete-outline"
      @click="store.remove(sel.id)"
    >
      Zmazať
    </v-btn>
  </div>
</template>

<style scoped>
.props {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
