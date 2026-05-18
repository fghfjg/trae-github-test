import { getBaseUrl } from './config.js'

// 获取本地存储的Token
function getToken() {
  return localStorage.getItem('token')
}

// 统一请求封装
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

// 注册
export function register(username, password, nickname) {
  return request('/register', 'POST', { username, password, nickname })
}

// 登录
export function login(username, password) {
  return request('/login', 'POST', { username, password })
}

// 获取用户信息
export function getUserInfo(userId) {
  return request(`/user/${userId}`, 'GET')
}

// 更新用户信息
export function updateUserInfo(userId, data) {
  return request(`/user/${userId}`, 'PUT', data)
}

// 获取好友列表
export function getFriends(userId) {
  return request(`/friends/${userId}`, 'GET')
}

// 添加好友
export function addFriend(userId, friendUsername) {
  return request('/friends/add', 'POST', { userId, friendUsername })
}

// 删除好友
export function removeFriend(userId, friendId) {
  return request(`/friends/${userId}/${friendId}`, 'DELETE')
}

// 加入黑名单
export function addToBlacklist(userId, targetId) {
  return request('/friends/blacklist', 'POST', { userId, targetId })
}

// 搜索用户
export function searchUsers(keyword) {
  return request(`/users/search?keyword=${encodeURIComponent(keyword)}`, 'GET')
}

// 获取历史消息
export function getMessages(userId1, userId2) {
  return request(`/messages/${userId1}/${userId2}`, 'GET')
}

// 撤回消息
export function recallMessage(userId, messageId) {
  return request('/messages/recall', 'POST', { userId, messageId })
}

// 标记已读
export function markRead(userId, messageId) {
  return request('/messages/read', 'POST', { userId, messageId })
}

// 搜索消息
export function searchMessages(userId, keyword) {
  return request(`/messages/search?userId=${userId}&keyword=${encodeURIComponent(keyword)}`, 'GET')
}

// 创建群组
export function createGroup(name, creatorId, members, isPublic, avatar, announcement) {
  return request('/groups', 'POST', { name, creatorId, members, isPublic, avatar, announcement })
}

// 获取用户群组
export function getUserGroups(userId) {
  return request(`/groups/${userId}`, 'GET')
}

// 添加群组成员
export function addGroupMembers(groupId, userId, memberIds) {
  return request(`/groups/${groupId}/members`, 'POST', { userId, memberIds })
}

// 移除群组成员
export function removeGroupMember(groupId, memberId) {
  return request(`/groups/${groupId}/members/${memberId}`, 'DELETE')
}

// 更新群组
export function updateGroup(groupId, data) {
  return request(`/groups/${groupId}`, 'PUT', data)
}

// 解散群组
export function dissolveGroup(groupId, userId) {
  return request(`/groups/${groupId}`, 'DELETE', { userId })
}

// 获取群组消息
export function getGroupMessages(groupId) {
  return request(`/groups/${groupId}/messages`, 'GET')
}

// 发送私聊消息（HTTP备用，主要使用WebSocket）
export function sendMessage(userId, receiverId, content, type) {
  return request('/messages', 'POST', { userId, receiverId, content, type })
}

// 删除消息
export function deleteMessage(userId, messageId) {
  return request('/messages/delete', 'POST', { userId, messageId })
}

// 上传文件
export function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  return fetch(getBaseUrl() + '/upload/file', {
    method: 'POST',
    body: formData
  }).then(res => res.json())
}

// 上传图片
export function uploadImage(file) {
  const formData = new FormData()
  formData.append('image', file)
  return fetch(getBaseUrl() + '/upload/image', {
    method: 'POST',
    body: formData
  }).then(res => res.json())
}

// 发送群聊消息
export function sendGroupMessage(groupId, userId, content, type) {
  return request(`/groups/${groupId}/messages`, 'POST', { userId, content, type })
}
