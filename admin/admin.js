import { initFirebase, db } from "../shared/firebase.js";
import { SHOP_ID } from "../shared/constants.js";

import {
  collection, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

initFirebase();

const listEl = document.getElementById("product-list");
const msgEl = document.getElementById("msg");
document.getElementById("env").innerText = `SHOP_ID = ${SHOP_ID}`;

document.getElementById("btn-refresh").onclick = () => loadProducts();
document.getElementById("btn-new").onclick = () => alert("下一步會做：新增商品（Step 2）");

loadProducts();

async function loadProducts() {
  msgEl.innerText = "載入商品中…";
  listEl.innerHTML = "<i>載入中…</i>";

  const q = query(
    collection(db, "products", SHOP_ID, "items"),
    orderBy("sort", "asc")
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    listEl.innerHTML = "<i>目前沒有商品</i>";
    msgEl.innerText = "✅ 載入完成（0 筆）";
    return;
  }

  listEl.innerHTML = "";
  snap.forEach(d => {
    const p = d.data();

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div>
        <span class="badge ${p.enabled ? "on" : "off"}">${p.enabled ? "上架" : "下架"}</span>
        <b>${p.name}</b>　$${p.price}
      </div>
      <div class="small">
        商品ID：${d.id}　
        限購：${p.maxSalecount ?? "-"}　
        排序：${p.sort ?? "-"}
      </div>
    `;
    listEl.appendChild(div);
  });

  msgEl.innerText = `✅ 載入完成（${snap.size} 筆）`;
}
