function watchSubmitted(){
  const q = query(
    collection(db,"orders"),
    where("shopId","==",SHOP_ID),
    where("userId","==",USER.userId),
    where("status","==","submitted"),
    orderBy("submittedAtClient","desc")
  );

  onSnapshot(q, snap => {
    const box = document.getElementById("submitted-orders");
    box.innerHTML = snap.empty ? "<i>尚無已送出訂單</i>" : "";

    snap.forEach(d => {
      const o = d.data();
      const div = document.createElement("div");
      div.className = "card";

      // 🔢 計算訂單總金額
      const total = o.items.reduce(
        (sum, i) => sum + i.price * i.qty,
        0
      );

      div.innerHTML = `
        <div class="small">
          送出時間：${o.submittedAt?.toDate().toLocaleString() || "處理中…"}
        </div>

        ${o.items.map(i => `
          <div>${i.name} × ${i.qty}</div>
        `).join("")}

        <div class="small" style="margin-top:6px;font-weight:bold;">
          💰 訂單總金額：$${total}
        </div>
      `;

      box.appendChild(div);
    });
  });
}
