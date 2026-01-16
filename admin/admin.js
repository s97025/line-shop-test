import { SHOP_ID } from "../shared/constants.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  setDoc,
  doc,
  getFirestore,
  where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

let editingProductId = null;
let soldCountMap = {};  
let latestProductsSnap = null;

/* =========================
   Firebase init（admin）
========================= */

const firebaseConfig = {
  apiKey: "AIzaSyAk5SaAAvifvTV3dUW4mddRvvgySbdIysc",
  authDomain: "line-shop-ef578.firebaseapp.com",
  projectId: "line-shop-ef578"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


/* =========================
   UI refs
========================= */

const listEl = document.getElementById("product-list");
const msgEl = document.getElementById("msg");
const formPanel = document.getElementById("form-panel");

document.getElementById("env").innerText = `SHOP_ID = ${SHOP_ID}`;

document.getElementById("btn-refresh").onclick = () => {
  if (!latestProductsSnap) return;
  renderProductsFromSnap(latestProductsSnap);
};

document.getElementById("btn-new").onclick = () => {
  editingProductId = null;
  clearForm();
  document.querySelector("#form-panel h3").innerText = "➕ 新增商品";
  formPanel.style.display = "block";
};

document.getElementById("btn-cancel").onclick = () => {
  formPanel.style.display = "none";
};

/* =========================
   Save new product
========================= */

document.getElementById("btn-save").onclick = async () => {
  const name = document.getElementById("f-name").value.trim();
  const priceRaw = document.getElementById("f-price").value.trim();
  const price = Number(priceRaw);

  const imageUrl = document.getElementById("f-image").value.trim();
  const maxSalecount = Number(document.getElementById("f-max").value);
  const sort = Number(document.getElementById("f-sort").value);
  const enabled = document.getElementById("f-enabled").checked;

  if (!name) {
    alert("請填寫商品名稱");
    return;
  }

  if (priceRaw === "" || Number.isNaN(price) || price <= 0) {
    alert("請填寫正確的價格");
    return;
  }

  try {
    if (editingProductId) {
      // ✅ 編輯既有商品
      await setDoc(
        doc(db, "products", SHOP_ID, "items", editingProductId),
        {
          name,
          price,
          imageUrl,
          maxSalecount,
          sort,
          enabled,
          updatedAt: Date.now()
        },
        { merge: true }
      );
      msgEl.innerText = "✅ 商品已更新";
    } else {
      // ✅ 新增商品
      const id = "p" + Date.now();
      await setDoc(doc(db, "products", SHOP_ID, "items", id), {
        name,
        price,
        imageUrl,
        maxSalecount,
        sort,
        enabled,
        createdAt: Date.now()
      });
      msgEl.innerText = "✅ 商品已新增";
    }

    editingProductId = null;
    formPanel.style.display = "none";
    clearForm();
  } catch (err) {
    console.error(err);
    alert("❌ 儲存失敗，請看 Console");
  }
};



function clearForm() {
  document.getElementById("f-name").value = "";
  document.getElementById("f-price").value = "";
  document.getElementById("f-image").value = "";
  document.getElementById("f-max").value = 50;
  document.getElementById("f-sort").value = 0;
  document.getElementById("f-enabled").checked = true;
}

/* =========================
   watch Products
========================= */
function renderProductsFromSnap(snap) {
  listEl.innerHTML = "";

  snap.forEach(d => {
    const p = d.data();
    const sold = soldCountMap[d.id] || 0;
    const max = Number.isFinite(p.maxSalecount)
      ? p.maxSalecount
      : Infinity;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <div>
        <span class="badge ${p.enabled ? "on" : "off"}">
          ${p.enabled ? "上架" : "下架"}
        </span>
        <b>${p.name}</b>　$${p.price}
      </div>

      <div class="small ${sold >= max ? "sold-full" : "sold-ok"}">
        已購買：${sold} / 限購：${max}
      </div>

      <div class="actions">
        <button class="btn-edit">✏️ 編輯</button>
      </div>
    `;

    div.querySelector(".btn-edit").onclick = () => {
      editingProductId = d.id;

      document.getElementById("f-name").value = p.name;
      document.getElementById("f-price").value = p.price;
      document.getElementById("f-image").value = p.imageUrl || "";
      document.getElementById("f-max").value = p.maxSalecount ?? 0;
      document.getElementById("f-sort").value = p.sort ?? 0;
      document.getElementById("f-enabled").checked = !!p.enabled;

      document.querySelector("#form-panel h3").innerText = "✏️ 編輯商品";
      formPanel.style.display = "block";
    };

    listEl.appendChild(div);
  });

  msgEl.innerText = `✅ 載入完成（${snap.size} 筆）`;
}


function watchProducts() {
  msgEl.innerText = "載入商品中…";
  listEl.innerHTML = "<i>載入中…</i>";

  const q = query(
    collection(db, "products", SHOP_ID, "items"),
    orderBy("sort", "asc")
  );

  onSnapshot(q, snap => {
    latestProductsSnap = snap;
    renderProductsFromSnap(latestProductsSnap);
  });
}


/* =========================
   自動化監聽
========================= */
function watchOrdersForAutoDisable() {
  const q = query(
    collection(db, "orders"),
    where("shopId", "==", SHOP_ID),
    where("status", "==", "submitted")
  );

  onSnapshot(q, async snap => {
    try {
      // 1) 重算 soldCountMap
      soldCountMap = {};

      snap.forEach(docSnap => {
        const order = docSnap.data();
        if (!Array.isArray(order.items)) return;
        order.items.forEach(it => {
          // it.productId, it.qty 需存在
          if (!it.productId || !it.qty) return;
          soldCountMap[it.productId] =
            (soldCountMap[it.productId] || 0) + it.qty;
        });
      });
      
      // 如果商品快照還沒來，不做任何事
      if (!latestProductsSnap) return;

      // 用「目前畫面正在看的商品快照」來判斷
      latestProductsSnap.forEach(d => {
        const p = d.data();
        const pid = d.id;

        const sold = soldCountMap[pid] || 0;
        const max = Number.isFinite(p.maxSalecount)
          ? p.maxSalecount
          : Infinity;

        // 當已售 >= 上限，而且目前還沒下架 → 自動下架
        if (Number.isFinite(max) && 
            sold >= max &&
            p.enabled !== false) {
          setDoc(
            doc(db, "products", SHOP_ID, "items", pid),
            {
              enabled: false,
              autoDisabledAt: Date.now()
            },
            { merge: true }
          );
        }
      });


      if (latestProductsSnap) {
        renderProductsFromSnap(latestProductsSnap);
      }
    } catch (e) {
      // 捕捉錯誤並印出，避免整個 onSnapshot 中斷
      console.error("watchOrdersForAutoDisable error:", e);
    }
  });
}




watchProducts();              // 商品即時
watchOrdersForAutoDisable();  // 訂單即時 → 自動下架
