const WebSocket = require('ws');
const PORT = 5174;
const wss = new WebSocket.Server({ port: PORT });
console.log(`WebSocket服务器已启动，端口：${PORT}`);

let players = []; // {username, room, ws, balance}

function broadcastPlayers(room) {
  const list = players
    .filter(p => p.room === room)
    .map(({ username, balance }) => ({ username, balance }));
  players
    .filter(p => p.room === room)
    .forEach(p => {
      p.ws.send(JSON.stringify({ type: 'player_list', list }));
    });
}

wss.on('connection', function connection(ws, req) {
  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message);
      if (data.type === 'join') {
        const exists = players.find(
          p => p.username === data.username && p.room === data.room
        );
        if (exists) {
          ws.send(JSON.stringify({ type: 'error', msg: '用户名已存在' }));
          ws.close();
          return;
        }
        ws.username = data.username;
        ws.room = data.room;
        const balance = data.username === "管理员" ? 0 : 15000;
        players.push({ username: data.username, room: data.room, ws, balance });
        console.log(`玩家加入：${data.username}，房间：${data.room}`);
        broadcastPlayers(data.room);
      }
      if (data.type === 'transfer') {
        const from = players.find(
          p => p.username === data.from && p.room === data.room
        );
        const to = players.find(
          p => p.username === data.to && p.room === data.room
        );
        if (
          from &&
          to &&
          typeof data.amount === "number" &&
          data.amount > 0 &&
          from.balance >= data.amount
        ) {
          from.balance -= data.amount;
          to.balance += data.amount;
          broadcastPlayers(data.room);
        } else {
          ws.send(JSON.stringify({ type: 'error', msg: '转账失败，余额不足或参数错误' }));
        }
      }
      if (data.type === 'reset') {
        players
          .filter(p => p.room === data.room && p.username !== "管理员")
          .forEach(p => (p.balance = 15000));
        broadcastPlayers(data.room);
      }
      if (data.type === 'kick') {
        const idx = players.findIndex(
          p => p.username === data.kickWho && p.room === data.room
        );
        if (idx !== -1) {
          players[idx].ws.send(JSON.stringify({ type: 'error', msg: '你被房主踢出了房间' }));
          players[idx].ws.close();
          players.splice(idx, 1);
          broadcastPlayers(data.room);
        }
      }
      // 新增：管理员直接操作玩家余额
      if (data.type === 'admin_add') {
        // data.target, data.amount, data.room
        const target = players.find(p => p.username === data.target && p.room === data.room);
        if (target && typeof data.amount === "number" && data.amount > 0) {
          target.balance += data.amount;
          broadcastPlayers(data.room);
        }
      }
      if (data.type === 'admin_subtract') {
        const target = players.find(p => p.username === data.target && p.room === data.room);
        if (target && typeof data.amount === "number" && data.amount > 0) {
          target.balance = Math.max(0, target.balance - data.amount);
          broadcastPlayers(data.room);
        }
      }
      if (data.type === 'admin_set') {
        const target = players.find(p => p.username === data.target && p.room === data.room);
        if (target && typeof data.amount === "number" && data.amount >= 0) {
          target.balance = data.amount;
          broadcastPlayers(data.room);
        }
      }
    } catch (e) {
      console.error('JSON解析失败', e);
    }
  });

  ws.on('close', function () {
    if (ws.username && ws.room) {
      players = players.filter(p => p.ws !== ws);
      broadcastPlayers(ws.room);
    }
  });
});