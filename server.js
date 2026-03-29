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
            socket.emit('joinError', '방이 없거나 이미 시작된 게임입니다.');
        }
    });

    // [게임 시작]
    socket.on('startGame', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].isStarted = true;
            io.to(roomCode).emit('gameStart', { room: rooms[roomCode] });
        }
    });

    // [액션 동기화]
    socket.on('playerEat', (data) => {
        const room = rooms[data.roomCode];
        if (room && room.food > 0) {
            room.food -= 40;
            io.to(data.roomCode).emit('syncEat', { eaterID: socket.id, newFood: room.food });
        }
    });

    socket.on('playerAttack', (data) => {
        io.to(data.roomCode).emit('syncAttack', { attackerID: socket.id, targetID: data.targetID });
    });

    socket.on('sendMsg', (data) => {
        io.to(data.roomCode).emit('receiveMsg', data);
    });

    socket.on('disconnect', () => {
        // 접속 종료 시 처리 로직(선택 사항)
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port ${PORT}`));