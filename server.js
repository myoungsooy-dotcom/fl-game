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
            day: 1, 
            food: 120,
            platformLevel: 0,
            isStarted: false
        };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
    });

    // [방 접속]
    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode]) {
            socket.join(roomCode);
            rooms[roomCode].players[socket.id] = {
                id: socket.id,
                name: "접속자",
                hunger: 100,
                floor: 0,
                alive: true,
                color: '#' + Math.floor(Math.random()*16777215).toString(16)
            };
            io.to(roomCode).emit('updateRoomInfo', rooms[roomCode]);
        } else {
            socket.emit('errorMsg', '방을 찾을 수 없습니다.');
        }
    });

    // [게임 시작 - 방장 전용]
    socket.on('startGame', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].isStarted = true;
            nextDay(roomCode);
        }
    });

    // [식사 처리]
    socket.on('eatFood', ({roomCode, amount}) => {
        if (rooms[roomCode] && rooms[roomCode].food >= amount) {
            rooms[roomCode].food -= amount;
            rooms[roomCode].players[socket.id].hunger = Math.min(100, rooms[roomCode].players[socket.id].hunger + amount);
            io.to(roomCode).emit('updateRoomInfo', rooms[roomCode]);
        }
    });

    // [채팅]
    socket.on('sendMessage', (data) => {
        io.to(data.roomCode).emit('chatMessage', data);
    });

    // [날짜 진행 로직]
    async function nextDay(roomCode) {
        if (!rooms[roomCode]) return;
        
        // 층 무작위 배정
        const playerIds = Object.keys(rooms[roomCode].players);
        const floors = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
        playerIds.forEach((id, idx) => {
            rooms[roomCode].players[id].floor = floors[idx] || 0;
        });

        io.to(roomCode).emit('dayStart', rooms[roomCode]);

        // 플랫폼 하강 시뮬레이션
        for (let f = 1; f <= 4; f++) {
            rooms[roomCode].platformLevel = f;
            io.to(roomCode).emit('platformMove', f);
            await new Promise(r => setTimeout(r, 10000)); // 각 층당 10초 대기
        }

        // 하루 종료 후 허기 소모
        playerIds.forEach(id => {
            const p = rooms[roomCode].players[id];
            p.hunger -= 25;
            if (p.hunger <= 0) p.alive = false;
        });

        rooms[roomCode].day++;
        rooms[roomCode].food = 120; // 음식 리셋
        io.to(roomCode).emit('updateRoomInfo', rooms[roomCode]);
        
        setTimeout(() => nextDay(roomCode), 3000);
    }

    socket.on('disconnect', () => {
        // 접속 종료 처리 생략 (필요시 추가)
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));