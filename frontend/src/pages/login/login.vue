<template>
  <div class="container">
    <div class="card">
      <div class="logo">💬</div>
      <h1 class="title">聊天应用</h1>
      <div class="form-group">
        <input class="input" v-model="username" placeholder="用户名" autocomplete="username" />
      </div>
      <div class="form-group">
        <input class="input" type="password" v-model="password" placeholder="密码" autocomplete="current-password" @keyup.enter="handleLogin" />
      </div>
      <button class="btn-primary" @click="handleLogin" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>
      <p class="switch-text">
        没有账号？<span class="link" @click="goToRegister">立即注册</span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '@/utils/api.js'
import { initSocket } from '@/utils/socket.js'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)

const handleLogin = async () => {
  if (!username.value.trim() || !password.value.trim()) {
    alert('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    const res = await login(username.value.trim(), password.value.trim())
    if (res.code === 200) {
      localStorage.setItem('userId', res.data.userId)
      localStorage.setItem('username', res.data.username)
      localStorage.setItem('nickname', res.data.nickname || res.data.username)
      localStorage.setItem('avatar', res.data.avatar || '')
      localStorage.setItem('token', res.data.token)
      initSocket(res.data.userId)
      router.push('/friends')
    }
  } catch (error) {
    alert(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}

const goToRegister = () => {
  router.push('/register')
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  padding: 20px;
}
.card {
  width: 100%;
  max-width: 380px;
  background: var(--bg-card);
  border-radius: 16px;
  padding: 40px 30px;
  box-shadow: 0 4px 20px var(--shadow);
}
.logo {
  font-size: 48px;
  text-align: center;
  margin-bottom: 10px;
}
.title {
  text-align: center;
  font-size: 24px;
  color: var(--text-primary);
  margin: 0 0 30px 0;
}
.form-group {
  margin-bottom: 16px;
}
.input {
  width: 100%;
  height: 48px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 16px;
  font-size: 15px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}
.input:focus {
  border-color: var(--primary);
}
.btn-primary {
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.2s;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.switch-text {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: var(--text-secondary);
}
.link {
  color: var(--primary);
  cursor: pointer;
  font-weight: 500;
}
</style>
