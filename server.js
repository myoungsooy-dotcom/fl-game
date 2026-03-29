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
    // 방 생성 & 혼자하기 공용
    socket.on('createRoom', (nickname) => {
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomCode] = {
            code: roomCode,
            players: [{ 
                id: socket.id, name: nickname || "플레이어", hp: 100, hunger: 100, floor: 0, 
                alive: true, color: "#2ecc71", actionPoints: 1 
            }],
            foodCount: 8, day: 1, isStarted: false
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, players: rooms[roomCode].players });
    });

    // 방 입장 (닉네임 버그 수정됨)
    socket.on('joinRoom', (data) => {
        const room = rooms[data.roomCode];
        if (room && !room.isStarted && room.players.length < 4) {
            const player = { 
                id: socket.id, name: data.nickname || "참가자", hp: 100, hunger: 100, floor: 0, 
                alive: true, color: "#3498db", actionPoints: 1 
            };
            room.players.push(player);
            socket.join(data.roomCode);
            io.to(data.roomCode).emit('playerJoined', { players: room.players });
        } else {
            socket.emit('joinError', "방을 찾을 수 없거나 이미 시작되었습니다.");
        }
    });

    socket.on('startGame', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].isStarted = true;
            io.to(roomCode).emit('gameStart', { room: rooms[roomCode] });
        }
    });

    // 음식 섭취 (1회 제한 & 수치 반영)
    socket.on('playerEat', (data) => {
    const room = rooms[data.roomCode];
    if (!room) return;
    const p = room.players.find(player => player.id === socket.id);
    
    // 음식 섭취 가능 여부만 확인 (음식이 있고, 아직 이번 층에서 안 먹었을 때)
    if (p && room.foodCount >= data.amount && p.hasEaten === false) {
        room.foodCount -= data.amount;
        const heal = data.amount === 1 ? 20 : 50;
        p.hunger = Math.min(100, p.hunger + heal);
        
        // 중요: 음식은 '한 번'만 먹었다고 표시하지만, actionPoints는 깎지 않음
        p.hasEaten = true; 

        io.to(data.roomCode).emit('syncEat', { 
            eaterID: socket.id, 
            newFoodCount: room.foodCount, 
            hunger: p.hunger 
        });
    }
});

// 새 날이 시작될 때 음식 섭취 여부 초기화
socket.on('nextDayReady', (roomCode) => {
    const room = rooms[roomCode];
    if (room) {
        room.players.forEach(p => {
            if(p.alive) {
                p.hunger -= 30;
                if(p.hunger < 0) { p.hp += p.hunger; p.hunger = 0; }
                if(p.hp <= 0) p.alive = false;
                p.hasEaten = false; // 음식 섭취 여부 초기화
                p.actionPoints = 1;
            }
        });
        room.foodCount = 8;
        room.day++;
        io.to(roomCode).emit('newDayStarted', { room });
    }
});

    // 공격 시스템
    socket.on('playerAttack', (data) => {
        const room = rooms[data.roomCode];
        if(room) {
            const victim = room.players.find(p => p.id === data.targetID);
            if(victim) {
                victim.hp = Math.max(0, victim.hp - 20);
                if(victim.hp <= 0) victim.alive = false;
                io.to(data.roomCode).emit('syncAttack', { targetID: data.targetID, newHp: victim.hp, isDead: !victim.alive });
            }
        }
    });

    // 하루 정산 (허기 -30 고정 소모)
    socket.on('nextDayReady', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            room.players.forEach(p => {
                if(p.alive) {
                    p.hunger -= 30;
                    if(p.hunger < 0) { p.hp += p.hunger; p.hunger = 0; }
                    if(p.hp <= 0) { p.hp = 0; p.alive = false; }
                    p.actionPoints = 1;
                }
            });
            room.foodCount = 8;
            room.day++;
            io.to(roomCode).emit('newDayStarted', { room });
        }
    });

    socket.on('sendMsg', (data) => { io.to(data.roomCode).emit('receiveMsg', data); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server is running`));