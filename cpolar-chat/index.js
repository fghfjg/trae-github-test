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
  transports: ['websocket', 'polling']
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

app.get('/', (req, res) => {
  res.json({ code: 200, message: 'Chat service is running', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ code: 200, status: 'ok', onlineUsers: Object.keys(onlineUsers).length });
});

app.post('/api/register', (req, res) => {
  const { username, password, nickname, avatar } = req.body;
  if (!username || !password) return res.status(400).json({ code: 400, message: 'Username and password required' });
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
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ code: 400, message: 'Username and password required' });
  const user = Object.values(users).find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ code: 401, message: 'Invalid credentials' });
  const token = generateToken(user.userId);
  user.token = token;
  res.json({ code: 200, message: 'Login success', data: { userId: user.userId, username: user.username, nickname: user.nickname, avatar: user.avatar, token } });
});

app.get('/api/user/:userId', (req, res) => {
  const user = users[parseInt(req.params.userId)];
  if (!user) return res.status(404).json({ code: 404, message: 'User not found' });
  res.json({ code: 200, data: { userId: user.userId, username: user.username, nickname: user.nickname, avatar: user.avatar, signature: user.signature, status: user.status, isOnline: !!onlineUsers[user.userId] } });
});

app.put('/api/user/:userId', (req, res) => {
  const user = users[parseInt(req.params.userId)];
  if (!user) return res.status(404).json({ code: 404, message: 'User not found' });
  const { nickname, avatar, signature, status } = req.body;
  if (nickname !== undefined) user.nickname = nickname;
  if (avatar !== undefined) user.avatar = avatar;
  if (signature !== undefined) user.signature = signature;
  if (status !== undefined) user.status = status;
  res.json({ code: 200, message: 'Updated', data: { userId: user.userId, nickname: user.nickname, avatar: user.avatar, signature: user.signature, status: user.status } });
});

app.get('/api/friends/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const data = friendships[userId] || { friends: [], groups: [], blacklist: [] };
  const friendsWithStatus = data.friends.map(fId => {
    const u = users[fId];
    return u ? { id: u.userId, username: u.username, nickname: u.nickname, avatar: u.avatar, status: u.status, isOnline: !!onlineUsers[fId] } : null;
  }).filter(Boolean);
  res.json({ code: 200, data: { friends: friendsWithStatus, groups: data.groups, blacklist: data.blacklist } });
});

app.post('/api/friends/add', (req, res) => {
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
});

app.delete('/api/friends/:userId/:friendId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendId = parseInt(req.params.friendId);
  const fData = friendships[userId];
  if (fData) fData.friends = fData.friends.filter(id => id !== friendId);
  const tData = friendships[friendId];
  if (tData) tData.friends = tData.friends.filter(id => id !== userId);
  res.json({ code: 200, message: 'Friend removed' });
});

app.post('/api/friends/blacklist', (req, res) => {
  const { userId, targetId } = req.body;
  if (!userId || !targetId) return res.status(400).json({ code: 400, message: 'Missing params' });
  const fData = friendships[parseInt(userId)] || (friendships[parseInt(userId)] = { friends: [], groups: [], blacklist: [] });
  if (!fData.blacklist.includes(parseInt(targetId))) fData.blacklist.push(parseInt(targetId));
  res.json({ code: 200, message: 'Added to blacklist' });
});

app.get('/api/messages/:userId1/:userId2', (req, res) => {
  const { userId1, userId2 } = req.params;
  const chatMessages = messages.filter(m =>
    (m.senderId === parseInt(userId1) && m.receiverId === parseInt(userId2)) ||
    (m.senderId === parseInt(userId2) && m.receiverId === parseInt(userId1))
  ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ code: 200, data: chatMessages });
});

app.post('/api/messages/recall', (req, res) => {
  const { userId, messageId } = req.body;
  const msg = messages.find(m => m.id === messageId);
  if (!msg) return res.status(404).json({ code: 404, message: 'Message not found' });
  if (msg.senderId !== parseInt(userId)) return res.status(403).json({ code: 403, message: 'Cannot recall others messages' });
  const elapsed = (Date.now() - new Date(msg.createdAt).getTime()) / 1000;
  if (elapsed > 120) return res.status(400).json({ code: 400, message: 'Cannot recall after 2 minutes' });
  msg.recalled = true;
  msg.content = '[Message recalled]';
  res.json({ code: 200, message: 'Message recalled', data: { messageId } });
});

app.post('/api/messages/read', (req, res) => {
  const { userId, messageId } = req.body;
  const msg = messages.find(m => m.id === messageId);
  if (msg && msg.receiverId === parseInt(userId)) {
    msg.read = true;
    msg.readAt = new Date().toISOString();
  }
  res.json({ code: 200, message: 'Marked as read' });
});

app.get('/api/messages/search', (req, res) => {
  const { userId, keyword } = req.query;
  if (!userId || !keyword) return res.status(400).json({ code: 400, message: 'Missing params' });
  const results = messages.filter(m =>
    (m.senderId === parseInt(userId) || m.receiverId === parseInt(userId)) &&
    m.content && m.content.toLowerCase().includes(keyword.toLowerCase())
  );
  res.json({ code: 200, data: results });
});

app.post('/api/groups', (req, res) => {
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
});

app.get('/api/groups/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const userGroups = Object.values(groups).filter(g => g.members.includes(userId));
  res.json({ code: 200, data: userGroups });
});

app.post('/api/groups/:groupId/members', (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const { userId, memberIds } = req.body;
  const group = groups[groupId];
  if (!group) return res.status(404).json({ code: 404, message: 'Group not found' });
  if (!group.admins.includes(parseInt(userId))) return res.status(403).json({ code: 403, message: 'Not admin' });
  memberIds.forEach(id => { if (!group.members.includes(parseInt(id))) group.members.push(parseInt(id)); });
  res.json({ code: 200, message: 'Members added' });
});

app.delete('/api/groups/:groupId/members/:memberId', (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const memberId = parseInt(req.params.memberId);
  const group = groups[groupId];
  if (!group) return res.status(404).json({ code: 404, message: 'Group not found' });
  group.members = group.members.filter(id => id !== memberId);
  group.admins = group.admins.filter(id => id !== memberId);
  res.json({ code: 200, message: 'Member removed' });
});

app.put('/api/groups/:groupId', (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const group = groups[groupId];
  if (!group) return res.status(404).json({ code: 404, message: 'Group not found' });
  const { name, avatar, announcement } = req.body;
  if (name) group.name = name;
  if (avatar) group.avatar = avatar;
  if (announcement) group.announcement = announcement;
  res.json({ code: 200, message: 'Group updated', data: group });
});

app.delete('/api/groups/:groupId', (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const { userId } = req.body;
  const group = groups[groupId];
  if (!group) return res.status(404).json({ code: 404, message: 'Group not found' });
  if (group.creatorId !== parseInt(userId)) return res.status(403).json({ code: 403, message: 'Only creator can dissolve' });
  delete groups[groupId];
  res.json({ code: 200, message: 'Group dissolved' });
});

app.get('/api/groups/:groupId/messages', (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const groupMessages = messages.filter(m => m.groupId === groupId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ code: 200, data: groupMessages });
});

app.get('/api/users/search', (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.status(400).json({ code: 400, message: 'Missing keyword' });
  const results = Object.values(users).filter(u =>
    u.username.toLowerCase().includes(keyword.toLowerCase()) ||
    (u.nickname && u.nickname.toLowerCase().includes(keyword.toLowerCase()))
  ).map(u => ({ userId: u.userId, username: u.username, nickname: u.nickname, avatar: u.avatar }));
  res.json({ code: 200, data: results });
});

socketIo.on('connection', (socket) => {
  socket.on('user_login', (userId) => {
    onlineUsers[userId] = socket.id;
    socket.userId = userId;
    const user = users[userId];
    if (user) { user.status = 'online'; socket.username = user.username; }
    socketIo.emit('user_status_changed', { userId: parseInt(userId), isOnline: true, status: 'online' });
  });

  socket.on('set_status', (data) => {
    const user = users[data.userId];
    if (user) { user.status = data.status; socketIo.emit('user_status_changed', { userId: parseInt(data.userId), status: data.status }); }
  });

  socket.on('send_message', (data) => {
    const { senderId, receiverId, content, messageType, mediaUrl, replyTo, groupId } = data;
    const message = {
      id: Date.now() + Math.random(),
      senderId: parseInt(senderId),
      receiverId: receiverId ? parseInt(receiverId) : null,
      groupId: groupId ? parseInt(groupId) : null,
      content: content || '',
      messageType: messageType || 'text',
      mediaUrl: mediaUrl || '',
      replyTo: replyTo || null,
      recalled: false,
      read: false,
      createdAt: new Date().toISOString()
    };
    messages.push(message);
    if (groupId) {
      const group = groups[groupId];
      if (group) {
        group.members.forEach(mid => {
          const sid = onlineUsers[mid];
          if (sid && mid !== parseInt(senderId)) socketIo.to(sid).emit('receive_message', message);
        });
      }
    } else if (receiverId) {
      const receiverSocketId = onlineUsers[receiverId];
      if (receiverSocketId) socketIo.to(receiverSocketId).emit('receive_message', message);
    }
    socket.emit('message_sent', message);
  });

  socket.on('typing', (data) => {
    const receiverSocketId = onlineUsers[data.receiverId];
    if (receiverSocketId) socketIo.to(receiverSocketId).emit('user_typing', { userId: data.userId, isTyping: data.isTyping });
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      delete onlineUsers[socket.userId];
      const user = users[socket.userId];
      if (user) user.status = 'offline';
      socketIo.emit('user_status_changed', { userId: parseInt(socket.userId), isOnline: false, status: 'offline' });
    }
  });
});

const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Health check: /api/health');
  if (fs.existsSync(distPath)) {
    console.log('Serving frontend from:', distPath);
  } else {
    console.log('Frontend dist not found, API only mode');
  }
});
