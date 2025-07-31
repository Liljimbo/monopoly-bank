import { useState, useRef, useEffect } from "react";
import "./App.css";

function App() {
  const [mode, setMode] = useState<"host" | "player" | null>(null);

  return (
    <div className="app">
      <h1>大富翁银行系统</h1>
      {!mode && (
        <div className="mode-select">
          <button onClick={() => setMode("host")}>作为管理员（主机）创建房间</button>
          <button onClick={() => setMode("player")}>作为玩家扫码加入房间</button>
        </div>
      )}
      {mode === "host" && <HostRoom />}
      {mode === "player" && <JoinRoom />}
    </div>
  );
}

function getLocalIP() {
  return window.location.hostname;
}

function HostRoom() {
  const [roomName, setRoomName] = useState("");
  const [created, setCreated] = useState(false);
  const [players, setPlayers] = useState<{ username: string; balance: number }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // 新增：为每个玩家记录输入
  const [editStates, setEditStates] = useState<Record<string, { add: string; subtract: string; set: string }>>({});

  useEffect(() => {
    if (!created) return;
    const ws = new WebSocket(`ws://${window.location.hostname}:5174`);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", username: "管理员", room: roomName }));
    };
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "player_list") {
          setPlayers(data.list);
        }
        if (data.type === "error") {
          alert(data.msg);
        }
      } catch {}
    };
    ws.onerror = () => {};
    ws.onclose = () => {};
    return () => ws.close();
  }, [created, roomName]);

  function handleReset() {
    wsRef.current?.send(JSON.stringify({ type: "reset", room: roomName }));
  }

  function handleKick(username: string) {
    wsRef.current?.send(JSON.stringify({ type: "kick", room: roomName, kickWho: username }));
  }

  function handleAdminAction(username: string, type: "add" | "subtract" | "set") {
    const value = editStates[username]?.[type] || "";
    const num = Number(value);
    if (isNaN(num) || (type !== "set" && num <= 0) || (type === "set" && num < 0)) {
      alert("请输入有效金额");
      return;
    }
    if (type === "add") {
      wsRef.current?.send(JSON.stringify({ type: "admin_add", target: username, amount: num, room: roomName }));
    }
    if (type === "subtract") {
      wsRef.current?.send(JSON.stringify({ type: "admin_subtract", target: username, amount: num, room: roomName }));
    }
    if (type === "set") {
      wsRef.current?.send(JSON.stringify({ type: "admin_set", target: username, amount: num, room: roomName }));
    }
    setEditStates(s => ({
      ...s,
      [username]: { ...s[username], [type]: "" }
    }));
  }

  function updateEdit(username: string, type: "add" | "subtract" | "set", val: string) {
    setEditStates(s => ({
      ...s,
      [username]: { ...s[username], [type]: val }
    }));
  }

  return (
    <div>
      <h2>管理员房间</h2>
      {!created ? (
        <>
          <label>
            房间名：
            <input
              type="text"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              placeholder="请输入房间名"
              style={{ width: "80%", marginTop: 8 }}
            />
          </label>
          <button
            style={{ marginTop: 20 }}
            onClick={() => {
              if (!roomName.trim()) {
                alert("房间名不能为空！");
                return;
              }
              setCreated(true);
            }}
          >
            创建房间
          </button>
        </>
      ) : (
        <>
          <div>
            <b>房间名：</b>{roomName}
          </div>
          <div style={{ marginTop: 10 }}>
            <b>本机IP：</b>
            <span style={{ fontSize: "1.2em", color: "#2196f3" }}>
              {getLocalIP()}
            </span>
          </div>
          <div style={{ marginTop: 10, color: "#666", fontSize: 14 }}>
            让玩家输入此IP地址及房间名和用户名即可加入。
          </div>
          <div style={{ marginTop: 20 }}>
            <b>当前玩家列表：</b>
            <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#eee" }}>
                  <th>用户名</th>
                  <th>余额</th>
                  <th>管理操作</th>
                  <th>踢出</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={i}>
                    <td>{p.username}</td>
                    <td>{p.balance}</td>
                    <td>
                      {p.username !== "管理员" && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <input
                            type="number"
                            value={editStates[p.username]?.add || ""}
                            onChange={e => updateEdit(p.username, "add", e.target.value)}
                            placeholder="加"
                            style={{ width: 50 }}
                          />
                          <button onClick={() => handleAdminAction(p.username, "add")}>加钱</button>
                          <input
                            type="number"
                            value={editStates[p.username]?.subtract || ""}
                            onChange={e => updateEdit(p.username, "subtract", e.target.value)}
                            placeholder="扣"
                            style={{ width: 50 }}
                          />
                          <button onClick={() => handleAdminAction(p.username, "subtract")}>扣钱</button>
                          <input
                            type="number"
                            value={editStates[p.username]?.set || ""}
                            onChange={e => updateEdit(p.username, "set", e.target.value)}
                            placeholder="设置"
                            style={{ width: 60 }}
                          />
                          <button onClick={() => handleAdminAction(p.username, "set")}>设定</button>
                        </div>
                      )}
                    </td>
                    <td>
                      {p.username !== "管理员" && (
                        <button style={{ color: "red" }} onClick={() => handleKick(p.username)}>
                          踢出
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button style={{ marginTop: 12 }} onClick={handleReset}>重置所有玩家余额</button>
          </div>
        </>
      )}
    </div>
  );
}


function JoinRoom() {
  const [ip, setIp] = useState(window.location.hostname || "");
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [err, setErr] = useState("");
  const [players, setPlayers] = useState<{ username: string; balance: number }[]>([]);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  function handleJoin() {
    setErr("");
    if (!ip.trim()) {
      setErr("主机IP不能为空");
      return;
    }
    if (!room.trim()) {
      setErr("房间名不能为空");
      return;
    }
    if (!username.trim()) {
      setErr("用户名不能为空");
      return;
    }
    try {
      const ws = new WebSocket(`ws://${ip}:5174`);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", username, room }));
        setJoined(true);
      };
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === "player_list") {
            setPlayers(data.list);
          }
          if (data.type === "error") {
            setErr(data.msg);
          }
        } catch {}
      };
      ws.onerror = () => setErr("无法连接到主机，请检查IP和网络");
      ws.onclose = () => {};
    } catch (e) {
      setErr("WebSocket连接失败");
    }
  }

  function handleTransfer() {
    setErr("");
    const amt = Number(amount);
    if (!to || !amount || isNaN(amt) || amt <= 0) {
      setErr("请输入有效的收款人和金额！");
      return;
    }
    wsRef.current?.send(
      JSON.stringify({
        type: "transfer",
        from: username,
        to,
        amount: amt,
        room,
      })
    );
    setAmount("");
  }

  if (joined) {
    const self = players.find(p => p.username === username);
    return (
      <div>
        <h2>已加入房间</h2>
        <div>
          <b>主机IP：</b>{ip}
        </div>
        <div>
          <b>用户名：</b>{username}
        </div>
        <div>
          <b>房间名：</b>{room}
        </div>
        <div style={{ marginTop: 10, color: "#666", fontSize: 14 }}>
          <b>我的当前余额：</b>
          <span style={{ color: "#009688", fontWeight: "bold" }}>{self?.balance ?? "--"}</span>
        </div>
        <div style={{ marginTop: 18 }}>
          <b>所有玩家：</b>
          <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#eee" }}>
                <th>用户名</th>
                <th>余额</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={i}>
                  <td>{p.username}</td>
                  <td>{p.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 18, border: "1px solid #eee", padding: 12, borderRadius: 4 }}>
          <b>向其他玩家转账：</b>
          <div style={{ marginTop: 8 }}>
            <select value={to} onChange={e => setTo(e.target.value)} style={{ width: "60%" }}>
              <option value="">请选择收款人</option>
              {players
                .filter(p => p.username !== username && p.username !== "管理员")
                .map((p, i) => (
                  <option key={i} value={p.username}>
                    {p.username}
                  </option>
                ))}
            </select>
          </div>
          <div style={{ marginTop: 8 }}>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="金额"
              style={{ width: "60%" }}
            />
          </div>
          <button style={{ marginTop: 8 }} onClick={handleTransfer}>
            转账
          </button>
          {err && <div style={{ color: "red", marginTop: 10 }}>{err}</div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>玩家加入</h2>
      <div>
        <label>
          主机IP：
          <input
            type="text"
            value={ip}
            onChange={e => setIp(e.target.value)}
            placeholder="如 192.168.1.100"
            style={{ width: "80%", marginTop: 8 }}
          />
        </label>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>
          房间名：
          <input
            type="text"
            value={room}
            onChange={e => setRoom(e.target.value)}
            placeholder="请输入房间名"
            style={{ width: "80%", marginTop: 8 }}
          />
        </label>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>
          用户名：
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="请输入用户名"
            style={{ width: "80%", marginTop: 8 }}
          />
        </label>
      </div>
      <button style={{ marginTop: 20 }} onClick={handleJoin}>加入房间</button>
      {err && <div style={{ color: "red", marginTop: 10 }}>{err}</div>}
    </div>
  );
}

export default App;