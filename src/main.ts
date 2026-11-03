import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import 'katex/dist/katex.min.css'
import { createVuetify } from 'vuetify'
import App from './App.vue'

const vuetify = createVuetify({
  theme: { defaultTheme: 'light' },
  defaults: { VBtn: { variant: 'text' } },
})

createApp(App).use(createPinia()).use(vuetify).mount('#app')
