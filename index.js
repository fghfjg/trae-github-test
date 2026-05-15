const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ code: 200, status: 'ok', message: 'Service is running' });
});

// Root endpoint to prevent 404
app.get('/', (req, res) => {
  res.json({ code: 200, message: 'Chat service is running' });
});

const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Health check: /api/health');
});
