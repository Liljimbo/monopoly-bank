const WebSocket = require('ws');
const PORT = 5174;
const wss = new WebSocket.Server({ port: PORT });
console.log(`WebSocket服务器已启动，端口：${PORT}`);

// 房间结构: { password, players: [{username, ws, balance}], bills: [] }
let rooms = {};

function broadcastPlayers(room) {
  if (!rooms[room]) return;
  const list = rooms[room].players.map(({ username, balance }) => ({ username, balance }));
  rooms[room].players.forEach(p => {
    if (p.ws && p.ws.readyState === 1) {
      p.ws.send(JSON.stringify({ type: 'player_list', list }));
    }
  });
}

function broadcastBills(room) {
  if (!rooms[room]) return;
  const bills = rooms[room].bills || [];
  rooms[room].players.forEach(p => {
    if (p.ws && p.ws.readyState === 1) {
      p.ws.send(JSON.stringify({ type: 'bills', bills }));
    }
  });
}

wss.on('connection', function connection(ws, req) {
  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message);
      if (data.type === 'create_room') {
        if (rooms[data.room]) {
          ws.send(JSON.stringify({ type: 'error', msg: '房间已存在' }));
          return;
        }
        rooms[data.room] = {
          password: data.password,
          players: [],
          bills: []
        };
        ws.send(JSON.stringify({ type: 'room_created' }));
      } else if (data.type === 'join') {
        const { room, username, password } = data;
        if (!rooms[room]) {
          ws.send(JSON.stringify({ type: 'error', msg: '房间不存在' }));
          ws.close();
          return;
        }
        if (rooms[room].password !== password) {
          ws.send(JSON.stringify({ type: 'error', msg: '房间密码错误' }));
          ws.close();
          return;
        }
        // 检查是否重连
        let player = rooms[room].players.find(p => p.username === username);
        if (player) {
          // 重连，换ws
          player.ws = ws;
        } else {
          const balance = username === "管理员" ? 0 : 15000;
          player = { username, ws, balance };
          rooms[room].players.push(player);
        }
        ws.username = username;
        ws.room = room;
        broadcastPlayers(room);
        broadcastBills(room);
      } else if (data.type === 'transfer') {
        const { room, from, to, amount } = data;
        const players = rooms[room]?.players;
        const sender = players?.find(p => p.username === from);
        const receiver = players?.find(p => p.username === to);
        if (sender && receiver && typeof amount === "number" && amount > 0 && sender.balance >= amount) {
          sender.balance -= amount;
          receiver.balance += amount;
          rooms[room].bills.push({ time: Date.now(), type: "transfer", from, to, amount });
          broadcastPlayers(room);
          broadcastBills(room);
        } else if (sender && sender.ws) {
          sender.ws.send(JSON.stringify({ type: 'error', msg: '转账失败，余额不足或参数错误' }));
        }
      } else if (data.type === 'reset') {
        const { room } = data;
        rooms[room].players.forEach(p => {
          if (p.username !== "管理员") p.balance = 15000;
        });
        rooms[room].bills.push({ time: Date.now(), type: "reset" });
        broadcastPlayers(room);
        broadcastBills(room);
      } else if (data.type === 'kick') {
        const { room, kickWho } = data;
        const idx = rooms[room].players.findIndex(p => p.username === kickWho);
        if (idx !== -1) {
          const kicked = rooms[room].players[idx];
          if (kicked.ws) kicked.ws.send(JSON.stringify({ type: 'error', msg: '你被房主踢出了房间' }));
          if (kicked.ws) kicked.ws.close();
          rooms[room].players.splice(idx, 1);
          rooms[room].bills.push({ time: Date.now(), type: "kick", kickWho });
          broadcastPlayers(room);
          broadcastBills(room);
        }
      } else if (data.type === 'admin_add' || data.type === 'admin_subtract' || data.type === 'admin_set') {
        const { room, target, amount } = data;
        const player = rooms[room]?.players.find(p => p.username === target);
        if (player && typeof amount === "number" && amount >= 0) {
          let old = player.balance;
          if (data.type === 'admin_add') player.balance += amount;
          if (data.type === 'admin_subtract') player.balance = Math.max(0, player.balance - amount);
          if (data.type === 'admin_set') player.balance = amount;
          rooms[room].bills.push({ time: Date.now(), type: data.type, target, amount, before: old, after: player.balance });
          broadcastPlayers(room);
          broadcastBills(room);
        }
      } else if (data.type === 'get_bills') {
        const { room } = data;
        ws.send(JSON.stringify({ type: 'bills', bills: rooms[room]?.bills || [] }));
      }
    } catch (e) {
      console.error('JSON解析失败', e);
    }
  });

  ws.on('close', function () {
    if (!ws.room || !ws.username) return;
    // 只断开，不移除该玩家数据，实现断线重连
    const room = rooms[ws.room];
    if (!room) return;
    const player = room.players.find(p => p.username === ws.username);
    if (player) player.ws = null; // 保留数据
    // 可选：如果所有ws都失联一段时间后清理房间，可加超时清理机制
  });
});