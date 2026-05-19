<template>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <span class="app-title">聊天应用</span>
      </div>
      <div class="header-right">
        <button class="icon-btn" @click="showSearch = !showSearch" title="搜索">🔍</button>
        <button class="icon-btn" @click="showGroupModal = true" title="创建群组">👥</button>
        <button class="icon-btn" @click="goToSettings" title="设置">⚙️</button>
      </div>
    </div>

    <div v-if="showSearch" class="search-bar">
      <input class="search-input" v-model="searchKeyword" placeholder="搜索用户..." @input="handleSearch" />
      <div v-if="searchResults.length" class="search-results">
        <div v-for="u in searchResults" :key="u.userId" class="search-item" @click="addFriendByName(u.username)">
          <div class="avatar-small">{{ (u.nickname || u.username).charAt(0).toUpperCase() }}</div>
          <span>{{ u.nickname || u.username }}</span>
          <span class="add-btn">+</span>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button :class="['tab', activeTab === 'friends' ? 'active' : '']" @click="activeTab = 'friends'">好友</button>
      <button :class="['tab', activeTab === 'groups' ? 'active' : '']" @click="activeTab = 'groups'">群组</button>
      <button :class="['tab', activeTab === 'ai' ? 'active' : '']" @click="activeTab = 'ai'">AI助手</button>
    </div>

    <div v-if="activeTab === 'friends'" class="list">
      <div v-if="friends.length === 0" class="empty">
        <span class="empty-icon">👤</span>
        <span class="empty-text">还没有好友</span>
        <span class="empty-tip">在上方搜索并添加好友</span>
      </div>
      <div v-for="friend in friends" :key="friend.id" class="friend-item" @click="goToChat(friend)">
        <div class="avatar">
          <span class="avatar-text">{{ (friend.nickname || friend.username).charAt(0).toUpperCase() }}</span>
          <div class="online-dot" v-if="friend.isOnline"></div>
        </div>
        <div class="info">
          <span class="name">{{ friend.nickname || friend.username }}</span>
          <span class="status">{{ friend.isOnline ? '在线' : '离线' }}</span>
        </div>
        <span class="arrow">›</span>
      </div>
    </div>

    <div v-if="activeTab === 'groups'" class="list">
      <div v-if="groups.length === 0" class="empty">
        <span class="empty-icon">👥</span>
        <span class="empty-text">还没有群组</span>
        <span class="empty-tip">创建群组开始聊天</span>
      </div>
      <div v-for="group in groups" :key="group.groupId" class="friend-item" @click="goToGroupChat(group)">
        <div class="avatar group-avatar">
          <span class="avatar-text">{{ group.name.charAt(0).toUpperCase() }}</span>
        </div>
        <div class="info">
          <span class="name">{{ group.name }}</span>
          <span class="status">{{ group.members.length }} 名成员</span>
        </div>
        <span class="arrow">›</span>
      </div>
    </div>

    <div v-if="activeTab === 'ai'" class="ai-panel">
      <div class="ai-header">
        <span class="ai-icon">🤖</span>
        <span class="ai-title">AI 助手</span>
      </div>
      <div class="ai-modes">
        <button v-for="mode in aiModes" :key="mode.key" :class="['ai-mode-btn', aiMode === mode.key ? 'active' : '']" @click="aiMode = mode.key">
          {{ mode.label }}
        </button>
      </div>
      <div class="ai-messages" ref="aiScroll">
        <div v-for="(msg, idx) in aiMessages" :key="idx" :class="['ai-msg', msg.role === 'user' ? 'ai-user' : 'ai-bot']">
          <div class="ai-msg-bubble">{{ msg.content }}</div>
        </div>
        <div v-if="aiTyping" class="ai-msg ai-bot">
          <div class="ai-msg-bubble typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
      <div class="ai-input-area">
        <input class="ai-input" v-model="aiInput" placeholder="向 AI 提问..." @keyup.enter="sendAiMessage" />
        <button class="ai-send-btn" @click="sendAiMessage">发送</button>
      </div>
    </div>

    <div class="modal" v-if="showGroupModal" @click="showGroupModal = false">
      <div class="modal-content" @click.stop>
        <span class="modal-title">创建群组</span>
        <input class="modal-input" v-model="groupName" placeholder="群组名称" />
        <input class="modal-input" v-model="groupAnnouncement" placeholder="群公告（可选）" />
        <div class="modal-btns">
          <button class="btn-cancel" @click="showGroupModal = false">取消</button>
          <button class="btn-confirm" @click="handleCreateGroup">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getFriends, addFriend, searchUsers, createGroup, getUserGroups } from '@/utils/api.js'
import { getSocket } from '@/utils/socket.js'

const router = useRouter()
const userId = ref(0)
const friends = ref([])
const groups = ref([])
const activeTab = ref('friends')
const showSearch = ref(false)
const searchKeyword = ref('')
const searchResults = ref([])
const showGroupModal = ref(false)
const groupName = ref('')
const groupAnnouncement = ref('')

const aiMode = ref('chat')
const aiMessages = ref([])
const aiInput = ref('')
const aiTyping = ref(false)
const aiScroll = ref(null)

const aiModes = [
  { key: 'chat', label: '💬 聊天' },
  { key: 'translate', label: '🌐 翻译' },
  { key: 'summarize', label: '📝 总结' },
  { key: 'code', label: '💻 代码' },
  { key: 'write', label: '✍️ 写作' }
]

const aiPrompts = {
  chat: '你是一个友好的聊天伙伴。保持回复简短、口语化，用中文回复。',
  translate: '你是一个翻译助手。将用户输入翻译成中文。只输出翻译结果。',
  summarize: '你是一个总结助手。用2-3句话总结用户输入的内容。',
  code: '你是一个编程助手。帮助解答代码问题。提供代码示例。',
  write: '你是一个写作助手。帮助写内容、邮件和文案。'
}

let searchTimer = null

onMounted(() => {
  userId.value = parseInt(localStorage.getItem('userId'))
  loadFriends()
  loadGroups()
  const socket = getSocket()
  if (socket) {
    socket.on('user_status_changed', handleStatusChange)
  }
})

onUnmounted(() => {
  const socket = getSocket()
  if (socket) {
    socket.off('user_status_changed', handleStatusChange)
  }
})

const loadFriends = async () => {
  try {
    const res = await getFriends(userId.value)
    if (res.code === 200) {
      friends.value = res.data.friends || []
    }
  } catch (error) {
    alert(error.message || '加载好友失败')
  }
}

const loadGroups = async () => {
  try {
    const res = await getUserGroups(userId.value)
    if (res.code === 200) {
      groups.value = res.data || []
    }
  } catch (error) {
  }
}

const handleStatusChange = (data) => {
  const friend = friends.value.find(f => f.id === data.userId)
  if (friend) {
    friend.isOnline = data.isOnline
    friend.status = data.status || (data.isOnline ? 'online' : 'offline')
  }
}

const handleSearch = () => {
  clearTimeout(searchTimer)
  if (!searchKeyword.value.trim()) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    try {
      const res = await searchUsers(searchKeyword.value.trim())
      if (res.code === 200) {
        searchResults.value = res.data.filter(u => u.userId !== userId.value)
      }
    } catch (error) {
    }
  }, 300)
}

const addFriendByName = async (username) => {
  try {
    const res = await addFriend(userId.value, username)
    if (res.code === 200) {
      alert('添加成功！')
      searchResults.value = []
      searchKeyword.value = ''
      loadFriends()
    }
  } catch (error) {
    alert(error.message || '添加失败')
  }
}

const handleCreateGroup = async () => {
  if (!groupName.value.trim()) {
    alert('请输入群组名称')
    return
  }
  try {
    const res = await createGroup(groupName.value.trim(), userId.value, [], false, '', groupAnnouncement.value.trim())
    if (res.code === 200) {
      alert('群组创建成功！')
      showGroupModal.value = false
      groupName.value = ''
      groupAnnouncement.value = ''
      loadGroups()
    }
  } catch (error) {
    alert(error.message || '创建群组失败')
  }
}

const sendAiMessage = async () => {
  if (!aiInput.value.trim()) return
  const userMsg = aiInput.value.trim()
  aiMessages.value.push({ role: 'user', content: userMsg })
  aiInput.value = ''
  aiTyping.value = true
  scrollToAiBottom()

  try {
    const prompt = aiPrompts[aiMode.value] || aiPrompts.chat
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('openai_key') || '')
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: prompt },
          ...aiMessages.value.slice(-10).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMsg }
        ],
        max_tokens: 500
      })
    })
    const data = await response.json()
    if (data.choices && data.choices[0]) {
      aiMessages.value.push({ role: 'assistant', content: data.choices[0].message.content })
    } else {
      aiMessages.value.push({ role: 'assistant', content: 'AI response unavailable. Check your API key in Settings.' })
    }
  } catch (error) {
    aiMessages.value.push({ role: 'assistant', content: 'Connection error. Please check your API key in Settings.' })
  }

  aiTyping.value = false
  scrollToAiBottom()
}

const scrollToAiBottom = () => {
  nextTick(() => {
    if (aiScroll.value) {
      aiScroll.value.scrollTop = aiScroll.value.scrollHeight
    }
  })
}

const goToChat = (friend) => {
  router.push({ path: '/chat', query: { friendId: friend.id, friendName: friend.nickname || friend.username } })
}

const goToGroupChat = (group) => {
  router.push({ path: '/group-chat', query: { groupId: group.groupId, groupName: group.name } })
}

const goToSettings = () => {
  router.push('/settings')
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: var(--bg-primary);
}
.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.app-title {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
}
.header-right {
  display: flex;
  gap: 8px;
}
.icon-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.search-bar {
  padding: 10px 15px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}
.search-input {
  width: 100%;
  height: 40px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 0 16px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
}
.search-results {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
}
.search-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-card);
  border-radius: 8px;
  margin-bottom: 4px;
  cursor: pointer;
  color: var(--text-primary);
}
.search-item:hover {
  background: var(--bg-hover);
}
.avatar-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  margin-right: 10px;
}
.add-btn {
  margin-left: auto;
  font-size: 20px;
  color: var(--primary);
  font-weight: bold;
}
.tabs {
  display: flex;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}
.tab {
  flex: 1;
  padding: 12px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
.list {
  padding: 10px;
}
.empty {
  text-align: center;
  padding: 60px 0;
}
.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 10px;
}
.empty-text {
  font-size: 16px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 4px;
}
.empty-tip {
  font-size: 12px;
  color: var(--text-muted);
}
.friend-item {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  box-shadow: 0 1px 4px var(--shadow);
  cursor: pointer;
  transition: transform 0.1s;
}
.friend-item:active {
  transform: scale(0.98);
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  position: relative;
  flex-shrink: 0;
}
.group-avatar {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}
.avatar-text {
  font-size: 18px;
  color: #fff;
  font-weight: bold;
}
.online-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background: #4cd964;
  border-radius: 50%;
  border: 2px solid var(--bg-card);
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 15px;
  color: var(--text-primary);
  display: block;
  margin-bottom: 2px;
  font-weight: 500;
}
.status {
  font-size: 12px;
  color: var(--text-muted);
}
.arrow {
  font-size: 20px;
  color: var(--text-muted);
}

.ai-panel {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}
.ai-header {
  display: flex;
  align-items: center;
  padding: 15px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}
.ai-icon {
  font-size: 24px;
  margin-right: 10px;
}
.ai-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
}
.ai-modes {
  display: flex;
  gap: 8px;
  padding: 10px 15px;
  overflow-x: auto;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}
.ai-mode-btn {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.ai-mode-btn.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}
.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}
.ai-msg {
  margin-bottom: 12px;
  display: flex;
}
.ai-user {
  justify-content: flex-end;
}
.ai-bot {
  justify-content: flex-start;
}
.ai-msg-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
}
.ai-user .ai-msg-bubble {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}
.ai-bot .ai-msg-bubble {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
.typing-indicator span {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  margin: 0 2px;
  animation: typing 1.4s infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}
.ai-input-area {
  display: flex;
  padding: 10px 15px;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  gap: 8px;
}
.ai-input {
  flex: 1;
  height: 40px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 0 16px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
}
.ai-send-btn {
  width: 60px;
  height: 40px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
}

.modal {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal-content {
  width: 320px;
  background: var(--bg-card);
  border-radius: 16px;
  padding: 24px;
}
.modal-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
  text-align: center;
  margin-bottom: 16px;
}
.modal-input {
  width: 100%;
  height: 44px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 14px;
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 12px;
  outline: none;
}
.modal-btns {
  display: flex;
  gap: 10px;
}
.btn-cancel, .btn-confirm {
  flex: 1;
  height: 40px;
  border-radius: 10px;
  font-size: 14px;
  border: none;
  cursor: pointer;
}
.btn-cancel {
  background: var(--bg-input);
  color: var(--text-secondary);
}
.btn-confirm {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}
</style>
