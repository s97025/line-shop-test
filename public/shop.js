import { db } from "../shared/firebase.js";
import {
  collection, query, where, orderBy, getDocs,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   Config
========================= */
const SHOP_ID = "shop001";
const LIFF_ID = "2008849957-uFo5FsLU";


/* =========================
   Global state
========================= */
let USER = null;
let SHOP_CLOSE_AT = null;
let SHOP_CLOSED = false;


/*
  productStats = {
    productId: { buyerCount: number }
  }
*/
let productStats = {};

/* =========================
   LIFF init
========================= */
export function initShop() {
  liff.init({ liffId: LIFF_ID })
    .then(() => {
      if (!liff.isLoggedIn()) return liff.login();
      return liff.getProfile();
    })
    .then(profile => {
      USER = profile;
      document.getElementById("status").innerText = "登入成功";
      document.getElementById("name").innerText = "你好，" + profile.displayName;

      loadShopStatus().then(() => {
        loadProducts();
        watchDraft();
        watchSubmitted();
        watchProductStats();
      });
    });
}

/* =========================
   Shop status
========================= */
async function loadShopStatus() {
  const snap = await getDoc(doc(db, "products", SHOP_ID));
  if (!snap.exists()) return;

  SHOP_CLOSE_AT = snap.data().closeAt?.toDate() || null;
  SHOP_CLOSED = SHOP_CLOSE_AT ? new Date() >= SHOP_CLOSE_AT : false;

  if (!SHOP_CLOSE_AT) return;

  const el = document.getElementById("shop-status");
  el.innerText = SHOP_CLOSED
    ? `⛔ 已結單（${SHOP_CLOSE_AT.toLocaleString()}）`
    : `🟢 結單時間：${SHOP_CLOSE_AT.toLocaleString()}`;
  el.style.color = SHOP_CLOSED ? "red" : "green";
}

/* =================================
   remove Disabled Items From Draft
   if Sold Max Count
================================= */
async function removeDisabledItemsFromDraft(disabledProductIds) {
  const ref = draftRef();
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  let items = snap.data().items || [];
  const filtered = items.filter(
    it => !disabledProductIds.includes(it.productId)
  );

  if (filtered.length === items.length) return;

  if (filtered.length === 0) {
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, {
      items: filtered,
      updatedAt: serverTimestamp()
    });
  }
}



/* =========================
   商品列表
========================= */
async function loadProducts() {
  const q = query(
    collection(db, "products", SHOP_ID, "items"),
    orderBy("sort", "asc")
  );

  const products = [];
  const snap = await getDocs(q);
  const box = document.getElementById("product-list");
  box.innerHTML = "";

  snap.forEach(docSnap => {
    const p = docSnap.data();
    const pid = docSnap.id;

    // 收集所有商品（不論是否上架）
    products.push({ ...p, id: pid });

    // 下架商品：不顯示在列表
    if (p.enabled === false) return;

    const div = document.createElement("div");
    div.className = "card";
    div.dataset.productId = pid;
    div.__productData = p;

    const sold = productStats[pid]?.buyerCount || 0;
    const max = Number.isFinite(p.maxSalecount)
      ? p.maxSalecount
      : Infinity;

    const remain = Math.max(0, max - sold);
    const isSoldOut = Number.isFinite(max) && remain <= 0;

    div.innerHTML = `
      <b>${p.name}</b> $${p.price}

      <div class="small stat ${isSoldOut ? "sold-out" : ""}">
        已售出：${sold}
        ${Number.isFinite(max)
          ? `｜剩餘: <b>${remain}</b> 件`
          : ""}
      </div>
    `;


    const btn = document.createElement("button");
    btn.innerText = "加入購物車";
    btn.disabled = SHOP_CLOSED || p.enabled === false || isSoldOut;
    btn.classList.toggle("btn-disabled", isSoldOut);
    btn.onclick = () => addToDraft(pid, p);

    div.appendChild(btn);
    box.appendChild(div);
  });

  // 找出已下架商品 ID
  const disabledIds = products
    .filter(p => p.enabled === false)
    .map(p => p.id);

  // 從購物車自動移除下架商品
  removeDisabledItemsFromDraft(disabledIds);
}

/* =========================
   商品統計（從 orders 即時計算）
========================= */
function watchProductStats() {
  const q = query(
    collection(db, "orders"),
    where("shopId", "==", SHOP_ID),
    where("status", "==", "submitted")
  );

  onSnapshot(q, snap => {
    const stats = {};

    snap.forEach(docSnap => {
      const data = docSnap.data();
      data.items?.forEach(item => {
        if (!stats[item.productId]) {
          stats[item.productId] = { buyerCount: 0 };
        }
        stats[item.productId].buyerCount += item.qty;
      });
    });

    productStats = stats;

    document.querySelectorAll("[data-product-id]").forEach(div => {
      const pid = div.dataset.productId;
      const statEl = div.querySelector(".stat");
      if (!statEl) return;

      const sold = productStats[pid]?.buyerCount || 0;

      // 從 loadProducts 存進去的商品資料拿 max
      const product = div.__productData;
      const max = Number.isFinite(product?.maxSalecount)
        ? product.maxSalecount
        : Infinity;

      const remain = Math.max(0, max - sold);
      const isSoldOut = Number.isFinite(max) && remain <= 0;

      statEl.classList.toggle("sold-out", isSoldOut);
     
      const btn = div.querySelector("button");
      if (btn) {
        btn.disabled = SHOP_CLOSED || product.enabled === false || isSoldOut;
        btn.classList.toggle("btn-disabled", isSoldOut);
      }


      statEl.innerHTML = `
        已售出：${sold}
        ${Number.isFinite(max)
          ? `｜剩餘 <b>${remain}</b> 件`
          : ""}
      `;

    });

  });
}

/* =========================
   Draft helpers
========================= */
function draftRef() {
  return doc(db, "orders", `${SHOP_ID}_${USER.userId}_draft`);
}

/* =========================
   Add to draft
========================= */
async function addToDraft(pid, product) {
  if (SHOP_CLOSED) return;

  const sold = productStats[pid]?.buyerCount || 0;
  const max = Number.isFinite(product.maxSalecount)
    ? product.maxSalecount
    : Infinity;

  const ref = draftRef();
  const snap = await getDoc(ref);
  const items = snap.exists() ? snap.data().items : [];

  const inCart =
    items.find(i => i.productId === pid)?.qty || 0;

  if (sold + inCart >= max) {
    alert("❌ 此商品剩餘數量不足");
    return;
  }

  const it = items.find(i => i.productId === pid);
  if (it) {
    it.qty += 1;
  } else {
    items.push({
      productId: pid,
      name: product.name,
      price: product.price,
      qty: 1
    });
  }

  await setDoc(ref, {
    shopId: SHOP_ID,
    userId: USER.userId,
    status: "draft",
    items,
    updatedAt: serverTimestamp()
  });
}


/* =========================
   Qty controls (global)
========================= */
window.updateQty = async (pid, delta) => {
  const ref = draftRef();
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  let items = snap.data().items;
  const target = items.find(i => i.productId === pid);
  if (!target) return;

  /* =========================
     🔒 防超賣（只在 + 時檢查）
  ========================= */
  if (delta > 0) {
    const sold = productStats[pid]?.buyerCount || 0;

    // 從商品卡片取 maxSalecount
    const productCard =
      document.querySelector(`[data-product-id="${pid}"]`);
    const product = productCard?.__productData;

    const max = Number.isFinite(product?.maxSalecount)
      ? product.maxSalecount
      : Infinity;

    // 已售出 + 購物車內數量 >= 上限 → 擋
    if (sold + target.qty >= max) {
      alert("❌ 已達此商品限購上限");
      return;
    }
  }

  /* =========================
     實際更新數量
  ========================= */
  items = items
    .map(i => {
      if (i.productId === pid) {
        i.qty += delta;
      }
      return i;
    })
    .filter(i => i.qty > 0);

  if (items.length === 0) {
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, {
      items,
      updatedAt: serverTimestamp()
    });
  }
};

window.removeItem = pid => window.updateQty(pid, -999);


/* =========================
   Watch draft (購物車)
========================= */
function watchDraft() {
  onSnapshot(draftRef(), snap => {
    const box = document.getElementById("draft-cart");
    const totalEl = document.getElementById("draft-total");
    const submitBtn = document.getElementById("submit-btn");

    if (!snap.exists()) {
      box.innerHTML = "<i>尚未加入任何商品</i>";
      totalEl.innerText = "";
      submitBtn.disabled = true;
      return;
    }

    const data = snap.data();
    let total = 0;
    box.innerHTML = "";

    data.items.forEach(it => {
      total += it.price * it.qty;

      const div = document.createElement("div");
      div.className = "cart-item";

      div.innerHTML = `
        <div class="cart-row">
          <span class="cart-name">${it.name}</span>

          <div class="cart-stepper">
            <button ${SHOP_CLOSED ? "disabled" : ""} onclick="updateQty('${it.productId}', -1)">－</button>
            <span class="cart-qty">${it.qty}</span>
            <button ${SHOP_CLOSED ? "disabled" : ""} onclick="updateQty('${it.productId}', 1)">＋</button>
          </div>

          <button class="cart-delete"
            ${SHOP_CLOSED ? "disabled" : ""}
            onclick="removeItem('${it.productId}')">
            刪除
          </button>
        </div>
      `;

      box.appendChild(div);
    });

    totalEl.innerText = `💰 總金額：$${total}`;
    submitBtn.disabled = SHOP_CLOSED;
  });
}

/* =========================
   Submit order
========================= */
document.getElementById("submit-btn").onclick = async () => {
  if (SHOP_CLOSED) return;

  const ref = draftRef();
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const now = new Date();
  const cancelDeadline = SHOP_CLOSE_AT
    ? new Date(SHOP_CLOSE_AT.getTime() - 24 * 60 * 60 * 1000)
    : null;

  await setDoc(
    doc(db, "orders", `${SHOP_ID}_${USER.userId}_${now.getTime()}`),
    {
      ...data,
      status: "submitted",
      submittedAt: serverTimestamp(),
      submittedAtClient: now,
      cancelDeadline: cancelDeadline
        ? Timestamp.fromDate(cancelDeadline)
        : null
    }
  );

  await deleteDoc(ref);
};

/* =========================
   Watch submitted orders
========================= */
function watchSubmitted() {
  const q = query(
    collection(db, "orders"),
    where("shopId", "==", SHOP_ID),
    where("userId", "==", USER.userId),
    where("status", "==", "submitted"),
    orderBy("submittedAtClient", "desc")
  );

  onSnapshot(q, snap => {
    const box = document.getElementById("submitted-orders");
    box.innerHTML = snap.empty ? "<i>尚無已送出訂單</i>" : "";

    snap.forEach(docSnap => {
      const o = docSnap.data();
      const div = document.createElement("div");
      div.className = "card";

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
