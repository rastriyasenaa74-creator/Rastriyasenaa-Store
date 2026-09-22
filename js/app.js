window.API_URL = "https://script.google.com/macros/s/AKfycbwr1tsVD-_dFZEFLnNR-ZMSSATqT4RpfB9rSXGEKuNiM4n-yMxcjj9yQF7Qvto-VmT70A/exec";
const API_URL = window.API_URL;

const DEMO_PRODUCTS = [
 {id:"RS001",name:"Jai Bhim Premium T-Shirt",category:"Clothing",price:499,discount:399,stock:25,badge:"Bestseller",icon:"👕"},
 {id:"RS002",name:"Dr. B. R. Ambedkar Wall Poster",category:"Posters",price:199,discount:149,stock:40,badge:"Popular",icon:"🖼️"},
 {id:"RS003",name:"Bahujan Mahapurush Book Set",category:"Books",price:699,discount:599,stock:12,badge:"New",icon:"📚"},
 {id:"RS004",name:"Jai Bhim Flag",category:"Flags & Banners",price:249,discount:199,stock:35,badge:"Popular",icon:"🏳️"}
];

function money(n){return "₹"+Number(n||0).toLocaleString("en-IN");}
function getCart(){try{return JSON.parse(localStorage.getItem("rs_cart")||"[]")}catch(e){return[]}}
function setCart(c){localStorage.setItem("rs_cart",JSON.stringify(c));updateCartBadge()}
function updateCartBadge(){const n=getCart().reduce((s,x)=>s+Number(x.qty||0),0);document.querySelectorAll("[data-cart-count]").forEach(e=>e.textContent=n)}
function addToCart(id){
 const p=(window.PRODUCTS||DEMO_PRODUCTS).find(x=>String(x.id)===String(id));if(!p)return;
 const c=getCart(),item=c.find(x=>String(x.id)===String(id));
 if(item)item.qty++;else c.push({id:p.id,name:p.name,price:Number(p.discount||p.price||0),qty:1,icon:p.icon||""});
 setCart(c);alert("Product cart me add ho gaya.");
}
function removeFromCart(id){setCart(getCart().filter(x=>String(x.id)!==String(id)));location.reload()}
function changeQty(id,d){const c=getCart(),x=c.find(i=>String(i.id)===String(id));if(x){x.qty+=d;if(x.qty<=0)return removeFromCart(id)}setCart(c);location.reload()}

async function loadProducts(){
 try{
  const r=await fetch(API_URL+"?action=products",{cache:"no-store"});
  const data=await r.json();
  if(!data.ok)throw new Error(data.error||"Products API error");
  window.PRODUCTS=data.products||[];
  return window.PRODUCTS;
 }catch(e){window.PRODUCTS=DEMO_PRODUCTS;return DEMO_PRODUCTS;}
}

function productCard(p){
 return `<div class="product-card"><div class="product-image">${p.image?`<img src="${p.image}" alt="${String(p.name||"Product").replace(/"/g,"&quot;")}">`:`${p.icon||"🛍️"}`}</div><div class="product-info"><span class="tag">${p.badge||p.category||"Product"}</span><div class="product-title">${p.name||""}</div><div><span class="price">${money(p.discount||p.price)}</span>${p.discount?`<span class="old">${money(p.price)}</span>`:""}</div><button class="btn btn-dark btn-sm" style="width:100%;margin-top:12px" onclick="addToCart('${String(p.id).replace(/'/g,"\\'")}')">Add to Cart</button></div></div>`;
}

document.addEventListener("DOMContentLoaded",()=>{updateCartBadge();document.querySelectorAll("[data-year]").forEach(e=>e.textContent=new Date().getFullYear())});

async function apiPost(payload){
 if(!API_URL)throw new Error("Google Apps Script API URL is not configured.");
 const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
 const text=await r.text();
 let x;try{x=JSON.parse(text)}catch(e){throw new Error("API response invalid. Check Apps Script deployment and permissions.");}
 if(!x.ok)throw new Error(x.error||"Request failed");
 return x;
}
function getAdminSession(){try{return JSON.parse(localStorage.getItem("rs_admin")||"null")}catch(e){return null}}
function adminToken(){const s=getAdminSession();return s&&s.token?s.token:""}
function requireAdmin(){const s=getAdminSession();if(!s||!s.token||!s.username){localStorage.removeItem("rs_admin");location.replace("login.html");return null}return s}
async function logoutAdmin(){try{if(adminToken())await apiPost({action:"adminLogout",token:adminToken()})}catch(e){}localStorage.removeItem("rs_admin");location.replace("login.html")}

async function uploadProductImage(file){
 if(!file)throw new Error("Please select an image.");
 if(!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type))throw new Error("Only JPG, PNG, WEBP or GIF allowed.");
 if(file.size>5*1024*1024)throw new Error("Image must be under 5 MB.");
 const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]);r.onerror=reject;r.readAsDataURL(file)});
 return apiPost({action:"uploadImage",token:adminToken(),fileName:file.name,mimeType:file.type,base64});
}
