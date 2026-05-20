import { io } from 'socket.io-client'
import { getSocketUrl } from './config.js'

let socket = null
let heartbeatTimer = null
let reconnectTimer = null
let currentUserId = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 15
let connectionStatus = 'disconnected'

const messageCallbacks = new Map()

export function getConnectionStatus() {
  return connectionStatus
}

export function initSocket(userId) {
  currentUserId = userId

  if (socket) {
    socket.disconnect()
    socket = null
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectAttempts = 0
  connectionStatus = 'connecting'

  const socketUrl = getSocketUrl()
  console.log('[Socket] 正在连接:', socketUrl, 'userId:', userId)
  console.log('[Socket] 协议:', window.location.protocol === 'https:' ? 'wss' : 'ws')

  socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    timeout: 10000,
    autoConnect: true,
    upgrade: true,
    secure: window.location.protocol === 'https:',
    withCredentials: true,
    path: '/socket.io'
  })

  socket.on('connect', () => {
    console.log('[Socket] 连接成功, Socket ID:', socket.id)
    connectionStatus = 'connected'
    reconnectAttempts = 0
    if (currentUserId) {
      socket.emit('user_login', currentUserId)
      console.log('[Socket] 已发送用户登录, userId:', currentUserId)
    }
    startHeartbeat()
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] 连接断开, 原因:', reason)
    connectionStatus = 'disconnected'
    stopHeartbeat()
    if (reason === 'io server disconnect') {
      socket.connect()
    }
  })

  socket.on('connect_error', (error) => {
    console.error('[Socket] 连接错误:', error.message)
    connectionStatus = 'error'
    stopHeartbeat()
    handleReconnect()
  })

  socket.on('reconnect', (attemptNumber) => {
    console.log('[Socket] 重连成功, 尝试次数:', attemptNumber)
    connectionStatus = 'connected'
    reconnectAttempts = 0
    if (currentUserId) {
      socket.emit('user_login', currentUserId)
      console.log('[Socket] 重连后已发送用户登录, userId:', currentUserId)
    }
    startHeartbeat()
  })

  socket.on('reconnect_failed', () => {
    console.error('[Socket] 重连失败，已达最大尝试次数')
    connectionStatus = 'disconnected'
    stopHeartbeat()
  })

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('[Socket] 正在重连, 尝试次数:', attemptNumber)
    connectionStatus = 'connecting'
    reconnectAttempts = attemptNumber
  })

  socket.on('receive_message', (data) => {
    console.log('[Socket] 收到消息:', JSON.stringify(data))
    const callbacks = messageCallbacks.get('receive_message')
    console.log('[Socket] receive_message 回调数量:', callbacks ? callbacks.length : 0)
    callbacks?.forEach(cb => {
      try {
        cb(data)
        console.log('[Socket] 回调执行成功')
      } catch (e) {
        console.error('[Socket] 回调执行失败:', e)
      }
    })
  })

  socket.on('message_sent', (data) => {
    console.log('[Socket] 消息已发送确认:', data)
    messageCallbacks.get('message_sent')?.forEach(cb => cb(data))
  })

  socket.on('user_status_changed', (data) => {
    console.log('[Socket] 用户状态变化:', JSON.stringify(data))
    const callbacks = messageCallbacks.get('user_status_changed')
    console.log('[Socket] user_status_changed 回调数量:', callbacks ? callbacks.length : 0)
    callbacks?.forEach(cb => {
      try {
        cb(data)
        console.log('[Socket] 用户状态回调执行成功')
      } catch (e) {
        console.error('[Socket] 用户状态回调执行失败:', e)
      }
    })
  })

  socket.on('user_typing', (data) => {
    console.log('[Socket] 用户正在输入:', data)
    messageCallbacks.get('user_typing')?.forEach(cb => cb(data))
  })

  socket.on('message_recalled', (data) => {
    console.log('[Socket] 消息已撤回:', data)
    messageCallbacks.get('message_recalled')?.forEach(cb => cb(data))
  })

  socket.on('pong', () => {
    console.log('[Socket] 收到心跳响应')
  })

  socket.on('error', (error) => {
    console.error('[Socket] Socket错误:', error)
  })

  return socket
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    if (socket && socket.connected) {
      socket.emit('ping')
      console.log('[Socket] 发送心跳包')
    }
  }, 30000)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function handleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[Socket] 重连失败，已达最大尝试次数')
    return
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
  }
  const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), 30000)
  reconnectTimer = setTimeout(() => {
    console.log('[Socket] 尝试重连...')
    if (socket) {
      socket.connect()
    } else if (currentUserId) {
      initSocket(currentUserId)
    }
  }, delay)
  reconnectAttempts++
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  stopHeartbeat()
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (socket) {
    socket.disconnect()
    socket = null
  }
  currentUserId = null
  reconnectAttempts = 0
  messageCallbacks.clear()
  connectionStatus = 'disconnected'
  console.log('[Socket] 已断开连接')
}

export function reconnectSocket(userId) {
  console.log('[Socket] 手动重连, userId:', userId)
  return initSocket(userId)
}

export function sendMessage(senderId, receiverId, content, type = 'text') {
  if (!socket || !socket.connected) {
    console.error('[Socket] 发送消息失败：Socket未连接')
    return false
  }
  try {
    const messageData = JSON.stringify({
      senderId,
      receiverId,
      content: content.trim(),
      type
    })
    socket.emit('send_message', messageData)
    console.log('[Socket] 发送消息:', messageData)
    return true
  } catch (error) {
    console.error('[Socket] 发送消息失败:', error)
    return false
  }
}

export function sendGroupMessage(senderId, groupId, content, type = 'text') {
  if (!socket || !socket.connected) {
    console.error('[Socket] 发送群消息失败：Socket未连接')
    return false
  }
  try {
    const messageData = JSON.stringify({
      senderId,
      groupId,
      content: content.trim(),
      type
    })
    socket.emit('send_group_message', messageData)
    console.log('[Socket] 发送群消息:', messageData)
    return true
  } catch (error) {
    console.error('[Socket] 发送群消息失败:', error)
    return false
  }
}

export function recallMessage(messageId, senderId, receiverId) {
  if (!socket || !socket.connected) {
    console.error('[Socket] 撤回消息失败：Socket未连接')
    return false
  }
  try {
    const data = JSON.stringify({ messageId, senderId, receiverId })
    socket.emit('recall_message', data)
    console.log('[Socket] 撤回消息:', data)
    return true
  } catch (error) {
    console.error('[Socket] 撤回消息失败:', error)
    return false
  }
}

export function on(eventName, callback) {
  if (!messageCallbacks.has(eventName)) {
    messageCallbacks.set(eventName, [])
  }
  messageCallbacks.get(eventName).push(callback)
}

export function off(eventName, callback) {
  const callbacks = messageCallbacks.get(eventName)
  if (callbacks) {
    const index = callbacks.indexOf(callback)
    if (index !== -1) {
      callbacks.splice(index, 1)
    }
  }
}
