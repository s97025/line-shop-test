import { SHOP_ID } from "../shared/constants.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  setDoc,
  doc,
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

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

document.getElementById("btn-refresh").onclick = loadProducts;
document.getElementById("btn-new").onclick = () => {
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

  const id = "p" + Date.now();

  try {
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

/* =========================
   Load products
========================= */

loadProducts();

async function loadProducts() {
  msgEl.innerText = "載入商品中…";
  listEl.innerHTML = "<i>載入中…</i>";

  const q = query(
    collection(db, "products", SHOP_ID, "items"),
    orderBy("sort", "asc")
  );

  const snap = await getDocs(q);

  listEl.innerHTML = "";
  snap.forEach(d => {
    const p = d.data();

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div>
        <span class="badge ${p.enabled ? "on" : "off"}">
          ${p.enabled ? "上架" : "下架"}
        </span>
        <b>${p.name}</b>　$${p.price}
      </div>
      <div class="small">
        商品ID：${d.id}
        ｜ 限購：${p.maxSalecount}
        ｜ 排序：${p.sort}
      </div>
    `;
    listEl.appendChild(div);
  });

  msgEl.innerText = `✅ 載入完成（${snap.size} 筆）`;
}
