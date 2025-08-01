export function BillList({ bills }) {
  return (
    <div style={{ marginTop: 18 }}>
      <b>账单流水：</b>
      <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#eee" }}>
            <th>时间</th>
            <th>类型</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((b, i) => (
            <tr key={i}>
              <td>{new Date(b.time).toLocaleString()}</td>
              <td>{b.type}</td>
              <td>
                {b.type === "transfer" && `${b.from} 向 ${b.to} 转账 ${b.amount}`}
                {b.type === "admin_add" && `管理员给 ${b.target} 加 ${b.amount}`}
                {b.type === "admin_subtract" && `管理员扣 ${b.target} ${b.amount}`}
                {b.type === "admin_set" && `管理员设定 ${b.target} 余额为 ${b.amount}`}
                {b.type === "reset" && "房主重置所有余额"}
                {b.type === "kick" && `管理员踢出 ${b.kickWho}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}