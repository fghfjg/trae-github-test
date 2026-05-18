import { getBaseUrl } from './config.js'

function getToken() {
  return localStorage.getItem('token')
}

function request(url, method = 'GET', data = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (data && method !== 'GET') opts.body = JSON.stringify(data)
  return fetch(getBaseUrl() + url, opts)
    .then(res => res.json())
    .then(result => {
      if (result.code === 200) return result
      return Promise.reject(result)
    })
}

export function register(username, password, nickname) {
  return request('/register', 'POST', { username, password, nickname })
}

export function login(username, password) {
  return request('/login', 'POST', { username, password })
}

export function getUserInfo(userId) {
  return request(`/user/${userId}`, 'GET')
}

export function updateUserInfo(userId, data) {
  return request(`/user/${userId}`, 'PUT', data)
}

export function getFriends(userId) {
  return request(`/friends/${userId}`, 'GET')
}

export function addFriend(userId, friendUsername) {
  return request('/friends/add', 'POST', { userId, friendUsername })
}

export function removeFriend(userId, friendId) {
  return request(`/friends/${userId}/${friendId}`, 'DELETE')
}

export function addToBlacklist(userId, targetId) {
  return request('/friends/blacklist', 'POST', { userId, targetId })
}

export function searchUsers(keyword) {
  return request(`/users/search?keyword=${encodeURIComponent(keyword)}`, 'GET')
}

export function getMessages(userId1, userId2) {
  return request(`/messages/${userId1}/${userId2}`, 'GET')
}

export function recallMessage(userId, messageId) {
  return request('/messages/recall', 'POST', { userId, messageId })
}

export function markRead(userId, messageId) {
  return request('/messages/read', 'POST', { userId, messageId })
}

export function searchMessages(userId, keyword) {
  return request(`/messages/search?userId=${userId}&keyword=${encodeURIComponent(keyword)}`, 'GET')
}

export function createGroup(name, creatorId, members, isPublic, avatar, announcement) {
  return request('/groups', 'POST', { name, creatorId, members, isPublic, avatar, announcement })
}

export function getUserGroups(userId) {
  return request(`/groups/${userId}`, 'GET')
}

export function addGroupMembers(groupId, userId, memberIds) {
  return request(`/groups/${groupId}/members`, 'POST', { userId, memberIds })
}

export function removeGroupMember(groupId, memberId) {
  return request(`/groups/${groupId}/members/${memberId}`, 'DELETE')
}

export function updateGroup(groupId, data) {
  return request(`/groups/${groupId}`, 'PUT', data)
}

export function dissolveGroup(groupId, userId) {
  return request(`/groups/${groupId}`, 'DELETE', { userId })
}

export function getGroupMessages(groupId) {
  return request(`/groups/${groupId}/messages`, 'GET')
}
