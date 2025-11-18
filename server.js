const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Хранилище в памяти (для прототипа)
let users = {}; // { socketId: username }
let chats = []; // [{ id, type, participants, messages }]

io.on('connection', (socket) => {
  
  // 1. Регистрация пользователя
  socket.on('register', (username) => {
    // Простая проверка, чтобы ник начинался с @
    if (!username.startsWith('@')) username = '@' + username;
    
    users[socket.id] = username;
    socket.emit('registered', { username, allUsers: Object.values(users) });
    io.emit('update_users', Object.values(users)); // Обновить список у всех
  });

  // 2. Создание чата (Личка или Группа)
  socket.on('create_chat', (selectedUsernames) => {
    const myName = users[socket.id];
    // Добавляем себя в список участников
    const participants = [...selectedUsernames, myName]; 
    
    // Логика: Если участников > 2, это группа
    const type = participants.length > 2 ? 'group' : 'private';
    const chatName = type === 'group' 
        ? `Группа (${participants.join(', ')})` 
        : participants.find(u => u !== myName);

    const newChat = {
      id: Date.now().toString(),
      type,
      name: chatName,
      participants,
      messages: []
    };

    chats.push(newChat);
    
    // Оповещаем участников о новом чате
    io.emit('new_chat', newChat);
  });

  // 3. Отправка сообщения
  socket.on('send_message', ({ chatId, text }) => {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      const msg = { sender: users[socket.id], text, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
      chat.messages.push(msg);
      io.emit('update_chat', chat);
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('update_users', Object.values(users));
  });
});

server.listen(3000, () => {
  console.log('Мессенджер запущен на http://localhost:3000');
});