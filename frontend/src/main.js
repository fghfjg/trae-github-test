import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

console.log('[MAIN] 应用初始化开始')

const app = createApp(App)

app.use(router)

app.mount('#app')

console.log('[MAIN] 应用挂载完成')
