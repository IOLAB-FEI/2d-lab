<script setup lang="ts">
import { ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useModelStore, parseModel } from '../stores/model'
import { EXAMPLES } from '../core/examples'
import { emptyModel } from '../core/model'
import { toModelica, identifier } from '../core/modelica'

const store = useModelStore()
const fileInput = ref<HTMLInputElement>()
const { smAndDown, xs } = useDisplay()
const logo = `${import.meta.env.BASE_URL}favicon.svg`

function download(name: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

const baseName = () => identifier(store.model.name, new Set())

function saveJson() {
  download(`${baseName()}.mechsim.json`, JSON.stringify(store.model, null, 2), 'application/json')
}

function exportModelica() {
  try {
    download(`${baseName()}.mo`, toModelica(store.model), 'text/plain')
  } catch (e) {
    store.message = (e as Error).message
  }
}

async function openFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    store.load(parseModel(await file.text()))
    store.message = `Otvorené: ${file.name}`
  } catch (err) {
    store.message = (err as Error).message
  }
  ;(e.target as HTMLInputElement).value = ''
}

async function share() {
  const url = store.shareUrl()
  history.replaceState(null, '', url)
  try {
    await navigator.clipboard.writeText(url)
    store.message = 'Odkaz na model je skopírovaný do schránky.'
  } catch {
    store.message = 'Odkaz je v adresnom riadku prehliadača.'
  }
}
</script>

<template>
  <v-app-bar density="compact" flat border>
    <v-app-bar-title class="flex-0-0" :class="xs ? 'mr-1' : 'mr-3'">
      <img :src="logo" :alt="xs ? 'MechSim' : ''" width="24" height="24" class="logo" :class="{ 'mr-2': !xs }" />
      <span v-if="!xs" class="font-weight-medium">MechSim</span>
      <span v-if="!smAndDown" class="text-medium-emphasis text-body-2 ml-2">{{ store.model.name }}</span>
    </v-app-bar-title>
    <v-spacer />

    <v-btn-toggle v-model="store.mode" density="compact" variant="outlined" divided mandatory color="primary" class="mr-2">
      <v-btn value="design" :prepend-icon="xs ? undefined : 'mdi-pencil-ruler'" @click="store.playing = false">Návrh</v-btn>
      <v-btn value="sim" :prepend-icon="xs ? undefined : 'mdi-play-circle-outline'">Simulácia</v-btn>
    </v-btn-toggle>

    <v-btn icon="mdi-undo" :disabled="!store.past.length" title="Späť (Ctrl+Z)" :size="xs ? 'small' : undefined" @click="store.undo()" />
    <v-btn icon="mdi-redo" :disabled="!store.future.length" title="Znova (Ctrl+Y)" :size="xs ? 'small' : undefined" @click="store.redo()" />

    <v-menu>
      <template #activator="{ props }">
        <v-btn v-if="smAndDown" v-bind="props" icon="mdi-dots-vertical" title="Súbor" :size="xs ? 'small' : undefined" />
        <v-btn v-else v-bind="props" prepend-icon="mdi-folder-outline">Súbor</v-btn>
      </template>
      <v-list density="compact">
        <v-list-item prepend-icon="mdi-file-outline" title="Nový prázdny" @click="store.load(emptyModel())" />
        <v-list-item prepend-icon="mdi-folder-open-outline" title="Otvoriť…" @click="fileInput?.click()" />
        <v-list-item prepend-icon="mdi-content-save-outline" title="Uložiť ako súbor" @click="saveJson" />
        <v-list-item prepend-icon="mdi-code-braces" title="Export do Modelica (.mo)" @click="exportModelica" />
        <v-divider />
        <v-list-subheader>Ukážky</v-list-subheader>
        <v-list-item v-for="ex in EXAMPLES" :key="ex.title" :title="ex.title" @click="store.load(ex.make())" />
        <template v-if="smAndDown">
          <v-divider />
          <v-list-item prepend-icon="mdi-share-variant-outline" title="Zdieľať odkaz" @click="share" />
        </template>
      </v-list>
    </v-menu>
    <v-btn v-if="!smAndDown" prepend-icon="mdi-share-variant-outline" @click="share">Zdieľať</v-btn>
    <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="openFile" />
  </v-app-bar>
</template>

<style scoped>
.logo {
  vertical-align: -6px;
}
</style>
