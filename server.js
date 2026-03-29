const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // 모든 접속 허용 (Render 배포 시 필수)
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {}; 

io.on('connection', (socket) => {
    console.log('유저 접속:', socket.id);

    // [방 만들기]
    socket.on('createRoom', (nickname) => {
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        const player = { id: socket.id, name: nickname, hunger: 100, floor: 0, alive: true, color: "#2ecc71" };
        
        rooms[roomCode] = {
            code: roomCode,
            players: [player],
            food: 120,
            day: 1,
            isStarted: false
        };

        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, players: rooms[roomCode].players });
    });

    // [방 입장]
    socket.on('joinRoom', (data) => {
        const { roomCode, nickname } = data;
        const room = rooms[roomCode];

        if (room && !room.isStarted && room.players.length < 4) {
            const player = { id: socket.id, name: nickname, hunger: 100, floor: 0, alive: true, color: "#3498db" };
            room.players.push(player);
            socket.join(roomCode);
            
            io.to(roomCode).emit('playerJoined', { players: room.players });
        } else {
            socket.emit('joinError', '방이 없거나 가득 찼습니다.');
        }
    });

    // [게임 시작]
    socket.on('startGame', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            room.isStarted = true;
            io.to(roomCode).emit('gameStart', { room });
        }
    });

    // [음식 동기화]
    socket.on('playerEat', (data) => {
        const room = rooms[data.roomCode];
        if (room && room.food > 0) {
            room.food -= 40;
            io.to(data.roomCode).emit('syncEat', { eaterID: socket.id, newFood: room.food });
        }
    });

    socket.on('disconnect', () => {
        console.log('유저 나감:', socket.id);
    });
});

// [중요] Render 배포를 위한 포트 설정
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`서버 가동 중: 포트 ${PORT}`);
});