const isProd = import.meta.env.PROD || window.location.host.includes('railway.app')

const RAILWAY_DOMAIN = 'trae-github-test-production.up.railway.app'

const API_BASE_URL = isProd ? '' : 'http://localhost:3000'

let WS_BASE_URL = ''
if (isProd) {
  const protocol = 'wss://'
  const host = window.location.host || RAILWAY_DOMAIN
  WS_BASE_URL = protocol + host
} else {
  WS_BASE_URL = 'http://localhost:3000'
}

export { API_BASE_URL, WS_BASE_URL }

export function getBaseUrl() {
  return API_BASE_URL + '/api'
}

export function getSocketUrl() {
  return WS_BASE_URL
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