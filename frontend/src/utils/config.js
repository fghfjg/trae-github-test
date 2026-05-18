// 环境判断：生产环境（Railway部署）使用空字符串，开发环境使用本地地址
const isProd = import.meta.env.PROD

// API基础地址：生产环境使用相对路径（同源），开发环境使用本地后端
const API_BASE_URL = isProd ? '' : 'http://localhost:3000'
// WebSocket基础地址：生产环境使用当前域名（自动wss://），开发环境使用本地
const WS_BASE_URL = isProd ? window.location.origin : 'http://localhost:3000'

export { API_BASE_URL, WS_BASE_URL }

// 获取API基础URL（带/api前缀）
export function getBaseUrl() {
  return API_BASE_URL + '/api'
}

// 获取WebSocket连接URL
export function getSocketUrl() {
  return WS_BASE_URL || window.location.origin
}

// 检查服务器连接状态
export function checkServerConnection() {
  return fetch((API_BASE_URL || '') + '/api/health', {
    method: 'GET',
    signal: AbortSignal.timeout(5000)
  })
    .then(res => res.json())
    .then(data => data.code === 200)
    .catch(() => false)
}
