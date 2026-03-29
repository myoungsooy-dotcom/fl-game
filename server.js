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
    socket.on('createRoom', (data) => {
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        const nickname = (typeof data === 'string') ? data : (data.nickname || "플레이어");
        const isSolo = (typeof data === 'object' && data.isSolo);

        let players = [{ 
            id: socket.id, name: nickname, hp: 100, hunger: 100, floor: 0, 
            alive: true, color: "#2ecc71", hasEaten: false, isAI: false
        }];

        // AI 3명 추가 (혼자하기 모드)
        if(isSolo) {
            for(let i=1; i<=3; i++) {
                players.push({
                    id: `ai_${i}_${roomCode}`, name: `AI_${i}`, hp: 100, hunger: 100, floor: 0,
                    alive: true, color: "#95a5a6", hasEaten: false, isAI: true
                });
            }
        }

        rooms[roomCode] = { code: roomCode, players, foodCount: 8, day: 1, isStarted: false };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, players: rooms[roomCode].players, isSolo });
    });

    socket.on('joinRoom', (data) => {
        const room = rooms[data.roomCode];
        if (room && !room.isStarted) {
            room.players.push({ 
                id: socket.id, name: data.nickname, hp: 100, hunger: 100, floor: 0, 
                alive: true, color: "#3498db", hasEaten: false, isAI: false 
            });
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

    // 음식 먹기 로직 (수정됨)
    socket.on('playerEat', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        const p = room.players.find(player => player.id === socket.id);
        if (p && room.foodCount >= data.amount && !p.hasEaten) {
            room.foodCount -= data.amount;
            p.hunger = Math.min(100, p.hunger + (data.amount === 1 ? 20 : 50));
            p.hasEaten = true;
            io.to(data.roomCode).emit('syncEat', { eaterID: socket.id, newFoodCount: room.foodCount, hunger: p.hunger });
        }
    });

    // AI 자동 행동 (음식 먹기)
    socket.on('aiTurn', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        room.players.forEach(p => {
            if (p.isAI && p.alive && p.floor === data.floor && !p.hasEaten && room.foodCount > 0) {
                const amount = room.foodCount >= 2 ? 2 : 1;
                room.foodCount -= amount;
                p.hunger = Math.min(100, p.hunger + (amount === 1 ? 20 : 50));
                p.hasEaten = true;
                io.to(data.roomCode).emit('syncEat', { eaterID: p.id, newFoodCount: room.foodCount, hunger: p.hunger });
            }
        });
    });

    socket.on('playerAttack', (data) => {
        const room = rooms[data.roomCode];
        const victim = room?.players.find(p => p.id === data.targetID);
        if(victim) {
            victim.hp = Math.max(0, victim.hp - 20);
            if(victim.hp <= 0) victim.alive = false;
            io.to(data.roomCode).emit('syncAttack', { targetID: data.targetID, newHp: victim.hp, isDead: !victim.alive });
        }
    });

    socket.on('nextDayReady', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            room.players.forEach(p => {
                if(p.alive) {
                    p.hunger -= 30;
                    if(p.hunger < 0) { p.hp += p.hunger; p.hunger = 0; }
                    if(p.hp <= 0) { p.hp = 0; p.alive = false; }
                    p.hasEaten = false;
                }
            });
            room.foodCount = 8;
            room.day++;
            io.to(roomCode).emit('newDayStarted', { room });
        }
    });

    socket.on('sendMsg', (data) => { io.to(data.roomCode).emit('receiveMsg', data); });
});

server.listen(3000, '0.0.0.0', () => console.log("Server Running"));