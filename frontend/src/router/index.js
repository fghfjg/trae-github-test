import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/login/login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/pages/register/register.vue')
  },
  {
    path: '/friends',
    name: 'Friends',
    component: () => import('@/pages/friends/friends.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('@/pages/chat/chat.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/group-chat',
    name: 'GroupChat',
    component: () => import('@/pages/group-chat/group-chat.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/pages/settings/settings.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth) {
    const userId = localStorage.getItem('userId')
    const token = localStorage.getItem('token')
    if (!userId || !token) {
      console.log('[Router] 未登录，跳转至登录页')
      next('/login')
    } else {
      next()
    }
  } else {
    const userId = localStorage.getItem('userId')
    const token = localStorage.getItem('token')
    if ((to.path === '/login' || to.path === '/register') && userId && token) {
      next('/friends')
    } else {
      next()
    }
  }
})

export default router
