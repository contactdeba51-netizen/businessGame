const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const initSocket = require('./socket');
initSocket(io);

app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/auth'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running ✅' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});