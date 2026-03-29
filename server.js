const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// 방 정보 저장소
const rooms = {};

io.on('connection', (socket) => {
    console.log('사용자 접속:', socket.id);

    // 방 만들기
    socket.on('createRoom', () => {
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomCode] = { players: [] };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        console.log(`방 생성됨: ${roomCode}`);
    });

    // 방 접속하기
    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode]) {
            socket.join(roomCode);
            rooms[roomCode].players.push(socket.id);
            socket.emit('joinedRoom', roomCode);
            io.to(roomCode).emit('chatMessage', { system: true, text: `새로운 플레이어가 입구에 도착했습니다.` });
        } else {
            socket.emit('errorMsg', '존재하지 않는 방 코드입니다.');
        }
    });

    // 채팅 메시지 전송
    socket.on('sendMessage', (data) => {
        // data: { roomCode, text, sender }
        io.to(data.roomCode).emit('chatMessage', data);
    });

    socket.on('disconnect', () => {
        console.log('사용자 접속 해제');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});