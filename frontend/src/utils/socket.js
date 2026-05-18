import { io } from 'socket.io-client'
import { getSocketUrl } from './config.js'

let socket = null
let heartbeatTimer = null
let reconnectTimer = null
let currentUserId = null

// 初始化WebSocket连接
export function initSocket(userId) {
  currentUserId = userId

  // 如果已有连接，先断开
  if (socket) {
    socket.disconnect()
    socket = null
  }

  // 清除重连定时器
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  const socketUrl = getSocketUrl()
  console.log('[Socket] 正在连接:', socketUrl)

  socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 999,
    timeout: 20000,
    forceNew: true,
    autoConnect: true
  })

  // 连接成功
  socket.on('connect', () => {
    console.log('[Socket] 连接成功, Socket ID:', socket.id)
    // 登录用户
    if (currentUserId) {
      socket.emit('user_login', currentUserId)
      console.log('[Socket] 已发送用户登录, userId:', currentUserId)
    }
    startHeartbeat()
  })

  // 连接断开
  socket.on('disconnect', (reason) => {
    console.log('[Socket] 连接断开, 原因:', reason)
    stopHeartbeat()
  })

  // 连接错误
  socket.on('connect_error', (error) => {
    console.error('[Socket] 连接错误:', error.message)
    stopHeartbeat()
  })

  // 重连成功
  socket.on('reconnect', (attemptNumber) => {
    console.log('[Socket] 重连成功, 尝试次数:', attemptNumber)
    if (currentUserId) {
      socket.emit('user_login', currentUserId)
      console.log('[Socket] 重连后已发送用户登录, userId:', currentUserId)
    }
    startHeartbeat()
  })

  // 重连失败
  socket.on('reconnect_failed', () => {
    console.error('[Socket] 重连失败')
    stopHeartbeat()
  })

  // 监听服务器消息
  socket.on('receive_message', (data) => {
    console.log('[Socket] 收到消息:', data)
  })

  socket.on('message_sent', (data) => {
    console.log('[Socket] 消息已发送确认:', data)
  })

  socket.on('user_status_changed', (data) => {
    console.log('[Socket] 用户状态变化:', data)
  })

  socket.on('user_typing', (data) => {
    console.log('[Socket] 用户正在输入:', data)
  })

  socket.on('message_recalled', (data) => {
    console.log('[Socket] 消息已撤回:', data)
  })

  return socket
}

// 启动心跳保活
function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    if (socket && socket.connected) {
      socket.emit('ping')
      console.log('[Socket] 发送心跳包')
    }
  }, 25000)
}

// 停止心跳
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

// 获取当前Socket实例
export function getSocket() {
  return socket
}

// 断开连接
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
  console.log('[Socket] 已断开连接')
}

// 手动重连
export function reconnectSocket(userId) {
  console.log('[Socket] 手动重连, userId:', userId)
  return initSocket(userId)
}
