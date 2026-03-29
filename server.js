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
    // [방 생성/혼자하기 공용]
    socket.on('createRoom', (nickname) => {
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomCode] = {
            code: roomCode,
            players: [{ 
                id: socket.id, name: nickname, hunger: 100, floor: 0, 
                alive: true, color: "#2ecc71", actionPoints: 1 
            }],
            foodCount: 8, 
            day: 1, isStarted: false
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, players: rooms[roomCode].players });
    });

    socket.on('joinRoom', (data) => {
        const room = rooms[data.roomCode];
        if (room && !room.isStarted && room.players.length < 4) {
            const player = { 
                id: socket.id, name: data.nickname, hunger: 100, floor: 0, 
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

    socket.on('playerEat', (data) => {
        const room = rooms[data.roomCode];
        if (!room) return;
        const p = room.players.find(player => player.id === socket.id);
        if (p && room.foodCount >= data.amount && p.actionPoints > 0) {
            room.foodCount -= data.amount;
            p.hunger = Math.min(100, p.hunger + (data.amount === 1 ? 30 : 70));
            if (data.amount === 2) p.actionPoints = 0;
            io.to(data.roomCode).emit('syncEat', { eaterID: socket.id, newFoodCount: room.foodCount, amount: data.amount, hunger: p.hunger });
        }
    });

    socket.on('playerAttack', (data) => {
        const room = rooms[data.roomCode];
        if(room) {
            const victim = room.players.find(p => p.id === data.targetID);
            if(victim) {
                victim.hunger = Math.max(0, victim.hunger - 30);
                if(victim.hunger <= 0) victim.alive = false;
                io.to(data.roomCode).emit('syncAttack', { attackerID: socket.id, targetID: data.targetID, newHunger: victim.hunger, isDead: !victim.alive });
            }
        }
    });

    socket.on('sendMsg', (data) => { io.to(data.roomCode).emit('receiveMsg', data); });

    socket.on('nextDayReady', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            room.players.forEach(p => p.actionPoints = 1);
            room.foodCount = 8;
            room.day++;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server is running`));