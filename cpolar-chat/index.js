const express = require('express');
const cors = require('cors');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

const { Server } = require('socket.io');
const socketIo = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 120000,
  pingInterval: 30000,
  upgradeTimeout: 10000,
  path: '/socket.io',
  allowEIO3: true
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'chat-app-secret-key-2026';

function generateToken(userId) {
  return crypto.createHmac('sha256', JWT_SECRET).update(String(userId) + Date.now()).digest('hex');
}

const users = {};
const messages = [];
const groups = {};
const friendships = {};
const onlineUsers = {};
let userIdCounter = 1;
let groupIdCounter = 1;
let messageIdCounter = 1;

app.get('/api/health', (req, res) => {
  let onlineCount = 0;
  Object.values(onlineUsers).forEach(sockets => {
    onlineCount += sockets.length;
  });
  res.json({ code: 200, status: 'ok', onlineUsers: onlineCount });
});

app.post('/api/register', (req, res) => {
  try {
    const { username, password, nickname, avatar } = req.body;
    if (!username || !password) return res.status(400).json({ code: 400, message: 'Username and password required' });
    if (username.length < 2) return res.status(400).json({ code: 400, message: 'Username must be at least 2 characters' });
    if (password.length < 4) return res.status(400).json({ code: 400, message: 'Password must be at least 4 characters' });

    const existing = Object.values(users).find(u => u.username === username);
    if (existing) return res.status(400).json({ code: 400, message: 'Username already exists' });

    const userId = userIdCounter++;
    users[userId] = {
      userId, username, password,
      nickname: nickname || username,
      avatar: avatar || '',
      signature: '',
      status: 'offline',
      token: null,
      createdAt: new Date().toISOString()
    };
    friendships[userId] = { friends: [], groups: [], blacklist: [] };
    res.json({ code: 200, message: 'Registered', data: { userId, username, nickname: users[userId].nickname } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ code: 400, message: 'Username and password required' });
    const user = Object.values(users).find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ code: 401, message: 'Invalid credentials' });
    const token = generateToken(user.userId);
    user.token = token;
    res.json({ code: 200, message: 'Login success', data: { userId: user.userId, username: user.username, nickname: user.nickname, avatar: user.avatar, token } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.get('/api/user/:userId', (req, res) => {
  try {
    const user = users[parseInt(req.params.userId)];
    if (!user) return res.status(404).json({ code: 404, message: 'User not found' });
    const isOnline = onlineUsers[user.userId] && onlineUsers[user.userId].length > 0;
    res.json({ code: 200, data: { userId: user.userId, username: user.username, nickname: user.nickname, avatar: user.avatar, signature: user.signature, status: user.status, isOnline } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.put('/api/user/:userId', (req, res) => {
  try {
    const user = users[parseInt(req.params.userId)];
    if (!user) return res.status(404).json({ code: 404, message: 'User not found' });
    const { nickname, avatar, signature, status } = req.body;
    if (nickname !== undefined) user.nickname = nickname;
    if (avatar !== undefined) user.avatar = avatar;
    if (signature !== undefined) user.signature = signature;
    if (status !== undefined) user.status = status;
    res.json({ code: 200, message: 'Updated', data: { userId: user.userId, nickname: user.nickname, avatar: user.avatar, signature: user.signature, status: user.status } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.get('/api/friends/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const data = friendships[userId] || { friends: [], groups: [], blacklist: [] };
    const friendsWithStatus = data.friends.map(fId => {
      const u = users[fId];
      const isOnline = onlineUsers[fId] && onlineUsers[fId].length > 0;
      return u ? { id: u.userId, username: u.username, nickname: u.nickname, avatar: u.avatar, status: u.status, isOnline } : null;
    }).filter(Boolean);
    res.json({ code: 200, data: { friends: friendsWithStatus, groups: data.groups, blacklist: data.blacklist } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.post('/api/friends/add', (req, res) => {
  try {
    const { userId, friendUsername } = req.body;
    if (!userId || !friendUsername) return res.status(400).json({ code: 400, message: 'Missing params' });
    const target = Object.values(users).find(u => u.username === friendUsername);
    if (!target) return res.status(404).json({ code: 404, message: 'User not found' });
    if (target.userId === parseInt(userId)) return res.status(400).json({ code: 400, message: 'Cannot add yourself' });
    const fData = friendships[parseInt(userId)] || (friendships[parseInt(userId)] = { friends: [], groups: [], blacklist: [] });
    if (fData.friends.includes(target.userId)) return res.status(400).json({ code: 400, message: 'Already friends' });
    fData.friends.push(target.userId);
    const tData = friendships[target.userId] || (friendships[target.userId] = { friends: [], groups: [], blacklist: [] });
    tData.friends.push(parseInt(userId));
    res.json({ code: 200, message: 'Friend added', data: { friendId: target.userId, friendUsername: target.username, nickname: target.nickname } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.delete('/api/friends/:userId/:friendId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const friendId = parseInt(req.params.friendId);
    const fData = friendships[userId];
    if (fData) fData.friends = fData.friends.filter(id => id !== friendId);
    const tData = friendships[friendId];
    if (tData) tData.friends = tData.friends.filter(id => id !== userId);
    res.json({ code: 200, message: 'Friend removed' });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.post('/api/friends/blacklist', (req, res) => {
  try {
    const { userId, targetId } = req.body;
    if (!userId || !targetId) return res.status(400).json({ code: 400, message: 'Missing params' });
    const fData = friendships[parseInt(userId)] || (friendships[parseInt(userId)] = { friends: [], groups: [], blacklist: [] });
    if (!fData.blacklist.includes(parseInt(targetId))) fData.blacklist.push(parseInt(targetId));
    res.json({ code: 200, message: 'Added to blacklist' });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.get('/api/messages/:userId1/:userId2', (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    const chatMessages = messages.filter(m =>
      (m.senderId === parseInt(userId1) && m.receiverId === parseInt(userId2)) ||
      (m.senderId === parseInt(userId2) && m.receiverId === parseInt(userId1))
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json({ code: 200, data: { messages: chatMessages } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.post('/api/messages/recall', (req, res) => {
  try {
    const { userId, messageId } = req.body;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return res.status(404).json({ code: 404, message: 'Message not found' });
    if (msg.senderId !== parseInt(userId)) return res.status(403).json({ code: 403, message: 'Cannot recall others messages' });
    const elapsed = (Date.now() - new Date(msg.createdAt).getTime()) / 1000;
    if (elapsed > 120) return res.status(400).json({ code: 400, message: 'Cannot recall after 2 minutes' });
    msg.recalled = true;
    msg.content = '[Message recalled]';
    res.json({ code: 200, message: 'Message recalled', data: { messageId } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.post('/api/messages/read', (req, res) => {
  try {
    const { userId, messageId } = req.body;
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.receiverId === parseInt(userId)) {
      msg.read = true;
      msg.readAt = new Date().toISOString();
    }
    res.json({ code: 200, message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.get('/api/messages/search', (req, res) => {
  try {
    const { userId, keyword } = req.query;
    if (!userId || !keyword) return res.status(400).json({ code: 400, message: 'Missing params' });
    const results = messages.filter(m =>
      (m.senderId === parseInt(userId) || m.receiverId === parseInt(userId)) &&
      m.content && m.content.toLowerCase().includes(keyword.toLowerCase())
    );
    res.json({ code: 200, data: results });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.post('/api/messages/delete', (req, res) => {
  try {
    const { userId, messageId } = req.body;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return res.status(404).json({ code: 404, message: 'Message not found' });
    if (msg.senderId !== parseInt(userId) && msg.receiverId !== parseInt(userId)) {
      return res.status(403).json({ code: 403, message: 'Cannot delete others messages' });
    }
    msg.deleted = true;
    res.json({ code: 200, message: 'Message deleted', data: { messageId } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.post('/api/groups', (req, res) => {
  try {
    const { name, creatorId, members, isPublic, avatar, announcement } = req.body;
    if (!name || !creatorId) return res.status(400).json({ code: 400, message: 'Missing params' });
    const groupId = groupIdCounter++;
    groups[groupId] = {
      groupId, name, creatorId: parseInt(creatorId),
      members: [parseInt(creatorId), ...(members || []).map(Number)],
      admins: [parseInt(creatorId)],
      isPublic: !!isPublic, avatar: avatar || '', announcement: announcement || '',
      muted: [], createdAt: new Date().toISOString()
    };
    res.json({ code: 200, message: 'Group created', data: { groupId, name } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.get('/api/groups/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const userGroups = Object.values(groups).filter(g => g.members.includes(userId));
    res.json({ code: 200, data: userGroups });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.post('/api/groups/:groupId/members', (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { userId, memberIds } = req.body;
    const group = groups[groupId];
    if (!group) return res.status(404).json({ code: 404, message: 'Group not found' });
    if (!group.admins.includes(parseInt(userId))) return res.status(403).json({ code: 403, message: 'Not admin' });
    memberIds.forEach(id => { if (!group.members.includes(parseInt(id))) group.members.push(parseInt(id)); });
    res.json({ code: 200, message: 'Members added' });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.delete('/api/groups/:groupId/members/:memberId', (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const memberId = parseInt(req.params.memberId);
    const group = groups[groupId];
    if (!group) return res.status(404).json({ code: 404, message: 'Group not found' });
    group.members = group.members.filter(id => id !== memberId);
    group.admins = group.admins.filter(id => id !== memberId);
    res.json({ code: 200, message: 'Member removed' });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.put('/api/groups/:groupId', (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const group = groups[groupId];
    if (!group) return res.status(404).json({ code: 404, message: 'Group not found' });
    const { name, avatar, announcement } = req.body;
    if (name) group.name = name;
    if (avatar) group.avatar = avatar;
    if (announcement) group.announcement = announcement;
    res.json({ code: 200, message: 'Group updated', data: group });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.delete('/api/groups/:groupId', (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { userId } = req.body;
    const group = groups[groupId];
    if (!group) return res.status(404).json({ code: 404, message: 'Group not found' });
    if (group.creatorId !== parseInt(userId)) return res.status(403).json({ code: 403, message: 'Only creator can dissolve' });
    delete groups[groupId];
    res.json({ code: 200, message: 'Group dissolved' });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.get('/api/groups/:groupId/messages', (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const groupMessages = messages.filter(m => m.groupId === groupId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json({ code: 200, data: { messages: groupMessages, members: groups[groupId]?.members || [] } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

app.get('/api/users/search', (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ code: 400, message: 'Missing keyword' });
    const results = Object.values(users).filter(u =>
      u.username.toLowerCase().includes(keyword.toLowerCase()) ||
      (u.nickname && u.nickname.toLowerCase().includes(keyword.toLowerCase()))
    ).map(u => ({ userId: u.userId, username: u.username, nickname: u.nickname, avatar: u.avatar }));
    res.json({ code: 200, data: results });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

function broadcastToUser(targetUserId, eventName, data) {
  const targetSockets = onlineUsers[targetUserId];
  if (!targetSockets || targetSockets.length === 0) {
    console.log('[WS] 目标用户未在线:', targetUserId);
    return;
  }
  targetSockets.forEach(socketId => {
    socketIo.to(socketId).emit(eventName, data);
    console.log('[WS] 消息已发送到连接:', socketId, '事件:', eventName);
  });
}

function broadcastToAll(eventName, data, excludeUserId = null) {
  console.log('[WS] 广播事件:', eventName, '排除用户:', excludeUserId);
  Object.keys(onlineUsers).forEach(userId => {
    if (userId !== String(excludeUserId)) {
      broadcastToUser(parseInt(userId), eventName, data);
    }
  });
}

app.get('/ws', (req, res) => {
  console.log('[WS] /ws 路径访问，查询参数:', req.query);
  res.status(200).json({ code: 200, message: 'WebSocket endpoint available', userId: req.query.userId });
});

socketIo.on('connection', (socket) => {
  console.log('[WS] 客户端连接:', socket.id, '时间:', new Date().toISOString());
  console.log('[WS] 握手查询参数:', socket.handshake.query);

  socket.on('user_login', (userId) => {
    const uid = parseInt(userId);
    console.log('[WS] 用户登录请求:', uid, 'Socket:', socket.id);
    
    if (!onlineUsers[uid]) {
      onlineUsers[uid] = [];
    }
    if (!onlineUsers[uid].includes(socket.id)) {
      onlineUsers[uid].push(socket.id);
    }
    socket.userId = uid;
    const user = users[uid];
    if (user) {
      user.status = 'online';
      socket.username = user.username;
    }
    console.log('[WS] 用户上线成功:', uid, 'Socket:', socket.id, '在线连接数:', onlineUsers[uid].length);
    broadcastToAll('user_status_changed', { userId: uid, online: true, status: 'online' }, uid);
  });

  socket.on('set_status', (data) => {
    let parsedData;
    try {
      parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.error('[WS] set_status 解析失败:', e);
      return;
    }
    const user = users[parsedData.userId];
    if (user) {
      user.status = parsedData.status;
      const isOnline = parsedData.status === 'online' && onlineUsers[parsedData.userId] && onlineUsers[parsedData.userId].length > 0;
      broadcastToAll('user_status_changed', { userId: parseInt(parsedData.userId), online: isOnline, status: parsedData.status });
      console.log('[WS] 用户状态更新:', parsedData.userId, '状态:', parsedData.status, '在线:', isOnline);
    }
  });

  socket.on('send_message', (data) => {
    let msgData;
    try {
      msgData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.error('[WS] 消息解析失败:', e);
      return;
    }

    const { senderId, receiverId, content, type } = msgData;
    if (!content || !receiverId) {
      console.error('[WS] 消息数据不完整:', msgData);
      return;
    }

    const messageId = messageIdCounter++;
    const message = {
      id: messageId,
      senderId: parseInt(senderId),
      receiverId: parseInt(receiverId),
      groupId: null,
      content: content.trim(),
      messageType: type || 'text',
      recalled: false,
      deleted: false,
      read: false,
      createdAt: new Date().toISOString()
    };

    messages.push(message);
    console.log('[WS] 私聊消息创建:', message.id, 'from:', message.senderId, 'to:', message.receiverId);

    broadcastToUser(message.receiverId, 'receive_message', message);
    socket.emit('message_sent', message);
    console.log('[WS] 私聊消息已广播:', message.id);
  });

  socket.on('send_group_message', (data) => {
    let msgData;
    try {
      msgData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.error('[WS] 群消息解析失败:', e);
      return;
    }

    const { senderId, groupId, content, type } = msgData;
    if (!content || !groupId) {
      console.error('[WS] 群消息数据不完整:', msgData);
      return;
    }

    const messageId = messageIdCounter++;
    const message = {
      id: messageId,
      senderId: parseInt(senderId),
      receiverId: null,
      groupId: parseInt(groupId),
      content: content.trim(),
      messageType: type || 'text',
      recalled: false,
      deleted: false,
      read: false,
      createdAt: new Date().toISOString()
    };

    messages.push(message);
    console.log('[WS] 群消息创建:', message.id, 'from:', message.senderId, 'to group:', message.groupId);

    const group = groups[message.groupId];
    if (group) {
      group.members.forEach(memberId => {
        if (memberId !== message.senderId) {
          broadcastToUser(memberId, 'receive_message', message);
        }
      });
    }
    socket.emit('message_sent', message);
    console.log('[WS] 群消息已广播:', message.id);
  });

  socket.on('recall_message', (data) => {
    let parsedData;
    try {
      parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.error('[WS] 撤回消息解析失败:', e);
      return;
    }

    const { messageId, senderId, receiverId } = parsedData;
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      msg.recalled = true;
      msg.content = '[Message recalled]';
      console.log('[WS] 消息已撤回:', messageId);

      broadcastToUser(receiverId, 'message_recalled', { messageId });
      socket.emit('message_recalled', { messageId });
      console.log('[WS] 撤回消息已广播:', messageId);
    }
  });

  socket.on('typing', (data) => {
    let parsedData;
    try {
      parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.error('[WS] 输入状态解析失败:', e);
      return;
    }

    const { senderId, receiverId } = parsedData;
    broadcastToUser(receiverId, 'user_typing', { userId: senderId });
    console.log('[WS] 输入状态广播:', senderId, '->', receiverId);
  });

  socket.on('ping', () => {
    socket.emit('pong');
    console.log('[WS] 心跳响应:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('[WS] 客户端断开:', socket.id);
    if (socket.userId) {
      const uid = socket.userId;
      if (onlineUsers[uid]) {
        const index = onlineUsers[uid].indexOf(socket.id);
        if (index !== -1) {
          onlineUsers[uid].splice(index, 1);
        }
        if (onlineUsers[uid].length === 0) {
          delete onlineUsers[uid];
          const user = users[uid];
          if (user) user.status = 'offline';
          console.log('[WS] 用户下线:', uid);
          broadcastToAll('user_status_changed', { userId: uid, online: false, status: 'offline' });
        } else {
          console.log('[WS] 用户还有其他连接在线:', uid, '剩余连接数:', onlineUsers[uid].length);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

const projectRoot = path.resolve(__dirname, '..');
const distPath = path.join(projectRoot, 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] 服务启动成功，端口: ${PORT}`);
  console.log('[Server] Health check: /api/health');
  console.log('[Server] WebSocket path: /socket.io');
  console.log('[Server] WebSocket endpoint: /ws');
  console.log('[Server] 项目根目录:', projectRoot);
  if (fs.existsSync(distPath)) {
    console.log('[Server] 前端静态资源目录:', distPath);
    const files = fs.readdirSync(distPath);
    console.log('[Server] 静态资源文件:', files);
  }
});
