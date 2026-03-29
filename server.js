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
    // [방 생성 및 혼자하기]
    socket.on('createRoom', (nickname) => {
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomCode] = {
            code: roomCode,
            players: [{ 
                id: socket.id, name: nickname, hp: 100, hunger: 100, floor: 0, 
                alive: true, color: "#2ecc71", actionPoints: 1 
            }],
            foodCount: 8, day: 1, isStarted: false
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, players: rooms[roomCode].players });
    });

    // [방 입장]
    socket.on('joinRoom', (data) => {
        const room = rooms[data.roomCode];
        if (room && !room.isStarted && room.players.length < 4) {
            const player = { 
                id: socket.id, name: data.nickname, hp: 100, hunger: 100, floor: 0, 
                alive: true, color: "#3498db", actionPoints: 1 
            };
            room.players.push(player);
            socket.join(data.roomCode);
            io.to(data.roomCode).emit('playerJoined', { players: room.players });
        }
    });

    socket.on('startGame', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].isStarted = true;
            io.to(roomCode).emit('gameStart', { room: rooms[roomCode] });
        }
    });

    // [핵심 룰: 음식 섭취 - 1개/2개 중 택1 후 행동 종료]
    socket.on('playerEat', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        const p = room.players.find(player => player.id === socket.id);
        
        if (p && room.foodCount >= data.amount && p.actionPoints > 0) {
            room.foodCount -= data.amount;
            // 5번 룰: 1개(+20), 2개(+50) 허기 회복
            const healAmount = data.amount === 1 ? 20 : 50;
            p.hunger = Math.min(100, p.hunger + healAmount);
            
            // 3번 룰: 음식을 먹으면 즉시 행동력 0 (중복 섭취 방지)
            p.actionPoints = 0; 

            io.to(data.roomCode).emit('syncEat', { 
                eaterID: socket.id, 
                newFoodCount: room.foodCount,
                hunger: p.hunger
            });
        }
    });

    // [공격 시스템]
    socket.on('playerAttack', (data) => {
        const room = rooms[data.roomCode];
        if(room) {
            const victim = room.players.find(p => p.id === data.targetID);
            if(victim) {
                victim.hp = Math.max(0, victim.hp - 20); // 공격 시 HP 20 감소
                if(victim.hp <= 0) victim.alive = false;
                io.to(data.roomCode).emit('syncAttack', { 
                    attackerID: socket.id, targetID: data.targetID, newHp: victim.hp, isDead: !victim.alive 
                });
            }
        }
    });

    // [정산 및 다음 날 시작]
    socket.on('nextDayReady', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            // 4번 룰: 매일 허기 30 고정 소무
            room.players.forEach(p => {
                if(p.alive) {
                    p.hunger -= 30;
                    if(p.hunger < 0) {
                        p.hp += p.hunger; // 허기 부족분만큼 HP 감소
                        p.hunger = 0;
                    }
                    if(p.hp <= 0) { p.hp = 0; p.alive = false; }
                    p.actionPoints = 1; // 새 날이 밝으면 행동력 복구
                }
            });
            room.foodCount = 8; // 음식 8개 리필
            room.day++;
            io.to(roomCode).emit('newDayStarted', { room });
        }
    });

    socket.on('sendMsg', (data) => { io.to(data.roomCode).emit('receiveMsg', data); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server is running`));