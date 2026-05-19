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
  pingTimeout: 60000,
  pingInterval: 25000
});

// 跨域配置：兼容本地开发和Railway生产环境
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

// 数据存储
const users = {};
const messages = [];
const groups = {};
const friendships = {};
const onlineUsers = {};
let userIdCounter = 1;
let groupIdCounter = 1;
let messageIdCounter = 1;

// 健康检测接口
app.get('/api/health', (req, res) => {
  res.json({ code: 200, status: 'ok', onlineUsers: Object.keys(onlineUsers).length });
});

// 注册接口：限制重复注册
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

// 登录接口
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

// 获取用户信息
app.get('/api/user/:userId', (req, res) => {
  try {
    const user = users[parseInt(req.params.userId)];
    if (!user) return res.status(404).json({ code: 404, message: 'User not found' });
    res.json({ code: 200, data: { userId: user.userId, username: user.username, nickname: user.nickname, avatar: user.avatar, signature: user.signature, status: user.status, isOnline: !!onlineUsers[user.userId] } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// 更新用户信息
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

// 获取好友列表
app.get('/api/friends/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const data = friendships[userId] || { friends: [], groups: [], blacklist: [] };
    const friendsWithStatus = data.friends.map(fId => {
      const u = users[fId];
      return u ? { id: u.userId, username: u.username, nickname: u.nickname, avatar: u.avatar, status: u.status, isOnline: !!onlineUsers[fId] } : null;
    }).filter(Boolean);
    res.json({ code: 200, data: { friends: friendsWithStatus, groups: data.groups, blacklist: data.blacklist } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// 添加好友
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

// 删除好友
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

// 加入黑名单
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

// 获取历史聊天记录
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

// 撤回消息
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

// 标记已读
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

// 搜索消息
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

// 删除消息
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

// 创建群组
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

// 获取用户群组
app.get('/api/groups/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const userGroups = Object.values(groups).filter(g => g.members.includes(userId));
    res.json({ code: 200, data: userGroups });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// 添加群组成员
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

// 移除群组成员
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

// 更新群组
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

// 解散群组
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

// 获取群组消息
app.get('/api/groups/:groupId/messages', (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const groupMessages = messages.filter(m => m.groupId === groupId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json({ code: 200, data: { messages: groupMessages, members: groups[groupId]?.members || [] } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// 搜索用户
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

// WebSocket连接处理
socketIo.on('connection', (socket) => {
  console.log('[WS] 客户端连接:', socket.id);

  // 用户登录：记录在线状态
  socket.on('user_login', (userId) => {
    const uid = parseInt(userId);
    onlineUsers[uid] = socket.id;
    socket.userId = uid;
    const user = users[uid];
    if (user) {
      user.status = 'online';
      socket.username = user.username;
    }
    console.log('[WS] 用户上线:', uid);
    // 广播用户上线状态
    socketIo.emit('user_status_changed', { userId: uid, online: true, status: 'online' });
  });

  // 设置在线状态
  socket.on('set_status', (data) => {
    const user = users[data.userId];
    if (user) {
      user.status = data.status;
      socketIo.emit('user_status_changed', { userId: parseInt(data.userId), online: data.status === 'online', status: data.status });
    }
  });

  // 发送私聊消息：统一JSON格式，精准发送给接收方
  socket.on('send_message', (data) => {
    let msgData;
    try {
      // 兼容字符串和对象格式
      msgData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.error('[WS] 消息解析失败:', e);
      return;
    }

    const { senderId, receiverId, content, type } = msgData;
    const messageId = messageIdCounter++;

    const message = {
      id: messageId,
      senderId: parseInt(senderId),
      receiverId: receiverId ? parseInt(receiverId) : null,
      groupId: null,
      content: content || '',
      messageType: type || 'text',
      recalled: false,
      deleted: false,
      read: false,
      createdAt: new Date().toISOString()
    };

    // 存储消息
    messages.push(message);
    console.log('[WS] 私聊消息:', message.id, 'from', message.senderId, 'to', message.receiverId);

    // 精准发送给接收方
    if (receiverId) {
      const receiverSocketId = onlineUsers[parseInt(receiverId)];
      if (receiverSocketId) {
        socketIo.to(receiverSocketId).emit('receive_message', message);
        console.log('[WS] 消息已发送给接收方:', receiverSocketId);
      }
    }

    // 发送确认给发送者
    socket.emit('message_sent', message);
  });

  // 发送群聊消息：广播给所有群成员，排除发送者
  socket.on('send_group_message', (data) => {
    let msgData;
    try {
      msgData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.error('[WS] 群消息解析失败:', e);
      return;
    }

    const { senderId, groupId, content, type } = msgData;
    const messageId = messageIdCounter++;

    const message = {
      id: messageId,
      senderId: parseInt(senderId),
      receiverId: null,
      groupId: parseInt(groupId),
      content: content || '',
      messageType: type || 'text',
      recalled: false,
      deleted: false,
      read: false,
      createdAt: new Date().toISOString()
    };

    messages.push(message);
    console.log('[WS] 群聊消息:', message.id, 'in group', message.groupId);

    // 广播给群内其他成员
    const group = groups[parseInt(groupId)];
    if (group) {
      group.members.forEach(mid => {
        if (mid !== parseInt(senderId)) {
          const sid = onlineUsers[mid];
          if (sid) {
            socketIo.to(sid).emit('receive_message', message);
          }
        }
      });
    }

    socket.emit('message_sent', message);
  });

  // 撤回消息
  socket.on('recall_message', (data) => {
    let msgData;
    try {
      msgData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      return;
    }

    const { messageId, senderId, receiverId } = msgData;
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.senderId === parseInt(senderId)) {
      msg.recalled = true;
      // 通知接收方
      if (receiverId) {
        const receiverSocketId = onlineUsers[parseInt(receiverId)];
        if (receiverSocketId) {
          socketIo.to(receiverSocketId).emit('message_recalled', { messageId });
        }
      }
    }
  });

  // 正在输入
  socket.on('typing', (data) => {
    const receiverSocketId = onlineUsers[data.receiverId];
    if (receiverSocketId) {
      socketIo.to(receiverSocketId).emit('user_typing', { userId: data.userId, isTyping: data.isTyping });
    }
  });

  // 心跳保活
  socket.on('ping', () => {
    socket.emit('pong');
    console.log('[WS] 心跳响应:', socket.id);
  });

  // 断开连接
  socket.on('disconnect', () => {
    if (socket.userId) {
      delete onlineUsers[socket.userId];
      const user = users[socket.userId];
      if (user) user.status = 'offline';
      console.log('[WS] 用户下线:', socket.userId);
      socketIo.emit('user_status_changed', { userId: socket.userId, online: false, status: 'offline' });
    }
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 静态文件服务：前端打包后的文件
const distPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log('Serving frontend from:', distPath);
  const files = fs.readdirSync(distPath);
  console.log('Dist files:', files);
} else {
  console.log('Frontend dist not found, API only mode');
}
