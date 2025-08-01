import { useState, useRef, useEffect } from "react";
import { BillList } from "./BillList";
import { QRCodeSVG } from "qrcode.react";
import "./App.css";
import "./AppResponsive.css";
import "./AppEnhanced.css"; // 增强样式

function saveLogin(data: any) {
  localStorage.setItem('bank_login', JSON.stringify(data));
}
function loadLogin() {
  try { return JSON.parse(localStorage.getItem('bank_login') || '{}'); } catch { return {}; }
}
function clearLogin() { localStorage.removeItem('bank_login'); }

function App() {
  const [mode, setMode] = useState<"host" | "player" | null>(null);

  useEffect(() => {
    const info = loadLogin();
    if (info && info.mode) setMode(info.mode);
  }, []);

  function handleLogout() {
    clearLogin();
    window.location.reload();
  }

  return (
    <div className="app">
      <h1 className="main-title">大富翁银行系统</h1>
      {!mode && (
        <div className="mode-select center">
          <button className="my-btn main-btn" onClick={() => setMode("host")}>作为管理员（主机）创建房间</button>
          <button className="my-btn main-btn" onClick={() => setMode("player")}>作为玩家扫码加入房间</button>
        </div>
      )}
      {mode === "host" && <HostRoom onLogout={handleLogout} />}
      {mode === "player" && <JoinRoom onLogout={handleLogout} />}
    </div>
  );
}

function getLocalIP() {
  return window.location.hostname;
}

function HostRoom({ onLogout, roomName: propRoomName, roomPwd: propRoomPwd }: {
  onLogout: () => void;
  roomName?: string;
  roomPwd?: string;
}) {
  const [roomName, setRoomName] = useState(() => propRoomName ?? loadLogin().roomName ?? "");
  const [roomPwd, setRoomPwd] = useState(() => propRoomPwd ?? loadLogin().roomPwd ?? "");
  const [created, setCreated] = useState(() =>
    !!(propRoomName && propRoomPwd) ||
    !!loadLogin().roomName
  );
  const [players, setPlayers] = useState<{ username: string; balance: number; canEdit?: boolean }[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [editStates, setEditStates] = useState<Record<string, { add: string; subtract: string; set: string }>>({});

  useEffect(() => {
    if (!created) return;
    let ws = wsRef.current;
    if (!ws || ws.readyState > 1) {
      ws = new WebSocket(`ws://${window.location.hostname}:5174`);
      wsRef.current = ws;
    }
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", username: "管理员", room: roomName, password: roomPwd }));
    };
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "player_list") setPlayers(data.list);
        if (data.type === "bills") setBills(data.bills);
        if (data.type === "error") alert(data.msg);
      } catch { }
    };
    ws.onerror = () => { };
    ws.onclose = () => { };
    return () => ws.close();
  }, [created, roomName, roomPwd]);

  function handleCreateRoom() {
    if (!roomName.trim() || !roomPwd.trim()) {
      alert("房间名和密码不能为空");
      return;
    }
    const ws = new WebSocket(`ws://${window.location.hostname}:5174`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "create_room", room: roomName, password: roomPwd }));
    };
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "room_created") {
        setCreated(true);
        saveLogin({ mode: "host", roomName, roomPwd });
      } else if (data.type === "error") {
        alert(data.msg);
      }
    };
  }

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
    setEditStates(s => ({ ...s, [username]: { ...s[username], [type]: "" } }));
  }

  function updateEdit(username: string, type: "add" | "subtract" | "set", val: string) {
    setEditStates(s => ({
      ...s,
      [username]: { ...s[username], [type]: val }
    }));
  }

  return (
    <div>
      {!created ? (
        <div className="room-card">
          <div className="room-title">创建房间</div>
          <div className="room-info">
            <label>
              房间名：
              <input
                className="my-input"
                type="text"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                placeholder="请输入房间名"
              />
            </label>
          </div>
          <div className="room-info">
            <label>
              房间密码：
              <input
                className="my-input"
                type="password"
                value={roomPwd}
                onChange={e => setRoomPwd(e.target.value)}
                placeholder="请输入房间密码"
              />
            </label>
          </div>
          <button
            className="my-btn main-btn"
            style={{ marginTop: 20 }}
            onClick={handleCreateRoom}
          >
            创建房间
          </button>
        </div>
      ) : (
        <>
          <div className="room-card">
            <div className="room-title">房间：{roomName}</div>
            <div className="room-info">密码：{roomPwd}</div>
            <div className="room-info">本机IP：<span style={{ color: "#2196f3" }}>{getLocalIP()}</span></div>
            <div className="qr-section">
              <div className="qr-label">扫码快速加入房间</div>
              <QRCodeSVG
                value={`http://${window.location.hostname}:4173/?room=${encodeURIComponent(roomName)}&pwd=${encodeURIComponent(roomPwd)}`}
                size={180}
                level="Q"
              />
              <div className="qr-tip">手机/平板扫码自动填写房间名和密码</div>
            </div>
          </div>
          <div className="main-section">
            <div className="players-title">当前玩家列表</div>
            <div className="bill-table-container">
              <table>
                <thead>
                  <tr>
                    <th>用户名</th>
                    <th>余额</th>
                    <th>管理操作</th>
                    <th>踢出</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={i}>
                      <td data-label="用户名">{p.username}</td>
                      <td data-label="余额">{p.balance}</td>
                      <td data-label="管理操作">
                        {p.username !== "管理员" && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <input
                              className="my-input"
                              type="number"
                              value={editStates[p.username]?.add || ""}
                              onChange={e => updateEdit(p.username, "add", e.target.value)}
                              placeholder="加"
                              style={{ width: 50 }}
                            />
                            <button className="my-btn mini-btn" onClick={() => handleAdminAction(p.username, "add")}>加钱</button>
                            <input
                              className="my-input"
                              type="number"
                              value={editStates[p.username]?.subtract || ""}
                              onChange={e => updateEdit(p.username, "subtract", e.target.value)}
                              placeholder="扣"
                              style={{ width: 50 }}
                            />
                            <button className="my-btn mini-btn" onClick={() => handleAdminAction(p.username, "subtract")}>扣钱</button>
                            <input
                              className="my-input"
                              type="number"
                              value={editStates[p.username]?.set || ""}
                              onChange={e => updateEdit(p.username, "set", e.target.value)}
                              placeholder="设置"
                              style={{ width: 60 }}
                            />
                            <button className="my-btn mini-btn" onClick={() => handleAdminAction(p.username, "set")}>设定</button>
                          </div>
                        )}
                      </td>
                      <td data-label="踢出">
                        {p.username !== "管理员" && (
                          <button className="my-btn danger-btn" onClick={() => handleKick(p.username)}>
                            踢出
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="my-btn warn-btn" style={{ marginTop: 12 }} onClick={handleReset}>重置所有玩家余额</button>
            <BillList bills={bills} username="管理员" canEdit={false} />
            <button className="my-btn danger-btn" style={{ marginTop: 18 }} onClick={onLogout}>退出管理</button>
          </div>
        </>
      )}
    </div>
  );
}

function JoinRoom({ onLogout }: { onLogout: () => void }) {
  const [ip, setIp] = useState(() => loadLogin().ip || window.location.hostname || "");
  const [room, setRoom] = useState(() => loadLogin().room || "");
  const [pwd, setPwd] = useState(() => loadLogin().pwd || "");
  const [username, setUsername] = useState(() => loadLogin().username || "");
  const [joined, setJoined] = useState(() => !!loadLogin().username && !!loadLogin().room && !!loadLogin().pwd);
  const [err, setErr] = useState("");
  const [players, setPlayers] = useState<{ username: string; balance: number; canEdit?: boolean }[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  // 记录登录时实际提交到服务端的用户名（admin→管理员）
  const [loginUser, setLoginUser] = useState(() => {
    const u = loadLogin().username || "";
    return u.trim().toLowerCase() === "admin" ? "管理员" : u;
  });

  // 自动读取url参数填充表单
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    const pwdParam = params.get("pwd");
    if (roomParam) setRoom(roomParam);
    if (pwdParam) setPwd(pwdParam);
  }, []);

  useEffect(() => {
    if (!joined) return;
    let ws = wsRef.current;
    if (!ws || ws.readyState > 1) {
      ws = new WebSocket(`ws://${ip}:5174`);
      wsRef.current = ws;
    }
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", room, username: loginUser, password: pwd }));
      ws.send(JSON.stringify({ type: "get_bills", room }));
    };
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "player_list") setPlayers(data.list);
        if (data.type === "bills") setBills(data.bills);
        if (data.type === "error") setErr(data.msg);
      } catch { }
    };
    ws.onerror = () => setErr("无法连接到主机，请检查IP和网络");
    ws.onclose = () => { };
    return () => ws.close();
    // eslint-disable-next-line
  }, [joined, ip, room, pwd, loginUser]);

  function handleJoin() {
    setErr("");
    if (!ip.trim()) { setErr("主机IP不能为空"); return; }
    if (!room.trim()) { setErr("房间名不能为空"); return; }
    if (!pwd.trim()) { setErr("房间密码不能为空"); return; }
    if (!username.trim()) { setErr("用户名不能为空"); return; }
    // admin 自动映射为“管理员”
    const loginUserFixed = username.trim().toLowerCase() === "admin" ? "管理员" : username.trim();
    saveLogin({ mode: "player", ip, room, pwd, username: loginUserFixed });
    setLoginUser(loginUserFixed);
    setJoined(true);
  }

  if (joined) {
    const self = players.find(p => p.username === loginUser);
    const canEdit = !!self?.canEdit;
    const isAdmin = self?.username === "管理员";

    if (isAdmin) {
      // 关键：传递room/pwd props，HostRoom会直接进入管理界面
      return <HostRoom onLogout={onLogout} roomName={room} roomPwd={pwd} />;
    }

    return (
      <div>
        <div className="room-card">
          <div className="room-title">欢迎，{loginUser}</div>
          <div className="room-info">主机IP：{ip}</div>
          <div className="room-info">房间名：{room}</div>
          <div className="room-info">我的当前余额：<span style={{ color: "#009688", fontWeight: "bold" }}>{self?.balance ?? "--"}</span></div>
        </div>
        <div className="main-section">
          <div className="players-title">所有玩家</div>
          <div className="bill-table-container">
            <table>
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>余额</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={i}>
                    <td data-label="用户名">{p.username}</td>
                    <td data-label="余额">{p.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="transfer-section">
            <b>向其他玩家转账：</b>
            <div style={{ marginTop: 8 }}>
              <select className="my-input" value={to} onChange={e => setTo(e.target.value)}>
                <option value="">请选择收款人</option>
                {players
                  .filter(p =>
                    canEdit
                      ? (p.username !== "管理员")
                      : (p.username !== loginUser && p.username !== "管理员")
                  )
                  .map((p, i) => (
                    <option key={i} value={p.username}>
                      {p.username}
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ marginTop: 8 }}>
              <input
                className="my-input"
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="金额"
              />
            </div>
            <button className="my-btn main-btn" style={{ marginTop: 8 }} onClick={() => {
              setErr("");
              const amt = Number(amount);
              if (!to || !amount || isNaN(amt) || amt <= 0) {
                setErr("请输入有效的收款人和金额！");
                return;
              }
              wsRef.current?.send(
                JSON.stringify({
                  type: "transfer",
                  from: loginUser,
                  to,
                  amount: amt,
                  room,
                })
              );
              setAmount("");
            }}>
              转账
            </button>
            {err && <div style={{ color: "red", marginTop: 10 }}>{err}</div>}
          </div>
          <BillList bills={bills} username={loginUser} canEdit={canEdit} />
          <button className="my-btn danger-btn" style={{ marginTop: 18 }} onClick={() => { clearLogin(); onLogout(); }}>退出房间</button>
        </div>
      </div>
    );
  }

  return (
    <div className="room-card">
      <div className="room-title">玩家加入</div>
      <div className="room-info">
        <label>
          主机IP：
          <input
            className="my-input"
            type="text"
            value={ip}
            onChange={e => setIp(e.target.value)}
            placeholder="如 192.168.1.100"
          />
        </label>
      </div>
      <div className="room-info">
        <label>
          房间名：
          <input
            className="my-input"
            type="text"
            value={room}
            onChange={e => setRoom(e.target.value)}
            placeholder="请输入房间名"
          />
        </label>
      </div>
      <div className="room-info">
        <label>
          房间密码：
          <input
            className="my-input"
            type="password"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            placeholder="请输入房间密码"
          />
        </label>
      </div>
      <div className="room-info">
        <label>
          用户名：
          <input
            className="my-input"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="请输入用户名（管理员请填 admin）"
          />
        </label>
      </div>
      <button className="my-btn main-btn" style={{ marginTop: 20 }} onClick={handleJoin}>加入房间</button>
      {err && <div style={{ color: "red", marginTop: 10 }}>{err}</div>}
    </div>
  );
}

export default App;