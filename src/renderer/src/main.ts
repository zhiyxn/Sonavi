import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import './styles/tokens.css'
import './styles/base.css'

const application = createApp(App)

application.use(createPinia())
application.use(VueQueryPlugin)
application.mount('#app')
