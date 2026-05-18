const isProd = import.meta.env.PROD

const API_BASE_URL = isProd ? '' : 'http://localhost:3000'
const WS_BASE_URL = isProd ? '' : 'http://localhost:3000'

export { API_BASE_URL, WS_BASE_URL }

export function getBaseUrl() {
  return API_BASE_URL + '/api'
}

export function getSocketUrl() {
  return WS_BASE_URL || window.location.origin
}

export function checkServerConnection() {
  return fetch((API_BASE_URL || '') + '/api/health', {
    method: 'GET',
    signal: AbortSignal.timeout(5000)
  })
    .then(res => res.json())
    .then(data => data.code === 200)
    .catch(() => false)
}
