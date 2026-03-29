const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

let players = {}; // 접속한 플레이어 목록

io.on('connection', (socket) => {
    console.log('새로운 플레이어 접속:', socket.id);

    // 플레이어 생성
    players[socket.id] = {
        id: socket.id,
        name: `플레이어_${socket.id.substr(0, 4)}`,
        floor: Math.floor(Math.random() * 4) + 1,
        hunger: 100,
        alive: true
    };

    // 모든 클라이언트에게 현재 플레이어 상태 전송
    io.emit('updatePlayers', players);

    // 채팅 중계
    socket.on('sendMessage', (data) => {
        io.emit('receiveMessage', data); // 모두에게 전달
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
        console.log('플레이어 퇴장:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`서버가 포트 ${PORT}에서 실행 중...`));