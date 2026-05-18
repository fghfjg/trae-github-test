import { io } from 'socket.io-client'
import { getSocketUrl } from './config.js'

let socket = null
let heartbeatTimer = null

export function initSocket(userId) {
  if (socket) {
    socket.disconnect()
    socket = null
  }

  socket = io(getSocketUrl(), {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 999,
    timeout: 20000,
    forceNew: true,
    autoConnect: true
  })

  socket.on('connect', () => {
    if (userId) {
      socket.emit('user_login', userId)
    }
    startHeartbeat()
  })

  socket.on('disconnect', () => {
    stopHeartbeat()
  })

  socket.on('connect_error', (error) => {
    stopHeartbeat()
  })

  socket.on('reconnect', () => {
    if (userId) {
      socket.emit('user_login', userId)
    }
    startHeartbeat()
  })

  return socket
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    if (socket && socket.connected) {
      socket.emit('ping')
    }
  }, 25000)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  stopHeartbeat()
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function reconnectSocket(userId) {
  return initSocket(userId)
}
