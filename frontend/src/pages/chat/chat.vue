<template>
  <div class="container">
    <div class="header">
      <button class="back-btn" @click="goBack">←</button>
      <div class="header-info">
        <span class="header-name">{{ friendName }}</span>
        <span class="header-status" :class="friendOnline ? 'online' : 'offline'">
          {{ friendOnline ? '在线' : '离线' }}
        </span>
      </div>
    </div>

    <div class="messages" ref="messagesContainer">
      <div v-if="messages.length === 0" class="empty-chat">
        <span class="empty-icon">💬</span>
        <span class="empty-text">还没有消息，打个招呼吧</span>
      </div>
      <div v-for="msg in messages" :key="msg.id" :id="'msg-' + msg.id" class="message-wrapper">
        <div :class="['message', msg.senderId === userId ? 'sent' : 'received']">
          <div v-if="msg.recalled" class="recalled-msg">消息已撤回</div>
          <div v-else-if="msg.deleted" class="recalled-msg">消息已删除</div>
          <div v-else class="msg-content">{{ msg.content }}</div>
          <div class="msg-footer">
            <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
            <button v-if="msg.senderId === userId && !msg.recalled && !msg.deleted" class="msg-action" @click="handleRecall(msg)">撤回</button>
            <button v-if="!msg.deleted" class="msg-action" @click="deleteMessage(msg)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <div class="input-area">
      <button class="input-btn" @click="showEmoji = !showEmoji">😊</button>
      <input class="message-input" v-model="inputText" placeholder="输入消息..." @keyup.enter="sendMessage" />
      <button class="send-btn" @click="sendMessage" :disabled="!inputText.trim()">发送</button>
    </div>

    <div v-if="showEmoji" class="emoji-panel">
      <div class="emoji-grid">
        <span v-for="emoji in emojis" :key="emoji" class="emoji-item" @click="insertEmoji(emoji)">{{ emoji }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMessages, recallMessage as apiRecallMessage, deleteMessage as apiDeleteMessage } from '@/utils/api.js'
import { initSocket, sendMessage as sendSocketMessage, on, off, recallMessage as socketRecallMessage } from '@/utils/socket.js'

const route = useRoute()
const router = useRouter()
const userId = ref(0)
const friendId = ref(0)
const friendName = ref('')
const friendOnline = ref(false)
const messages = ref([])
const inputText = ref('')
const messagesContainer = ref(null)
const showEmoji = ref(false)

const emojis = ['😀','😂','🥰','😎','🤔','😢','👍','❤️','🔥','🎉','👋','🙏','💪','✨','🌟','💯','🎵','📷','🍕','☕']

onMounted(() => {
  userId.value = parseInt(localStorage.getItem('userId'))
  friendId.value = parseInt(route.query.friendId)
  friendName.value = route.query.friendName || '好友'
  friendOnline.value = route.query.online === 'true'
  
  if (userId.value) {
    initSocket(userId.value)
    console.log('[Chat] WebSocket 已初始化, userId:', userId.value)
  }
  
  loadMessages()
  
  on('receive_message', handleNewMessage)
  on('message_recalled', handleMessageRecalled)
  on('user_status_changed', handleUserStatusChanged)
})

onUnmounted(() => {
  off('receive_message', handleNewMessage)
  off('message_recalled', handleMessageRecalled)
  off('user_status_changed', handleUserStatusChanged)
})

const loadMessages = async () => {
  try {
    const res = await getMessages(userId.value, friendId.value)
    if (res.code === 200) {
      messages.value = res.data.messages || []
      scrollToBottom()
    }
  } catch (error) {
    console.error('[Chat] 加载消息失败:', error)
  }
}

const handleNewMessage = (data) => {
  console.log('[Chat] 收到新消息:', data)
  if ((data.senderId === friendId.value && data.receiverId === userId.value) ||
      (data.senderId === userId.value && data.receiverId === friendId.value)) {
    const existingMsg = messages.value.find(m => m.id === data.id)
    if (!existingMsg) {
      messages.value.push(data)
      scrollToBottom()
    }
  }
}

const handleMessageRecalled = (data) => {
  console.log('[Chat] 消息撤回:', data)
  const msg = messages.value.find(m => m.id === data.messageId)
  if (msg) {
    msg.recalled = true
  }
}

const handleUserStatusChanged = (data) => {
  console.log('[Chat] 用户状态变化:', data)
  if (data.userId === friendId.value) {
    friendOnline.value = data.online
  }
}

const sendMessage = async () => {
  const content = inputText.value.trim()
  if (!content) {
    alert('请输入消息内容')
    return
  }
  
  const tempMsg = {
    id: Date.now(),
    senderId: userId.value,
    receiverId: friendId.value,
    content,
    createdAt: new Date().toISOString(),
    recalled: false,
    deleted: false,
    messageType: 'text'
  }
  messages.value.push(tempMsg)
  inputText.value = ''
  showEmoji.value = false
  scrollToBottom()

  const success = sendSocketMessage(userId.value, friendId.value, content, 'text')
  if (!success) {
    console.error('[Chat] 发送消息失败，Socket未连接')
    alert('发送失败，请检查网络连接')
    const index = messages.value.findIndex(m => m.id === tempMsg.id)
    if (index !== -1) {
      messages.value.splice(index, 1)
    }
  }
}

const handleRecall = async (msg) => {
  try {
    const res = await apiRecallMessage(userId.value, msg.id)
    if (res.code === 200) {
      msg.recalled = true
      socketRecallMessage(msg.id, userId.value, friendId.value)
    }
  } catch (error) {
    alert(error.message || '撤回消息失败')
  }
}

const deleteMessage = async (msg) => {
  try {
    const res = await apiDeleteMessage(userId.value, msg.id)
    if (res.code === 200) {
      msg.deleted = true
    }
  } catch (error) {
    alert(error.message || '删除消息失败')
  }
}

const insertEmoji = (emoji) => {
  inputText.value += emoji
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const goBack = () => {
  router.push('/friends')
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
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
.header-info {
  flex: 1;
}
.header-name {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  display: block;
}
.header-status {
  font-size: 12px;
  color: rgba(255,255,255,0.8);
}
.header-status.online {
  color: #4ade80;
}
.header-status.offline {
  color: rgba(255,255,255,0.5);
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty-chat {
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
}
.message-wrapper {
  display: flex;
}
.message {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 16px;
  position: relative;
  word-wrap: break-word;
}
.sent {
  align-self: flex-end;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.received {
  align-self: flex-start;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-bottom-left-radius: 4px;
}
.recalled-msg {
  font-style: italic;
  opacity: 0.6;
  font-size: 13px;
}
.msg-content {
  font-size: 14px;
  line-height: 1.5;
}
.msg-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
  gap: 8px;
  align-items: center;
}
.msg-time {
  font-size: 11px;
  opacity: 0.7;
}
.msg-action {
  background: none;
  border: none;
  color: inherit;
  font-size: 11px;
  cursor: pointer;
  opacity: 0.6;
  padding: 0;
}
.msg-action:hover {
  opacity: 1;
}
.input-area {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  gap: 8px;
}
.input-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
}
.message-input {
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
.send-btn {
  width: 60px;
  height: 40px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
}
.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.emoji-panel {
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  max-height: 200px;
  overflow-y: auto;
}
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
  padding: 12px;
}
.emoji-item {
  font-size: 24px;
  cursor: pointer;
  text-align: center;
  padding: 4px;
  border-radius: 8px;
}
.emoji-item:hover {
  background: var(--bg-hover);
}
</style>