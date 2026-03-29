const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    // [방 생성]
    socket.on('createRoom', () => {
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomCode] = { 
            players: {}, 
            platformLevel: 1, // 플랫폼이 현재 머무는 층
            maxLevels: 30     // 전체 층수
        };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        
        // 플랫폼 이동 타이머 시작 (10초마다 한 층씩 내려감)
        const timer = setInterval(() => {
            if (rooms[roomCode]) {
                rooms[roomCode].platformLevel++;
                if (rooms[roomCode].platformLevel > rooms[roomCode].maxLevels) {
                    rooms[roomCode].platformLevel = 1; // 다시 1층으로 리셋
                }
                io.to(roomCode).emit('platformMove', rooms[roomCode].platformLevel);
            } else {
                clearInterval(timer);
            }
        }, 10000);
    });

    // [방 접속]
    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode]) {
            socket.join(roomCode);
            const startLevel = Math.floor(Math.random() * 30) + 1;
            rooms[roomCode].players[socket.id] = {
                level: startLevel,
                hp: 100,
                color: '#' + Math.floor(Math.random()*16777215).toString(16)
            };
            socket.emit('joinedRoom', {
                roomCode,
                myId: socket.id,
                players: rooms[roomCode].players,
                currentPlatform: rooms[roomCode].platformLevel
            });
            socket.to(roomCode).emit('newPlayer', { id: socket.id, info: rooms[roomCode].players[socket.id] });
        } else {
            socket.emit('errorMsg', '방을 찾을 수 없습니다.');
        }
    });

    // [채팅]
    socket.on('sendMessage', (data) => {
        io.to(data.roomCode).emit('chatMessage', data);
    });

    socket.on('disconnect', () => {
        for (const code in rooms) {
            if (rooms[code].players[socket.id]) {
                delete rooms[code].players[socket.id];
                io.to(code).emit('playerLeft', socket.id);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));