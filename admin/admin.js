import { initFirebase } from "../shared/firebase.js";
import { SHOP_ID } from "../shared/constants.js";

initFirebase();

document.getElementById("env").innerText = `SHOP_ID = ${SHOP_ID}`;
document.getElementById("msg").innerText = "✅ admin.html 已載入，下一步會接 Firestore 商品列表。";

document.getElementById("btn-refresh").onclick = () => location.reload();
document.getElementById("btn-new").onclick = () => alert("下一步會做：新增商品表單");
