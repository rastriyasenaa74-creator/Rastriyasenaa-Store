const API_URL = "https://script.google.com/macros/s/AKfycbwr1tsVD-_dFZEFLnNR-ZMSSATqT4RpfB9rSXGEKuNiM4n-yMxcjj9yQF7Qvto-VmT70A/exec";
window.API_URL = API_URL;

function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

function getCart() {
  try { return JSON.parse(localStorage.getItem("rs_cart") || "[]"); }
  catch (e) { return []; }
}

function setCart(c) {
  localStorage.setItem("rs_cart", JSON.stringify(c));
  updateCartBadge();
}

function updateCartBadge() {
  const n = getCart().reduce((s, x) => s + Number(x.qty || 0), 0);
  document.querySelectorAll("[data-cart-count]").forEach(e => e.textContent = n);
}

function addToCart(id) {
  const p = (window.PRODUCTS || []).find(x => String(x.id) === String(id));
  if (!p) { alert("Product available nahi hai."); return false; }

  const stock = Number(p.stock || 0);
  if (stock <= 0) { alert("Ye product abhi out of stock hai."); return false; }

  const c = getCart();
  const item = c.find(x => String(x.id) === String(id));

  if (item) {
    if (item.qty >= stock) { alert("Available stock: " + stock); return false; }
    item.qty++;
  } else {
    c.push({
      id: p.id,
      name: p.name,
      price: Number(p.discount || p.price || 0),
      originalPrice: Number(p.price || 0),
      qty: 1,
      stock: stock,
      image: p.image || "",
      icon: p.icon || ""
    });
  }

  setCart(c);
  alert("Product cart me add ho gaya.");
  return true;
}

function buyNow(id) {
  if (addToCart(id)) location.href = "checkout.html";
}

function removeFromCart(id) {
  setCart(getCart().filter(x => String(x.id) !== String(id)));
  location.reload();
}

function changeQty(id, d) {
  const c = getCart();
  const x = c.find(i => String(i.id) === String(id));
  if (x) {
    x.qty += d;
    if (x.qty <= 0) return removeFromCart(id);
    if (x.stock && x.qty > x.stock) {
      x.qty = x.stock;
      alert("Available stock: " + x.stock);
    }
  }
  setCart(c);
  location.reload();
}

async function loadProducts() {
  try {
    const r = await fetch(API_URL + "?action=products", { cache: "no-store" });
    if (!r.ok) throw new Error("Products API error: " + r.status);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || "Products API error");
    window.PRODUCTS = data.products || [];
    return window.PRODUCTS;
  } catch (e) {
    console.error(e);
    window.PRODUCTS = [];
    return [];
  }
}

function productCard(p) {
  const safeName = String(p.name || "Product").replace(/"/g, "&quot;");
  const safeId = String(p.id || "").replace(/'/g, "\\'");
  const image = p.image
    ? `<img src="${p.image}" alt="${safeName}" loading="lazy">`
    : `<span>${p.icon || "🛍️"}</span>`;
  const price = Number(p.discount || p.price || 0);
  const oldPrice = p.discount ? Number(p.price || 0) : 0;
  const stock = Number(p.stock || 0);

  return `<div class="product-card">
    <div class="product-image">${image}</div>
    <div class="product-info">
      <span class="tag">${p.badge || p.category || "Product"}</span>
      <div class="product-title">${p.name || ""}</div>
      <div><span class="price">${money(price)}</span>${oldPrice ? `<span class="old">${money(oldPrice)}</span>` : ""}</div>
      <div class="muted" style="font-size:12px;margin-top:6px">${stock > 0 ? "Stock: " + stock : "Out of stock"}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
        <button class="btn btn-dark btn-sm" ${stock <= 0 ? "disabled" : ""} onclick="addToCart('${safeId}')">Add to Cart</button>
        <button class="btn btn-primary btn-sm" ${stock <= 0 ? "disabled" : ""} onclick="buyNow('${safeId}')">Buy Now</button>
      </div>
    </div>
  </div>`;
}

function adminToken() {
  try {
    const a = JSON.parse(localStorage.getItem("rs_admin") || "null");
    return a && a.token ? a.token : "";
  } catch (e) { return ""; }
}

function requireAdmin() {
  const raw = localStorage.getItem("rs_admin");
  if (!raw) { location.replace("login.html"); return null; }
  try {
    const a = JSON.parse(raw);
    if (!a || !a.token) {
      localStorage.removeItem("rs_admin");
      location.replace("login.html");
      return null;
    }
    return a;
  } catch (e) {
    localStorage.removeItem("rs_admin");
    location.replace("login.html");
    return null;
  }
}

async function apiPost(payload) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function uploadProductImage(file) {
  if (!file) throw new Error("Image select karein.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image 5 MB se zyada hai.");

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return apiPost({
    action: "uploadImage",
    token: adminToken(),
    fileName: file.name,
    mimeType: file.type,
    base64: base64
  });
}

function logoutAdmin() {
  apiPost({ action: "adminLogout", token: adminToken() }).catch(() => {}).finally(() => {
    localStorage.removeItem("rs_admin");
    location.replace("login.html");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  document.querySelectorAll("[data-year]").forEach(e => e.textContent = new Date().getFullYear());
});

