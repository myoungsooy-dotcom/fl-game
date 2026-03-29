const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// 방 정보 및 플레이어 위치 저장소
// { "ROOM123": { players: { "socketId": {x, y, color} } } }
const rooms = {};

// 랜덤 색상 생성 함수
function getRandomColor() {
    const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff'];
    return colors[Math.floor(Math.random() * colors.length)];
}

io.on('connection', (socket) => {
    console.log('사용자 접속:', socket.id);

    // [방 만들기]
    socket.on('createRoom', () => {
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomCode] = { players: {} }; // 방 생성시 플레이어 목록 초기화
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        console.log(`방 생성됨: ${roomCode}`);
    });

    // [방 접속하기]
    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode]) {
            socket.join(roomCode);
            
            // 새 플레이어 초기 위치 및 색상 설정
            rooms[roomCode].players[socket.id] = {
                x: 50, // 시작 X 위치
                y: 50, // 시작 Y 위치
                color: getRandomColor()
            };

            socket.emit('joinedRoom', {
                roomCode: roomCode,
                playerId: socket.id,
                players: rooms[roomCode].players // 현재 방의 모든 플레이어 정보 전송
            });

            // 다른 플레이어들에게 새 플레이어 접속 알림
            socket.to(roomCode).emit('newPlayer', {
                id: socket.id,
                info: rooms[roomCode].players[socket.id]
            });

            io.to(roomCode).emit('chatMessage', { system: true, text: `새로운 플레이어가 입구에 도착했습니다.` });
        } else {
            socket.emit('errorMsg', '존재하지 않는 방 코드입니다.');
        }
    });

    // [플레이어 이동 정보 수신]
    socket.on('playerMove', (data) => {
        // data: { roomCode, x, y }
        if (rooms[data.roomCode] && rooms[data.roomCode].players[socket.id]) {
            // 서버 저장소 업데이트
            rooms[data.roomCode].players[socket.id].x = data.x;
            rooms[data.roomCode].players[socket.id].y = data.y;
            
            // 방 안에 있는 다른 사람들에게만 위치 전달
            socket.to(data.roomCode).emit('playerMoved', {
                id: socket.id,
                x: data.x,
                y: data.y
            });
        }
    });

    // [채팅 메시지 전송]
    socket.on('sendMessage', (data) => {
        // data: { roomCode, text, sender }
        io.to(data.roomCode).emit('chatMessage', data);
    });

    // [접속 해제]
    socket.on('disconnect', () => {
        console.log('사용자 접속 해제:', socket.id);
        // 모든 방을 돌며 해당 플레이어 삭제
        for (const roomCode in rooms) {
            if (rooms[roomCode].players[socket.id]) {
                delete rooms[roomCode].players[socket.id];
                io.to(roomCode).emit('playerLeft', socket.id);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});