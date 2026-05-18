<template>
  <div class="container">
    <div class="card">
      <div class="logo">💬</div>
      <h1 class="title">聊天应用</h1>
      <div class="form-group">
        <input class="input" v-model="username" placeholder="用户名" autocomplete="username" />
        <span v-if="usernameError" class="error-text">{{ usernameError }}</span>
      </div>
      <div class="form-group">
        <input class="input" type="password" v-model="password" placeholder="密码" autocomplete="current-password" @keyup.enter="handleLogin" />
        <span v-if="passwordError" class="error-text">{{ passwordError }}</span>
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '@/utils/api.js'
import { initSocket } from '@/utils/socket.js'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const usernameError = ref('')
const passwordError = ref('')

// 页面加载时检查是否已登录，实现自动登录
onMounted(() => {
  const savedUserId = localStorage.getItem('userId')
  const savedToken = localStorage.getItem('token')
  // 如果有有效的登录信息，直接跳转
  if (savedUserId && savedToken) {
    console.log('[Login] 检测到已登录信息，自动跳转')
    initSocket(parseInt(savedUserId))
    router.push('/friends')
  }
})

// 表单校验
const validateForm = () => {
  usernameError.value = ''
  passwordError.value = ''
  let valid = true

  if (!username.value.trim()) {
    usernameError.value = '请输入用户名'
    valid = false
  } else if (username.value.trim().length < 2) {
    usernameError.value = '用户名至少2个字符'
    valid = false
  }

  if (!password.value.trim()) {
    passwordError.value = '请输入密码'
    valid = false
  } else if (password.value.trim().length < 4) {
    passwordError.value = '密码至少4个字符'
    valid = false
  }

  return valid
}

const handleLogin = async () => {
  if (!validateForm()) return

  loading.value = true
  try {
    const res = await login(username.value.trim(), password.value.trim())
    if (res.code === 200) {
      // 持久化登录信息到localStorage
      localStorage.setItem('userId', res.data.userId)
      localStorage.setItem('username', res.data.username)
      localStorage.setItem('nickname', res.data.nickname || res.data.username)
      localStorage.setItem('avatar', res.data.avatar || '')
      localStorage.setItem('token', res.data.token)
      console.log('[Login] 登录成功，已保存用户信息')
      // 初始化WebSocket连接
      initSocket(res.data.userId)
      alert('登录成功！')
      router.push('/friends')
    }
  } catch (error) {
    // 根据后端返回的错误信息给出友好提示
    if (error.message && error.message.includes('Invalid credentials')) {
      alert('账号或密码错误，请重试')
    } else if (error.message && error.message.includes('not found')) {
      alert('账号不存在，请先注册')
    } else {
      alert(error.message || '登录失败，请检查网络后重试')
    }
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
  position: relative;
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
  box-sizing: border-box;
}
.input:focus {
  border-color: var(--primary);
}
.error-text {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #ff3b30;
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
