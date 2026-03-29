// [기존 server.js 내용에 추가/수정]
io.on('connection', (socket) => {
    // ... 입장 로직 유지 ...

    // 음식 먹기 동기화
    socket.on('playerEat', (data) => {
        // data: { roomID, eaterID, amount }
        const room = rooms[data.roomID];
        if (room) {
            room.food -= data.amount;
            io.emit('syncEat', { eaterID: data.eaterID, newFood: room.food });
        }
    });

    // 플랫폼 탑승 동기화
    socket.on('playerRide', (data) => {
        io.emit('syncRide', { riderID: data.riderID });
    });

    // 파이프 공격 동기화
    socket.on('playerAttack', (data) => {
        // data: { targetID, damage }
        io.emit('syncAttack', { attackerID: socket.id, targetID: data.targetID, damage: data.damage });
    });

    // 층 이동 완료 신호 (모든 유저가 준비되면 다음 층으로)
    socket.on('floorReady', (data) => {
        io.emit('syncNextFloor', { floor: data.nextFloor });
    });
});