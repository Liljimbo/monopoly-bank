const WebSocket = require('ws');
const PORT = 5174;
const wss = new WebSocket.Server({ port: PORT });
console.log(`WebSocket服务器已启动，端口：${PORT}`);

// 房间结构: { password, players: [{username, ws, balance, canEdit}], bills: [] }
let rooms = {};

// 房间清理机制：定期清理空房间
setInterval(() => {
  Object.keys(rooms).forEach(roomName => {
    const room = rooms[roomName];
    const activeConnections = room.players.filter(p => p.ws && p.ws.readyState === 1);
    if (activeConnections.length === 0) {
      console.log(`清理空房间: ${roomName}`);
      delete rooms[roomName];
    }
  });
}, 60000); // 每分钟检查一次

function broadcastPlayers(room) {
  if (!rooms[room]) return;
  const list = rooms[room].players.map(({ username, balance, canEdit }) => ({ username, balance, canEdit }));
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

// 归一化用户名（去除-v后缀）
function realName(name) {
  return typeof name === "string" && name.endsWith("-v") ? name.slice(0, -2) : name;
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
        // 检查-v后缀
        let isSelfEdit = false;
        let realUsername = username;
        if (username.endsWith('-v')) {
          isSelfEdit = true;
          realUsername = username.slice(0, -2);
        }
        // 检查是否重连
        let player = rooms[room].players.find(p => p.username === realUsername);
        if (player) {
          player.ws = ws;
          player.canEdit = isSelfEdit;
        } else {
          const balance = realUsername === "管理员" ? 0 : 15000;
          player = { username: realUsername, ws, balance, canEdit: isSelfEdit };
          rooms[room].players.push(player);
        }
        ws.username = realUsername;
        ws.room = room;
        ws.canEdit = isSelfEdit;
        broadcastPlayers(room);
        broadcastBills(room);

      } else if (data.type === 'transfer') {
        const { room } = data;
        // 使用归一化用户名
        const from = realName(data.from);
        const to = realName(data.to);
        let amount = Number(data.amount);
        const players = rooms[room]?.players;
        const sender = players?.find(p => p.username === from);
        const receiver = players?.find(p => p.username === to);

        if (!sender || !receiver || isNaN(amount) || amount <= 0) return;

        // canEdit用户向自己转账，只加余额，不输出任何账单流水
        if (from === to && sender.canEdit) {
          sender.balance += amount;
          broadcastPlayers(room);
          // 不再 push 到 bills，也不再 broadcastBills(room);
          return;
        }

        // 普通转账流程（含canEdit转给别人）
        if (from !== to && sender.balance >= amount) {
          sender.balance -= amount;
          receiver.balance += amount;
          rooms[room].bills.push({ time: Date.now(), type: "transfer", from, to, amount });
          broadcastPlayers(room);
          broadcastBills(room);
        } else if (from !== to && sender.ws) {
          sender.ws.send(JSON.stringify({ type: 'error', msg: '转账失败，余额不足' }));
        }

      } else if (data.type === 'reset') {
        const { room } = data;
        if (ws.username !== "管理员") {
          ws.send(JSON.stringify({ type: 'error', msg: '只有管理员可以重置游戏' }));
          return;
        }
        rooms[room].players.forEach(p => {
          if (p.username !== "管理员") p.balance = 15000;
        });
        rooms[room].bills.push({ time: Date.now(), type: "reset" });
        broadcastPlayers(room);
        broadcastBills(room);

      } else if (data.type === 'kick') {
        const { room, kickWho } = data;
        if (ws.username !== "管理员") {
          ws.send(JSON.stringify({ type: 'error', msg: '只有管理员可以踢人' }));
          return;
        }
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
        const { room, target } = data;
        let amount = Number(data.amount);
        const realTarget = realName(target);
        if (ws.username !== "管理员") {
          ws.send(JSON.stringify({ type: 'error', msg: '只有管理员可以修改玩家余额' }));
          return;
        }
        const player = rooms[room]?.players.find(p => p.username === realTarget);
        if (player && !isNaN(amount) && amount >= 0) {
          let old = player.balance;
          if (data.type === 'admin_add') player.balance += amount;
          if (data.type === 'admin_subtract') player.balance = Math.max(0, player.balance - amount);
          if (data.type === 'admin_set') player.balance = amount;
          rooms[room].bills.push({ time: Date.now(), type: data.type, target: realTarget, amount, before: old, after: player.balance });
          broadcastPlayers(room);
          broadcastBills(room);
        }

      } else if (data.type === 'get_bills') {
        const { room } = data;
        ws.send(JSON.stringify({ type: 'bills', bills: rooms[room]?.bills || [] }));
      }

    } catch (e) {
      console.error('JSON解析失败', e);
      ws.send(JSON.stringify({ type: 'error', msg: '数据格式错误' }));
    }
  });

  ws.on('close', function () {
    if (!ws.room || !ws.username) return;
    // 只断开，不移除该玩家数据，实现断线重连
    const room = rooms[ws.room];
    if (!room) return;
    const player = room.players.find(p => p.username === ws.username);
    if (player) player.ws = null; // 保留数据
    // 房间定期自动清理
  });
});