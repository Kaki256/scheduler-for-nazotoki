import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router' // routerをインポート

const app = createApp(App)
app.use(router) // routerをアプリケーションに使用
app.mount('#app')
