const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server); // [중요] 여기서 io를 정의해야 아래에서 사용 가능합니다.

app.use(express.static(path.join(__dirname, 'public')));

let waitingPlayers = []; // 대기 중인 플레이어 목록
let rooms = {}; // 활성화된 게임 방 데이터

io.on('connection', (socket) => {
    console.log('유저 접속:', socket.id);

    // 1. 게임 참여 요청
    socket.on('joinGame', (nickname) => {
        const player = { 
            id: socket.id, 
            name: nickname, 
            hunger: 100, 
            floor: 0, 
            alive: true, 
            color: "#" + Math.floor(Math.random()*16777215).toString(16) 
        };
        waitingPlayers.push(player);

        console.log(`${nickname} 대기열 합류 (현재: ${waitingPlayers.length}/4)`);

        // 4명이 모이면 게임 시작
        if (waitingPlayers.length >= 1) {
            const roomID = 'room_' + Date.now();
            const playersInRoom = waitingPlayers.splice(0, 4);
            
            rooms[roomID] = {
                id: roomID,
                players: playersInRoom,
                food: 120,
                day: 1
            };

            // 해당 방의 플레이어들에게만 시작 신호 전송
            playersInRoom.forEach(p => {
                io.to(p.id).emit('gameStart', { room: rooms[roomID], myID: p.id });
            });
            
            console.log(`방 생성됨: ${roomID}`);
        } else {
            // 대기 중인 인원수 알림
            io.emit('waiting', waitingPlayers.length);
        }
    });

    // 2. 음식 섭취 동기화
    socket.on('playerEat', (data) => {
        const room = rooms[data.roomID];
        if (room) {
            room.food -= data.amount;
            // 방 안의 모든 유저에게 업데이트된 음식 수치 전송
            io.emit('syncEat', { eaterID: data.eaterID, newFood: room.food });
        }
    });

    // 3. 플랫폼 탑승 동기화
    socket.on('playerRide', (data) => {
        io.emit('syncRide', { riderID: data.riderID });
    });

    // 4. 파이프 공격 동기화
    socket.on('playerAttack', (data) => {
        io.emit('syncAttack', { attackerID: socket.id, targetID: data.targetID, damage: data.damage });
    });

    // 5. 채팅 동기화
    socket.on('sendMsg', (data) => {
        io.emit('receiveMsg', data);
    });

    // 6. 접속 종료 처리
    socket.on('disconnect', () => {
        waitingPlayers = waitingPlayers.filter(p => p.id !== socket.id);
        console.log('유저 나감:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    =========================================
    THE PLATFORM 서버가 가동되었습니다!
    주소: http://localhost:${PORT}
    =========================================
    `);
});