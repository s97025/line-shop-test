import { db } from "./firebase.js";
import {
  collection, query, where, orderBy, getDocs,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const SHOP_ID = "shop001";
const LIFF_ID = "2008849957-uFo5FsLU";

let USER = null;
let SHOP_CLOSE_AT = null;
let SHOP_CLOSED = false;
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
    .then(p => {
      USER = p;
      document.getElementById("status").innerText = "登入成功";
      document.getElementById("name").innerText = "你好，" + p.displayName;
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
  const snap = await getDoc(doc(db,"products",SHOP_ID));
  if (!snap.exists()) return;
  SHOP_CLOSE_AT = snap.data().closeAt?.toDate();
  SHOP_CLOSED = SHOP_CLOSE_AT && new Date() >= SHOP_CLOSE_AT;
  const el = document.getElementById("shop-status");
  if (!SHOP_CLOSE_AT) return;
  el.innerText = SHOP_CLOSED
    ? `⛔ 已結單（${SHOP_CLOSE_AT.toLocaleString()}）`
    : `🟢 結單時間：${SHOP_CLOSE_AT.toLocaleString()}`;
  el.style.color = SHOP_CLOSED ? "red" : "green";
}

/* =========================
   商品列表
========================= */
async function loadProducts() {
  const q = query(
    collection(db,"products",SHOP_ID,"items"),
    where("enabled","==",true),
    orderBy("sort","asc")
  );
  const snap = await getDocs(q);
  const box = document.getElementById("product-list");
  box.innerHTML = "";
  snap.forEach(d=>{
    const p=d.data();
    const div=document.createElement("div");
    div.className="card";
    div.dataset.productId=d.id;
    div.innerHTML=`
      <b>${p.name}</b> $${p.price}
      <div class="small stat">已訂購：${productStats[d.id]?.buyerCount||0}</div>
    `;
    const btn=document.createElement("button");
    btn.innerText="加入購物車";
    btn.disabled=SHOP_CLOSED;
    btn.onclick=()=>addToDraft(d.id,p);
    div.appendChild(btn);
    box.appendChild(div);
  });
}

/* =========================
   商品統計
========================= */
function watchProductStats(){
  const q=query(
    collection(db,"orders"),
    where("shopId","==",SHOP_ID),
    where("status","==","submitted")
  );
  onSnapshot(q,snap=>{
    const stats={};
    snap.forEach(d=>{
      d.data().items?.forEach(i=>{
        stats[i.productId]??={buyerCount:0};
        stats[i.productId].buyerCount+=i.qty;
      });
    });
    productStats=stats;
    document.querySelectorAll("[data-product-id]").forEach(div=>{
      const pid=div.dataset.productId;
      div.querySelector(".stat").innerText=
        `已訂購：${productStats[pid]?.buyerCount||0}`;
    });
  });
}

/* =========================
   Draft cart
========================= */
function draftRef(){
  return doc(db,"orders",`${SHOP_ID}_${USER.userId}_draft`);
}

async function addToDraft(pid,p){
  if(SHOP_CLOSED)return;
  const snap=await getDoc(draftRef());
  let items=snap.exists()?snap.data().items:[];
  const i=items.find(x=>x.productId===pid);
  i?i.qty++:items.push({productId:pid,name:p.name,price:p.price,qty:1});
  await setDoc(draftRef(),{
    shopId:SHOP_ID,userId:USER.userId,status:"draft",
    items,updatedAt:serverTimestamp()
  });
}

window.updateQty=async(pid,delta)=>{
  const ref=draftRef();
  const snap=await getDoc(ref);
  if(!snap.exists())return;
  let items=snap.data().items
    .map(i=>{if(i.productId===pid)i.qty+=delta;return i;})
    .filter(i=>i.qty>0);
  items.length===0?await deleteDoc(ref):
    await updateDoc(ref,{items,updatedAt:serverTimestamp()});
};

window.removeItem=pid=>window.updateQty(pid,-999);

function watchDraft(){
  onSnapshot(draftRef(),snap=>{
    const box=document.getElementById("draft-cart");
    const totalEl=document.getElementById("draft-total");
    const submitBtn=document.getElementById("submit-btn");
    if(!snap.exists()){
      box.innerHTML="<i>尚未加入任何商品</i>";
      totalEl.innerText="";
      submitBtn.disabled=true;
      return;
    }
    let total=0;box.innerHTML="";
    snap.data().items.forEach(it=>{
      total+=it.price*it.qty;
      const div=document.createElement("div");
      div.className="cart-item";
      div.innerHTML = `
        <div class="cart-row">
          <span class="cart-name">${it.name}</span>
      
          <div class="cart-stepper">
            <button ${SHOP_CLOSED ? "disabled" : ""} onclick="updateQty('${it.productId}',-1)">－</button>
            <span class="cart-qty">${it.qty}</span>
            <button ${SHOP_CLOSED ? "disabled" : ""} onclick="updateQty('${it.productId}',1)">＋</button>
          </div>
      
          <button class="cart-delete"
            ${SHOP_CLOSED ? "disabled" : ""}
            onclick="removeItem('${it.productId}')">
            刪除
          </button>
        </div>`;

      box.appendChild(div);
    });
    totalEl.innerText=`💰 總金額：$${total}`;
    submitBtn.disabled=SHOP_CLOSED;
  });
}

/* =========================
   Submit & Submitted
========================= */
document.getElementById("submit-btn").onclick=async()=>{
  if(SHOP_CLOSED)return;
  const snap=await getDoc(draftRef());
  if(!snap.exists())return;
  const data=snap.data();
  const now=new Date();
  const cancelDeadline=new Date(SHOP_CLOSE_AT.getTime()-86400000);
  await setDoc(doc(db,"orders",`${SHOP_ID}_${USER.userId}_${now.getTime()}`),{
    ...data,status:"submitted",
    submittedAt:serverTimestamp(),
    submittedAtClient:now,
    cancelDeadline:Timestamp.fromDate(cancelDeadline)
  });
  await deleteDoc(draftRef());
};

function watchSubmitted(){
  const q=query(
    collection(db,"orders"),
    where("shopId","==",SHOP_ID),
    where("userId","==",USER.userId),
    where("status","==","submitted"),
    orderBy("submittedAtClient","desc")
  );
  onSnapshot(q,snap=>{
    const box=document.getElementById("submitted-orders");
    box.innerHTML=snap.empty?"<i>尚無已送出訂單</i>":"";
    snap.forEach(d=>{
      const o=d.data();
      const div=document.createElement("div");
      div.className="card";
      div.innerHTML=`
        <div class="small">送出時間：${o.submittedAt?.toDate().toLocaleString()||"處理中…"}</div>
        ${o.items.map(i=>`<div>${i.name} × ${i.qty}</div>`).join("")}
      `;
      box.appendChild(div);
    });
  });
}
