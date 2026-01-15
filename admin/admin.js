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
   calculate sold Count
========================= */

async function loadSoldCounts() {
  soldCountMap = {};

  const q = query(
    collection(db, "orders"),
    where("shopId", "==", SHOP_ID),
    where("status", "==", "submitted")
  );
  
  const snap = await getDocs(q);

  snap.forEach(docSnap => {
    const order = docSnap.data();
    if (!Array.isArray(order.items)) return;

    order.items.forEach(it => {
      if (!it.productId || !it.qty) return;
      soldCountMap[it.productId] =
        (soldCountMap[it.productId] || 0) + it.qty;
    });
  });
}


/* =========================
   UI refs
========================= */

const listEl = document.getElementById("product-list");
const msgEl = document.getElementById("msg");
const formPanel = document.getElementById("form-panel");

document.getElementById("env").innerText = `SHOP_ID = ${SHOP_ID}`;

document.getElementById("btn-refresh").onclick = loadProducts;
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
    loadProducts();
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


/* ===============================
   auto Disable If sold max Count
=============================== */

async function autoDisableIfFull(productId, sold, max) {
  if (!Number.isFinite(max)) return;
  if (sold < max) return;

  const ref = doc(db, "products", SHOP_ID, "items", productId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;
  if (snap.data().enabled === false) return;

  await setDoc(
    ref,
    {
      enabled: false,
      autoDisabledAt: Date.now()
    },
    { merge: true }
  );
}



/* =========================
   Load products
========================= */

async function loadProducts() {
  msgEl.innerText = "載入商品中…";
  listEl.innerHTML = "<i>載入中…</i>";

  // 只算 sold（用來顯示）
  await loadSoldCounts();

  const q = query(
    collection(db, "products", SHOP_ID, "items"),
    orderBy("sort", "asc")
  );

  const snap = await getDocs(q);
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
        <!-- 商品ID：${d.id} -->
        已購買：${sold} / 限購：${max}
      </div>

      <div class="actions">
        <button class="btn-edit">✏️ 編輯</button>
      </div>
    `;

    div.querySelector(".btn-edit").onclick = () => {
      editingProductId = d.id;

      document.getElementById("f-id").value = d.id;
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
      const soldCountMap = {};

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

      // 2) 撈所有商品
      const prodSnap = await getDocs(
        collection(db, "products", SHOP_ID, "items")
      );

      // 3) 檢查並自動下架
      prodSnap.forEach(d => {
        const p = d.data();
        const pid = d.id;
        const sold = soldCountMap[pid] || 0;
        const max = Number.isFinite(p.maxSalecount)
          ? p.maxSalecount
          : Infinity;

        // 當已售 >= 上限，且目前還是 enabled，才下架
        if (sold >= max && p.enabled !== false) {
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
    } catch (e) {
      // 捕捉錯誤並印出，避免整個 onSnapshot 中斷
      console.error("watchOrdersForAutoDisable error:", e);
    }
  });
}




watchOrdersForAutoDisable();
loadProducts();