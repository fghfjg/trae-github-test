<template>
  <div class="container">
    <div class="card">
      <div class="logo">📝</div>
      <h1 class="title">注册账号</h1>
      <div class="form-group">
        <input class="input" v-model="username" placeholder="用户名" />
      </div>
      <div class="form-group">
        <input class="input" v-model="nickname" placeholder="昵称（可选）" />
      </div>
      <div class="form-group">
        <input class="input" type="password" v-model="password" placeholder="密码" />
      </div>
      <div class="form-group">
        <input class="input" type="password" v-model="confirmPassword" placeholder="确认密码" @keyup.enter="handleRegister" />
      </div>
      <button class="btn-primary" @click="handleRegister" :disabled="loading">
        {{ loading ? '注册中...' : '注册' }}
      </button>
      <p class="switch-text">
        已有账号？<span class="link" @click="goToLogin">立即登录</span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '@/utils/api.js'

const router = useRouter()
const username = ref('')
const nickname = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)

const handleRegister = async () => {
  if (!username.value.trim() || !password.value.trim()) {
    alert('请输入用户名和密码')
    return
  }
  if (password.value !== confirmPassword.value) {
    alert('两次输入的密码不一致')
    return
  }
  loading.value = true
  try {
    const res = await register(username.value.trim(), password.value.trim(), nickname.value.trim())
    if (res.code === 200) {
      alert('注册成功！请登录')
      router.push('/login')
    }
  } catch (error) {
    alert(error.message || '注册失败')
  } finally {
    loading.value = false
  }
}

const goToLogin = () => {
  router.push('/login')
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
