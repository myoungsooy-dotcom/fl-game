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

    // 3번 & 5번: 음식 먹기 처리
    socket.on('playerEat', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        const p = room.players.find(player => player.id === socket.id);
        
        if (p && room.foodCount >= data.amount && p.actionPoints > 0) {
            room.foodCount -= data.amount;
            // 5번: 1개 먹기(+20), 2개 먹기(+50) - 밸런스 조정
            const healAmount = data.amount === 1 ? 20 : 50;
            p.hunger = Math.min(100, p.hunger + healAmount);
            
            // 3번: 음식은 턴당 한 번만 (1개 혹은 2개 중 선택)
            p.actionPoints = 0; 

            io.to(data.roomCode).emit('syncEat', { 
                eaterID: socket.id, 
                newFoodCount: room.foodCount,
                hunger: p.hunger,
                amount: data.amount
            });
        }
    });

    socket.on('playerAttack', (data) => {
        const room = rooms[data.roomCode];
        if(room) {
            const victim = room.players.find(p => p.id === data.targetID);
            if(victim) {
                victim.hp = Math.max(0, victim.hp - 20); // 공격 시 HP 감소
                if(victim.hp <= 0) victim.alive = false;
                io.to(data.roomCode).emit('syncAttack', { 
                    attackerID: socket.id, targetID: data.targetID, newHp: victim.hp, isDead: !victim.alive 
                });
            }
        }
    });

    socket.on('nextDayReady', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            // 4번: 매일 허기 30 감소 및 HP 정산
            room.players.forEach(p => {
                if(p.alive) {
                    p.hunger -= 30;
                    if(p.hunger < 0) {
                        p.hp += p.hunger; // 허기가 마이너스면 그만큼 HP 감소
                        p.hunger = 0;
                    }
                    if(p.hp <= 0) { p.hp = 0; p.alive = false; }
                    p.actionPoints = 1; // 행동력 복구
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
server.listen(PORT, '0.0.0.0', () => console.log(`Server running`));