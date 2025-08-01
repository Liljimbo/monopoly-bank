import { useState } from "react";

export function BillList({ bills, username, canEdit }: {
  bills: any[],
  username: string,
  canEdit: boolean,
}) {
  // 过滤掉canEdit用户自己的自助流水
  const filteredBills = bills.filter(
    b => !(b.type === "self_transfer" && username === b.user && canEdit)
  );

  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const showCount = 3; // 默认显示3条
  const displayBills = expanded ? filteredBills : filteredBills.slice(-showCount);

  return (
    <div className="bill-list" style={{ marginTop: 24 }}>
      <b>账单流水：</b>
      <div className="bill-table-container">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>内容</th>
            </tr>
          </thead>
          <tbody>
            {displayBills.map((b, i) => (
              <tr key={i}>
                <td>{new Date(b.time).toLocaleString()}</td>
                <td>
                  {b.type === "transfer" && `${b.from} 向 ${b.to} 转账 ${b.amount}`}
                  {b.type === "self_transfer" && `${b.user} 自助加钱 ${b.amount}`}
                  {b.type === "reset" && "管理员重置所有玩家余额"}
                  {b.type === "admin_add" && `管理员为 ${b.target} 加钱 ${b.amount}`}
                  {b.type === "admin_subtract" && `管理员为 ${b.target} 扣钱 ${b.amount}`}
                  {b.type === "admin_set" && `管理员设定 ${b.target} 余额为 ${b.amount}`}
                  {b.type === "kick" && `管理员踢出 ${b.kickWho}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredBills.length > showCount && (
        <div style={{ textAlign: "center", marginTop: 8, display: "flex", justifyContent: "center", gap: 12 }}>
          <button onClick={() => setExpanded(e => !e)}>
            {expanded ? "收起流水" : `展开全部(${filteredBills.length}条)`}
          </button>
          <button onClick={() => setShowModal(true)}>弹窗查看全部流水</button>
        </div>
      )}
      {showModal && (
        <div className="bill-modal-bg" onClick={() => setShowModal(false)}>
          <div className="bill-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>全部账单流水</div>
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>内容</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((b, i) => (
                  <tr key={i}>
                    <td>{new Date(b.time).toLocaleString()}</td>
                    <td>
                      {b.type === "transfer" && `${b.from} 向 ${b.to} 转账 ${b.amount}`}
                      {b.type === "self_transfer" && `${b.user} 自助加钱 ${b.amount}`}
                      {b.type === "reset" && "管理员重置所有玩家余额"}
                      {b.type === "admin_add" && `管理员为 ${b.target} 加钱 ${b.amount}`}
                      {b.type === "admin_subtract" && `管理员为 ${b.target} 扣钱 ${b.amount}`}
                      {b.type === "admin_set" && `管理员设定 ${b.target} 余额为 ${b.amount}`}
                      {b.type === "kick" && `管理员踢出 ${b.kickWho}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button style={{ marginTop: 8 }} onClick={() => setShowModal(false)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}