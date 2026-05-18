<template>
  <div class="container">
    <div class="header">
      <button class="back-btn" @click="goBack">←</button>
      <div class="header-info">
        <span class="header-name">{{ friendName }}</span>
        <span class="header-status" v-if="isTyping">对方正在输入...</span>
        <span class="header-status" v-else>{{ statusText }}</span>
      </div>
      <div class="header-right">
        <button class="icon-btn" @click="showSearch = !showSearch" title="搜索">🔍</button>
        <button class="icon-btn" @click="showMenu = !showMenu" title="更多">⋮</button>
      </div>
    </div>

    <div v-if="showSearch" class="search-bar">
      <input class="search-input" v-model="searchKeyword" placeholder="搜索消息..." @input="handleSearch" />
      <div v-if="searchResults.length" class="search-results">
        <div v-for="msg in searchResults" :key="msg.id" class="search-item" @click="scrollToMessage(msg.id)">
          <span class="search-item-text">{{ msg.content }}</span>
          <span class="search-item-time">{{ formatTime(msg.createdAt) }}</span>
        </div>
      </div>
    </div>

    <div class="messages" ref="messagesContainer">
      <div v-if="messages.length === 0" class="empty-chat">
        <span class="empty-icon">💬</span>
        <span class="empty-text">还没有消息</span>
        <span class="empty-tip">发送第一条消息开始聊天</span>
      </div>
      <div v-for="msg in messages" :key="msg.id" :id="'msg-' + msg.id" class="message-wrapper">
        <div :class="['message', msg.senderId === userId ? 'sent' : 'received']" @contextmenu.prevent="showMessageMenu(msg, $event)">
          <div v-if="msg.recalled" class="recalled-msg">消息已撤回</div>
          <template v-else>
            <div v-if="msg.type === 'image'" class="image-msg" @click="openImagePreview(msg.content)">
              <img :src="msg.content" alt="Image" />
            </div>
            <div v-else-if="msg.type === 'file'" class="file-msg">
              <span class="file-icon">📎</span>
              <div class="file-info">
                <span class="file-name">{{ msg.fileName }}</span>
                <span class="file-size">{{ formatFileSize(msg.fileSize) }}</span>
              </div>
              <a :href="msg.content" download class="file-download">⬇</a>
            </div>
            <div v-else-if="msg.type === 'voice'" class="voice-msg">
              <button class="voice-play-btn" @click="playVoice(msg)">▶</button>
              <div class="voice-waveform">
                <span v-for="i in 20" :key="i" class="wave-bar" :style="{ height: Math.random() * 20 + 5 + 'px' }"></span>
              </div>
              <span class="voice-duration">{{ msg.duration }}s</span>
            </div>
            <div v-else class="text-msg">
              <div v-if="msg.quote" class="quote-msg" @click="scrollToMessage(msg.quoteId)">
                <span class="quote-text">{{ msg.quote }}</span>
              </div>
              <div class="msg-content" v-html="formatMessage(msg.content)"></div>
            </div>
            <div class="msg-footer">
              <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
              <span v-if="msg.senderId === userId" class="msg-status">{{ getStatusIcon(msg.status) }}</span>
            </div>
          </template>
        </div>
      </div>
      <div v-if="showTypingIndicator" class="typing-indicator">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <div v-if="quotingMessage" class="quote-preview">
      <span class="quote-preview-text">回复：{{ quotingMessage.content }}</span>
      <button class="quote-cancel" @click="quotingMessage = null">×</button>
    </div>

    <div class="input-area">
      <button class="input-btn" @click="showEmoji = !showEmoji" title="表情">😊</button>
      <button class="input-btn" @click="triggerFileUpload" title="文件">📎</button>
      <button class="input-btn" @click="triggerImageUpload" title="图片">🖼️</button>
      <input type="file" ref="fileInput" style="display:none" @change="handleFileUpload" accept=".pdf,.zip,.docx,.txt" />
      <input type="file" ref="imageInput" style="display:none" @change="handleImageUpload" accept="image/*" />
      <input class="message-input" v-model="inputText" placeholder="输入消息..." @keyup.enter="sendMessage" @input="handleTyping" />
      <button class="send-btn" @click="sendMessage" :disabled="!inputText.trim()">发送</button>
    </div>

    <div v-if="showEmoji" class="emoji-panel">
      <div class="emoji-tabs">
        <button :class="['emoji-tab', emojiTab === 'emoji' ? 'active' : '']" @click="emojiTab = 'emoji'">表情</button>
        <button :class="['emoji-tab', emojiTab === 'sticker' ? 'active' : '']" @click="emojiTab = 'sticker'">贴纸</button>
      </div>
      <div class="emoji-grid" v-if="emojiTab === 'emoji'">
        <span v-for="emoji in emojis" :key="emoji" class="emoji-item" @click="insertEmoji(emoji)">{{ emoji }}</span>
      </div>
      <div class="sticker-grid" v-else>
        <span v-for="sticker in stickers" :key="sticker" class="sticker-item" @click="insertEmoji(sticker)">{{ sticker }}</span>
      </div>
    </div>

    <div v-if="showMessageMenu" class="message-context-menu" :style="{ top: menuPosition.y + 'px', left: menuPosition.x + 'px' }">
      <div class="menu-item" @click="copyMessage">📋 复制</div>
      <div class="menu-item" @click="quoteMessage">️ 回复</div>
      <div class="menu-item" @click="recallMessage" v-if="canRecall(selectedMessage)">↩️ 撤回</div>
      <div class="menu-item danger" @click="deleteMessage">🗑 删除</div>
    </div>

    <div v-if="showImagePreview" class="image-preview" @click="closeImagePreview">
      <img :src="previewImageUrl" alt="Preview" @click.stop />
      <div class="preview-actions">
        <a :href="previewImageUrl" download class="preview-btn">⬇ 下载</a>
        <button class="preview-btn" @click="closeImagePreview">✕ 关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMessages, recallMessage as recallMsgApi, deleteMessage as deleteMsgApi, uploadFile, uploadImage } from '@/utils/api.js'
import { getSocket } from '@/utils/socket.js'

const route = useRoute()
const router = useRouter()
const userId = ref(0)
const friendId = ref(0)
const friendName = ref('')
const messages = ref([])
const inputText = ref('')
const messagesContainer = ref(null)
const isTyping = ref(false)
const showSearch = ref(false)
const searchKeyword = ref('')
const searchResults = ref([])
const showMenu = ref(false)
const showEmoji = ref(false)
const emojiTab = ref('emoji')
const quotingMessage = ref(null)
const showMessageMenu = ref(false)
const selectedMessage = ref(null)
const menuPosition = ref({ x: 0, y: 0 })
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const fileInput = ref(null)
const imageInput = ref(null)
const typingTimeout = ref(null)
const showTypingIndicator = ref(false)

const emojis = ['😀','😂','🥰','😎','🤔','😢','😡','👍','👎','❤️','🔥','🎉','👋','🙏','💪','🤝','✨','🌟','💯','🎵','📷','📱','💻','🏠','🚗','✈️','🍕','🍔','🍺','☕','🌈','🌙','⭐','🎁','🏆','💎','📚','🎮','⚽','🏀']
const stickers = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦞']

let searchTimer = null

onMounted(() => {
  userId.value = parseInt(localStorage.getItem('userId'))
  friendId.value = parseInt(route.query.friendId)
  friendName.value = route.query.friendName || '好友'
  loadMessages()
  loadLocalMessages()
  const socket = getSocket()
  if (socket) {
    socket.on('receive_message', handleNewMessage)
    socket.on('message_status', handleMessageStatus)
    socket.on('user_typing', handleTypingEvent)
    socket.on('message_recalled', handleMessageRecalled)
  }
})

onUnmounted(() => {
  const socket = getSocket()
  if (socket) {
    socket.off('receive_message', handleNewMessage)
    socket.off('message_status', handleMessageStatus)
    socket.off('user_typing', handleTypingEvent)
    socket.off('message_recalled', handleMessageRecalled)
  }
  clearTimeout(typingTimeout.value)
})

const statusText = computed(() => {
  return '点击开始聊天'
})

const loadMessages = async () => {
  try {
    const res = await getMessages(userId.value, friendId.value)
    if (res.code === 200) {
      messages.value = res.data.map(m => ({
        ...m,
        status: m.senderId === userId.value ? (m.status || 'sent') : 'read'
      }))
      saveLocalMessages()
      scrollToBottom()
    }
  } catch (error) {
    alert(error.message || '加载消息失败')
  }
}

const loadLocalMessages = () => {
  const key = `chat_${userId.value}_${friendId.value}`
  const local = localStorage.getItem(key)
  if (local) {
    try {
      const parsed = JSON.parse(local)
      if (parsed && parsed.length > 0) {
        messages.value = parsed
      }
    } catch (e) {
    }
  }
}

const saveLocalMessages = () => {
  const key = `chat_${userId.value}_${friendId.value}`
  localStorage.setItem(key, JSON.stringify(messages.value.slice(-200)))
}

const handleNewMessage = (data) => {
  const isRelevant = (data.senderId === friendId.value && data.receiverId === userId.value) ||
    (data.senderId === userId.value && data.receiverId === friendId.value)
  if (!isRelevant) return

  const exists = messages.value.find(m => m.id === data.id)
  if (exists) {
    exists.status = data.senderId === userId.value ? 'read' : 'read'
    return
  }

  const newMsg = {
    ...data,
    status: data.senderId === userId.value ? 'delivered' : 'read'
  }
  messages.value.push(newMsg)
  saveLocalMessages()
  scrollToBottom()

  if (data.receiverId === userId.value) {
    const socket = getSocket()
    if (socket) {
      socket.emit('message_read', { messageId: data.id, senderId: data.senderId })
    }
  }
}

const handleMessageStatus = (data) => {
  const msg = messages.value.find(m => m.id === data.messageId)
  if (msg) {
    msg.status = data.status
  }
}

const handleTypingEvent = (data) => {
  if (data.userId === friendId.value) {
    isTyping.value = data.isTyping
    if (data.isTyping) {
      clearTimeout(typingTimeout.value)
      typingTimeout.value = setTimeout(() => {
        isTyping.value = false
      }, 3000)
    }
  }
}

const handleMessageRecalled = (data) => {
  const msg = messages.value.find(m => m.id === data.messageId)
  if (msg) {
    msg.recalled = true
    msg.content = '[Message recalled]'
    saveLocalMessages()
  }
}

const sendMessage = () => {
  if (!inputText.value.trim()) return
  const content = inputText.value.trim()
  const msgId = Date.now() + Math.random()
  const tempMsg = {
    id: msgId,
    senderId: userId.value,
    receiverId: friendId.value,
    content,
    messageType: 'text',
    mediaUrl: '',
    replyTo: quotingMessage.value ? quotingMessage.value.id : null,
    recalled: false,
    read: false,
    status: 'sending',
    createdAt: new Date().toISOString()
  }
  messages.value.push(tempMsg)
  inputText.value = ''
  quotingMessage.value = null
  showEmoji.value = false
  scrollToBottom()
  saveLocalMessages()

  const socket = getSocket()
  if (socket) {
    socket.emit('send_message', tempMsg)
  }
}

const handleTyping = () => {
  const socket = getSocket()
  if (socket) {
    socket.emit('typing', { userId: userId.value, receiverId: friendId.value, isTyping: true })
  }
  clearTimeout(typingTimeout.value)
  typingTimeout.value = setTimeout(() => {
    const socket = getSocket()
    if (socket) {
      socket.emit('typing', { userId: userId.value, receiverId: friendId.value, isTyping: false })
    }
  }, 2000)
}

const handleSearch = () => {
  clearTimeout(searchTimer)
  if (!searchKeyword.value.trim()) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(() => {
    const keyword = searchKeyword.value.toLowerCase()
    searchResults.value = messages.value.filter(m =>
      m.content && m.content.toLowerCase().includes(keyword)
    ).slice(-20)
  }, 200)
}

const scrollToMessage = (msgId) => {
  const el = document.getElementById('msg-' + msgId)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight')
    setTimeout(() => el.classList.remove('highlight'), 2000)
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const formatMessage = (content) => {
  if (!content) return ''
  let html = content
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>')
  html = html.replace(/`(.*?)`/g, '<code>$1</code>')
  html = html.replace(/\n/g, '<br>')
  const urlRegex = /(https?:\/\/[^\s]+)/g
  html = html.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>')
  return html
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const getStatusIcon = (status) => {
  switch (status) {
    case 'sending': return '⏳'
    case 'sent': return '✓'
    case 'delivered': return '✓✓'
    case 'read': return '✓✓'
    default: return ''
  }
}

const canRecall = (msg) => {
  if (!msg || msg.senderId !== userId.value) return false
  const elapsed = (Date.now() - new Date(msg.createdAt).getTime()) / 1000
  return elapsed < 120
}

const showMessageMenu = (msg, event) => {
  selectedMessage.value = msg
  menuPosition.value = { x: event.clientX, y: event.clientY }
  showMessageMenu.value = true
}

const copyMessage = () => {
  if (selectedMessage.value && !selectedMessage.value.recalled) {
    navigator.clipboard.writeText(selectedMessage.value.content)
  }
  showMessageMenu.value = false
}

const quoteMessage = () => {
  if (selectedMessage.value && !selectedMessage.value.recalled) {
    quotingMessage.value = selectedMessage.value
  }
  showMessageMenu.value = false
}

const recallMessage = async () => {
  if (!selectedMessage.value) return
  try {
    const res = await recallMsgApi(userId.value, selectedMessage.value.id)
    if (res.code === 200) {
      selectedMessage.value.recalled = true
      selectedMessage.value.content = '[Message recalled]'
      saveLocalMessages()
      const socket = getSocket()
      if (socket) {
        socket.emit('message_recalled', { messageId: selectedMessage.value.id, receiverId: friendId.value })
      }
    }
  } catch (error) {
    alert(error.message || '撤回消息失败')
  }
  showMessageMenu.value = false
}

const deleteMessage = () => {
  if (!selectedMessage.value) return
  const idx = messages.value.findIndex(m => m.id === selectedMessage.value.id)
  if (idx !== -1) {
    messages.value.splice(idx, 1)
    saveLocalMessages()
  }
  showMessageMenu.value = false
}

const openImagePreview = (url) => {
  previewImageUrl.value = url
  showImagePreview.value = true
}

const closeImagePreview = () => {
  showImagePreview.value = false
  previewImageUrl.value = ''
}

const triggerFileUpload = () => {
  fileInput.value?.click()
}

const triggerImageUpload = () => {
  imageInput.value?.click()
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  formData.append('userId', userId.value)
  formData.append('receiverId', friendId.value)
  try {
    const res = await uploadFile(formData)
    if (res.code === 200) {
      messages.value.push({
        id: Date.now(),
        senderId: userId.value,
        receiverId: friendId.value,
        content: res.data.url,
        type: 'file',
        fileName: file.name,
        fileSize: file.size,
        status: 'sent',
        createdAt: new Date().toISOString()
      })
      saveLocalMessages()
      scrollToBottom()
    }
  } catch (error) {
    alert(error.message || '上传文件失败')
  }
  event.target.value = ''
}

const handleImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('image', file)
  formData.append('userId', userId.value)
  formData.append('receiverId', friendId.value)
  try {
    const res = await uploadImage(formData)
    if (res.code === 200) {
      messages.value.push({
        id: Date.now(),
        senderId: userId.value,
        receiverId: friendId.value,
        content: res.data.url,
        type: 'image',
        status: 'sent',
        createdAt: new Date().toISOString()
      })
      saveLocalMessages()
      scrollToBottom()
    }
  } catch (error) {
    alert(error.message || '上传图片失败')
  }
  event.target.value = ''
}

const insertEmoji = (emoji) => {
  inputText.value += emoji
}

const playVoice = (msg) => {
  alert('语音播放：' + msg.duration + '秒')
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
  max-height: 150px;
  overflow-y: auto;
}
.search-item {
  padding: 8px 12px;
  background: var(--bg-input);
  border-radius: 8px;
  margin-bottom: 4px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
}
.search-item-text {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-item-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 10px;
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
  margin-bottom: 4px;
}
.empty-tip {
  font-size: 12px;
  color: var(--text-muted);
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
.text-msg {
  font-size: 14px;
  line-height: 1.5;
}
.msg-content {
  word-wrap: break-word;
}
.msg-content a {
  color: #fff;
  text-decoration: underline;
}
.received .msg-content a {
  color: var(--primary);
}
.quote-msg {
  background: rgba(255,255,255,0.15);
  padding: 6px 10px;
  border-radius: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  cursor: pointer;
  border-left: 3px solid rgba(255,255,255,0.5);
}
.received .quote-msg {
  background: var(--bg-input);
  border-left-color: var(--primary);
}
.quote-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.msg-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}
.msg-time {
  font-size: 11px;
  opacity: 0.7;
}
.msg-status {
  font-size: 12px;
}
.image-msg {
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  max-width: 250px;
}
.image-msg img {
  width: 100%;
  display: block;
  border-radius: 12px;
}
.file-msg {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.1);
  padding: 10px;
  border-radius: 10px;
}
.received .file-msg {
  background: var(--bg-input);
}
.file-icon {
  font-size: 24px;
}
.file-info {
  flex: 1;
  min-width: 0;
}
.file-name {
  font-size: 13px;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-size {
  font-size: 11px;
  opacity: 0.7;
}
.file-download {
  font-size: 18px;
  color: inherit;
  text-decoration: none;
}
.voice-msg {
  display: flex;
  align-items: center;
  gap: 8px;
}
.voice-play-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  color: inherit;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
}
.voice-waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}
.wave-bar {
  width: 3px;
  background: currentColor;
  opacity: 0.5;
  border-radius: 2px;
}
.voice-duration {
  font-size: 12px;
  opacity: 0.7;
}
.typing-indicator {
  align-self: flex-start;
  padding: 10px 14px;
  background: var(--bg-card);
  border-radius: 16px;
  border: 1px solid var(--border);
}
.typing-dots span {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  margin: 0 2px;
  animation: typing 1.4s infinite;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}
.quote-preview {
  display: flex;
  align-items: center;
  padding: 8px 15px;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  gap: 10px;
}
.quote-preview-text {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quote-cancel {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-muted);
  cursor: pointer;
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
  max-height: 250px;
  overflow-y: auto;
}
.emoji-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}
.emoji-tab {
  flex: 1;
  padding: 10px;
  border: none;
  background: none;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.emoji-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
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
  transition: background 0.2s;
}
.emoji-item:hover {
  background: var(--bg-hover);
}
.sticker-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  padding: 12px;
}
.sticker-item {
  font-size: 32px;
  cursor: pointer;
  text-align: center;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;
}
.sticker-item:hover {
  background: var(--bg-hover);
}
.message-context-menu {
  position: fixed;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 4px 20px var(--shadow);
  z-index: 1000;
  min-width: 140px;
  overflow: hidden;
}
.menu-item {
  padding: 12px 16px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.2s;
}
.menu-item:hover {
  background: var(--bg-hover);
}
.menu-item.danger {
  color: #ff3b30;
}
.image-preview {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.image-preview img {
  max-width: 90%;
  max-height: 80%;
  border-radius: 8px;
}
.preview-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
.preview-btn {
  padding: 10px 20px;
  background: rgba(255,255,255,0.2);
  color: #fff;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
}
.preview-btn:hover {
  background: rgba(255,255,255,0.3);
}
.highlight {
  animation: highlight 2s ease;
}
@keyframes highlight {
  0%, 100% { background: transparent; }
  50% { background: rgba(102, 126, 234, 0.3); }
}
</style>
