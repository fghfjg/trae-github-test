<template>
  <div class="container">
    <div class="header">
      <button class="back-btn" @click="goBack">←</button>
      <span class="header-title">设置</span>
    </div>

    <div class="content">
      <div class="section">
        <div class="section-title">个人资料</div>
        <div class="profile-card">
          <div class="avatar-large">
            <span class="avatar-text">{{ (nickname || username).charAt(0).toUpperCase() }}</span>
          </div>
          <div class="profile-info">
            <div class="info-row">
              <span class="info-label">用户名</span>
              <span class="info-value">{{ username }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">昵称</span>
              <input class="info-input" v-model="nickname" />
            </div>
            <div class="info-row">
              <span class="info-label">个性签名</span>
              <input class="info-input" v-model="bio" placeholder="写点什么介绍一下自己" />
            </div>
            <div class="info-row">
              <span class="info-label">在线状态</span>
              <select class="info-select" v-model="status">
                <option value="online">在线</option>
                <option value="away">离开</option>
                <option value="busy">忙碌</option>
                <option value="offline">离线</option>
              </select>
            </div>
            <button class="btn-save" @click="saveProfile">保存资料</button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">外观</div>
        <div class="setting-card">
          <div class="setting-row">
            <span class="setting-label">主题</span>
            <div class="theme-switch">
              <button :class="['theme-btn', theme === 'light' ? 'active' : '']" @click="setTheme('light')">☀️ 浅色</button>
              <button :class="['theme-btn', theme === 'dark' ? 'active' : '']" @click="setTheme('dark')">🌙 深色</button>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">AI 设置</div>
        <div class="setting-card">
          <div class="setting-row">
            <span class="setting-label">OpenAI API 密钥</span>
            <input class="setting-input" v-model="openaiKey" type="password" placeholder="sk-..." />
          </div>
          <button class="btn-save" @click="saveOpenaiKey">保存密钥</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">账号</div>
        <div class="setting-card">
          <button class="btn-logout" @click="handleLogout">退出登录</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { updateUserInfo } from '@/utils/api.js'
import { setTheme, getTheme } from '@/utils/theme.js'
import { disconnectSocket } from '@/utils/socket.js'

const router = useRouter()
const userId = ref(0)
const username = ref('')
const nickname = ref('')
const bio = ref('')
const status = ref('online')
const theme = ref('light')
const openaiKey = ref('')

onMounted(() => {
  userId.value = parseInt(localStorage.getItem('userId'))
  username.value = localStorage.getItem('username') || ''
  nickname.value = localStorage.getItem('nickname') || username.value
  bio.value = localStorage.getItem('bio') || ''
  status.value = localStorage.getItem('status') || 'online'
  theme.value = getTheme()
  openaiKey.value = localStorage.getItem('openai_key') || ''
})

const saveProfile = async () => {
  try {
    const res = await updateUserInfo(userId.value, {
      nickname: nickname.value,
      bio: bio.value,
      status: status.value
    })
    if (res.code === 200) {
      localStorage.setItem('nickname', nickname.value)
      localStorage.setItem('bio', bio.value)
      localStorage.setItem('status', status.value)
      alert('资料保存成功！')
    }
  } catch (error) {
    alert(error.message || '保存资料失败')
  }
}

const saveOpenaiKey = () => {
  localStorage.setItem('openai_key', openaiKey.value)
  alert('API 密钥已保存！')
}

const handleLogout = () => {
  disconnectSocket()
  localStorage.removeItem('userId')
  localStorage.removeItem('username')
  localStorage.removeItem('nickname')
  localStorage.removeItem('avatar')
  localStorage.removeItem('token')
  localStorage.removeItem('bio')
  localStorage.removeItem('status')
  router.push('/login')
}

const goBack = () => {
  router.push('/friends')
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: var(--bg-primary);
}
.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 12px 15px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.back-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
}
.header-title {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
}
.content {
  padding: 15px;
}
.section {
  margin-bottom: 20px;
}
.section-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-secondary);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.profile-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 4px var(--shadow);
}
.avatar-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 15px;
}
.avatar-text {
  font-size: 32px;
  color: #fff;
  font-weight: bold;
}
.profile-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-label {
  font-size: 12px;
  color: var(--text-muted);
}
.info-value {
  font-size: 14px;
  color: var(--text-primary);
}
.info-input {
  width: 100%;
  height: 40px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
}
.info-select {
  width: 100%;
  height: 40px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
}
.btn-save {
  width: 100%;
  height: 44px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
}
.setting-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 4px var(--shadow);
}
.setting-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.setting-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.theme-switch {
  display: flex;
  gap: 8px;
}
.theme-btn {
  flex: 1;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.theme-btn.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}
.setting-input {
  width: 100%;
  height: 40px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
}
.btn-logout {
  width: 100%;
  height: 44px;
  background: #ff3b30;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
</style>
