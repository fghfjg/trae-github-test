<template>
  <div class="container">
    <div class="header">
      <button class="back-btn" @click="goBack">←</button>
      <div class="header-info">
        <span class="header-name">{{ groupName }}</span>
        <span class="header-status">{{ memberCount }} 名成员</span>
      </div>
      <button class="icon-btn" @click="showGroupSettings = true">⚙️</button>
    </div>

    <div class="messages" ref="messagesContainer">
      <div v-if="messages.length === 0" class="empty-chat">
        <span class="empty-icon">👥</span>
        <span class="empty-text">还没有消息</span>
      </div>
      <div v-for="msg in messages" :key="msg.id" :id="'msg-' + msg.id" class="message-wrapper">
        <div :class="['message', msg.senderId === userId ? 'sent' : 'received']">
          <div v-if="msg.senderId !== userId" class="sender-name">{{ getSenderName(msg.senderId) }}</div>
          <div v-if="msg.recalled" class="recalled-msg">消息已撤回</div>
          <div v-else class="msg-content" v-html="formatMessage(msg.content)"></div>
          <div class="msg-footer">
            <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
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

    <div v-if="showGroupSettings" class="modal" @click="showGroupSettings = false">
      <div class="modal-content" @click.stop>
        <span class="modal-title">群设置</span>
        <div class="setting-item">
          <span>群名称</span>
          <input class="setting-input" v-model="editGroupName" />
        </div>
        <div class="setting-item">
          <span>群公告</span>
          <textarea class="setting-textarea" v-model="editAnnouncement"></textarea>
        </div>
        <div class="modal-btns">
          <button class="btn-cancel" @click="showGroupSettings = false">关闭</button>
          <button class="btn-confirm" @click="saveGroupSettings">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGroupMessages, sendGroupMessage, updateGroup } from '@/utils/api.js'
import { getSocket } from '@/utils/socket.js'

const route = useRoute()
const router = useRouter()
const userId = ref(0)
const groupId = ref(0)
const groupName = ref('')
const memberCount = ref(0)
const messages = ref([])
const inputText = ref('')
const messagesContainer = ref(null)
const showEmoji = ref(false)
const showGroupSettings = ref(false)
const editGroupName = ref('')
const editAnnouncement = ref('')
const senderNames = ref({})

const emojis = ['😀','😂','🥰','😎','🤔','😢','👍','❤️','🔥','🎉','👋','🙏','💪','✨','🌟','💯','🎵','📷','🍕','☕']

onMounted(() => {
  userId.value = parseInt(localStorage.getItem('userId'))
  groupId.value = parseInt(route.query.groupId)
  groupName.value = route.query.groupName || '群组'
  editGroupName.value = groupName.value
  loadMessages()
  const socket = getSocket()
  if (socket) {
    socket.on('group_message', handleNewMessage)
  }
})

onUnmounted(() => {
  const socket = getSocket()
  if (socket) {
    socket.off('group_message', handleNewMessage)
  }
})

const loadMessages = async () => {
  try {
    const res = await getGroupMessages(groupId.value)
    if (res.code === 200) {
      messages.value = res.data.messages || []
      memberCount.value = res.data.members?.length || 0
      res.data.members?.forEach(m => {
        senderNames.value[m.userId] = m.nickname || m.username
      })
      scrollToBottom()
    }
  } catch (error) {
  }
}

const handleNewMessage = (data) => {
  if (data.groupId === groupId.value) {
    messages.value.push(data)
    scrollToBottom()
  }
}

const sendMessage = async () => {
  if (!inputText.value.trim()) return
  const content = inputText.value.trim()
  const tempMsg = {
    id: Date.now(),
    senderId: userId.value,
    groupId: groupId.value,
    content,
    createdAt: new Date().toISOString()
  }
  messages.value.push(tempMsg)
  inputText.value = ''
  showEmoji.value = false
  scrollToBottom()

  try {
    const res = await sendGroupMessage(userId.value, groupId.value, content)
    if (res.code === 200) {
      const socket = getSocket()
      if (socket) {
        socket.emit('send_group_message', res.data)
      }
    }
  } catch (error) {
  }
}

const insertEmoji = (emoji) => {
  inputText.value += emoji
}

const getSenderName = (senderId) => {
  return senderNames.value[senderId] || '用户'
}

const formatMessage = (content) => {
  if (!content) return ''
  let html = content
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/\n/g, '<br>')
  return html
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

const saveGroupSettings = async () => {
  try {
    const res = await updateGroup(groupId.value, userId.value, editGroupName.value, editAnnouncement.value)
    if (res.code === 200) {
      groupName.value = editGroupName.value
      showGroupSettings.value = false
    }
  } catch (error) {
    alert(error.message || '保存设置失败')
  }
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
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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
.icon-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
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
  background: linear-gradient(135deg, #f093fb, #f5576c);
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
.sender-name {
  font-size: 12px;
  font-weight: bold;
  color: var(--primary);
  margin-bottom: 4px;
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
}
.msg-time {
  font-size: 11px;
  opacity: 0.7;
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
  background: linear-gradient(135deg, #f093fb, #f5576c);
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
.setting-item {
  margin-bottom: 12px;
}
.setting-item span {
  font-size: 13px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 4px;
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
.setting-textarea {
  width: 100%;
  height: 80px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  resize: none;
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
  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: #fff;
}
</style>
