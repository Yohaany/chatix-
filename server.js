const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// 🚨 ВАЖНО: Добавляем CORS, чтобы разрешить подключение от Vercel
// В продакшене лучше указать конкретный домен Vercel вместо "*".
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Хранилище в памяти
let users = {}; // { socketId: firebase_uid_display }
let chats = []; // [{ id, type, participants, messages }]

io.on('connection', (socket) => {
  
  // 1. Регистрация пользователя (используем Firebase UID как @user)
  // uid_display — это UID, обрезанный для отображения, например: @7c89a0b1
  socket.on('register', (uid_display) => {
    users[socket.id] = uid_display;
    socket.emit('registered', { username: uid_display, allUsers: Object.values(users) });
    io.emit('update_users', Object.values(users)); // Обновить список у всех
  });

  // 2. Создание чата (Личка или Группа)
  socket.on('create_chat', (selectedUsernames) => {
    const myName = users[socket.id];
    // Добавляем себя в список участников
    const participants = [...selectedUsernames, myName]; 
    
    // Проверка на дубликаты чата
    const existingChat = chats.find(chat => 
        chat.participants.length === participants.length &&
        chat.participants.every(p => participants.includes(p))
    );

    if (existingChat) return;

    // Логика: Если участников > 2, это группа
    const type = participants.length > 2 ? 'group' : 'private';
    const chatName = type === 'group' 
        ? `Группа (${participants.length} уч.)` 
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
    // ⭐️ Отправляем только тем, кто участвует в чате
    participants.forEach(uid => {
        const socketId = Object.keys(users).find(key => users[key] === uid);
        if (socketId) {
            io.to(socketId).emit('new_chat', newChat);
        }
    });

  });

  // 3. Отправка сообщения
  socket.on('send_message', ({ chatId, text }) => {
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      const msg = { sender: users[socket.id], text, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
      chat.messages.push(msg);
      
      // ⭐️ Отправляем сообщение только участникам чата
      chat.participants.forEach(uid => {
          const socketId = Object.keys(users).find(key => users[key] === uid);
          if (socketId) {
              io.to(socketId).emit('update_chat', chat);
          }
      });
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('update_users', Object.values(users));
  });
});

server.listen(PORT, () => {
  console.log(`Мессенджер запущен на порту ${PORT}`);
});
