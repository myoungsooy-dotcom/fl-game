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
            players: [{ id: socket.id, name: nickname, hunger: 100, floor: 0, alive: true, color: "#2ecc71" }],
            food: 120, day: 1, isStarted: false
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, players: rooms[roomCode].players });
    });

    // [방 입장]
    socket.on('joinRoom', (data) => {
        const room = rooms[data.roomCode];
        if (room && !room.isStarted && room.players.length < 4) {
            const player = { id: socket.id, name: data.nickname, hunger: 100, floor: 0, alive: true, color: "#3498db" };
            room.players.push(player);
            socket.join(data.roomCode);
            io.to(data.roomCode).emit('playerJoined', { players: room.players });
        } else {
            socket.emit('joinError', '방이 없거나 가득 찼습니다.');
        }
    });

    // [게임 시작]
    socket.on('startGame', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].isStarted = true;
            io.to(roomCode).emit('gameStart', { room: rooms[roomCode] });
        }
    });

    // [액션 동기화: 음식/공격/채팅]
    socket.on('playerEat', (data) => {
        if (rooms[data.roomCode]) {
            rooms[data.roomCode].food -= 40;
            io.to(data.roomCode).emit('syncEat', { eaterID: socket.id, newFood: rooms[data.roomCode].food });
        }
    });

    socket.on('playerAttack', (data) => {
        io.to(data.roomCode).emit('syncAttack', { attackerID: socket.id, targetID: data.targetID, damage: 30 });
    });

    socket.on('sendMsg', (data) => {
        io.to(data.roomCode).emit('receiveMsg', data);
    });

    socket.on('disconnect', () => { /* 이탈 처리 로직 추가 가능 */ });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));