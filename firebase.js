import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export let db;

export function initFirebase() {
  const firebaseConfig = {
    apiKey: "AIzaSyAk5SaAAvifvTV3dUW4mddRvvgySbdIysc",
    authDomain: "line-shop-ef578.firebaseapp.com",
    projectId: "line-shop-ef578"
  };

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}
