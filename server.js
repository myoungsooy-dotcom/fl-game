const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {}; 

io.on('connection', (socket) => {
    // [방 생성]
    socket.on('createRoom', (nickname) => {
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomCode] = {
            code: roomCode,
            players: [{ id: socket.id, name: nickname, hunger: 100, floor: 0, alive: true, color: "#2ecc71", hasEaten: false }],
            food: 120, day: 1, isStarted: false
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, players: rooms[roomCode].players });
    });

    // [방 입장]
    socket.on('joinRoom', (data) => {
        const room = rooms[data.roomCode];
        if (room && !room.isStarted && room.players.length < 4) {
            const player = { id: socket.id, name: data.nickname, hunger: 100, floor: 0, alive: true, color: "#3498db", hasEaten: false };
            room.players.push(player);
            socket.join(data.roomCode);
            io.to(data.roomCode).emit('playerJoined', { players: room.players });
        } else {
            socket.emit('joinError', '방이 없거나 이미 시작되었습니다.');
        }
    });

    // [게임 시작]
    socket.on('startGame', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].isStarted = true;
            io.to(roomCode).emit('gameStart', { room: rooms[roomCode] });
        }
    });

    // [액션: 음식 먹기] - 버그 방지 로직 포함
    socket.on('playerEat', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        
        // 이미 먹었거나 음식이 없으면 무시
        if (player && !player.hasEaten && room.food >= 40) {
            player.hasEaten = true; // 서버에서 먹음 상태 확정
            room.food -= 40;
            io.to(data.roomCode).emit('syncEat', { eaterID: socket.id, newFood: room.food });
        }
    });

    // [액션: 공격]
    socket.on('playerAttack', (data) => {
        io.to(data.roomCode).emit('syncAttack', { attackerID: socket.id, targetID: data.targetID });
    });

    // [채팅]
    socket.on('sendMsg', (data) => {
        io.to(data.roomCode).emit('receiveMsg', data);
    });

    // [다음 날 준비 - 상태 초기화]
    socket.on('nextDayReady', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            room.players.forEach(p => p.hasEaten = false); // 식사 상태 초기화
            room.food = 120;
        }
    });

    socket.on('disconnect', () => { /* 이탈 처리 */ });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server on port ${PORT}`));