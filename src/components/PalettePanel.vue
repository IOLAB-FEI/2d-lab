<script setup lang="ts">
import { useModelStore } from '../stores/model'
import type { PaletteKind } from './EditorCanvas.vue'
import type { LinkKind } from '../core/model'

const emit = defineEmits<{ start: [kind: PaletteKind, e: PointerEvent] }>()
const store = useModelStore()

const items: { kind: PaletteKind; title: string; icon: string }[] = [
  { kind: 'wall', title: 'Stena', icon: 'mdi-wall' },
  { kind: 'mass', title: 'Teleso', icon: 'mdi-square-rounded-outline' },
  { kind: 'spring', title: 'Pružina', icon: 'mdi-sine-wave' },
  { kind: 'damper', title: 'Tlmič', icon: 'mdi-arrow-collapse-horizontal' },
  { kind: 'springDamper', title: 'Pružina + tlmič', icon: 'mdi-view-parallel-outline' },
  { kind: 'force', title: 'Sila', icon: 'mdi-arrow-right-bold-outline' },
]

const linkKinds: { value: LinkKind; title: string }[] = [
  { value: 'spring', title: 'Pružina' },
  { value: 'damper', title: 'Tlmič' },
  { value: 'springDamper', title: 'Pružina + tlmič' },
]
</script>

<template>
  <div class="palette">
    <div class="text-caption text-medium-emphasis mb-1">Prvky – potiahni na plátno</div>
    <div class="items">
      <div
        v-for="it in items"
        :key="it.kind"
        class="item"
        :class="{ disabled: store.mode === 'sim' }"
        @pointerdown.prevent="store.mode === 'design' && emit('start', it.kind, $event)"
      >
        <v-icon :icon="it.icon" size="20" />
        <span>{{ it.title }}</span>
      </div>
    </div>
    <div class="link-kind text-caption text-medium-emphasis mt-3 mb-1">Spoj z krúžku na krúžok</div>
    <v-select
      class="link-kind"
      v-model="store.linkKind"
      :items="linkKinds"
      density="compact"
      variant="outlined"
      hide-details
      :disabled="store.mode === 'sim'"
    />
  </div>
</template>

<style scoped>
.palette {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  cursor: grab;
  user-select: none;
  touch-action: none;
  font-size: 14px;
}
.item:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}
.items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
@media (max-width: 959px) {
  .items {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .item {
    padding: 6px 10px;
  }
  .link-kind {
    display: none;
  }
}
.item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
