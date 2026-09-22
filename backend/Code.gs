
const SPREADSHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID';
const ADMIN_SECRET = 'CHANGE_THIS_SECRET';
const DRIVE_FOLDER_ID = 'PASTE_YOUR_GOOGLE_DRIVE_FOLDER_ID';
const STORE_NAME = 'RastriyaSenaa Store';
const STORE_EMAIL = 'YOUR_STORE_EMAIL@gmail.com';
const SESSION_TTL = 21600; // 6 hours

function setupStore(){
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets={
    Products:['id','name','category','price','discount','stock','image','description','badge','status','createdAt'],
    Categories:['id','name','slug','status'],
    Orders:['orderId','customerName','email','mobile','address','city','pin','payment','itemsJson','total','status','date','emailSent'],
    Customers:['id','name','mobile','email','address','createdAt'],
    Admins:['id','username','passwordHash','role','permissions','status','createdAt'],
    Coupons:['code','type','value','minOrder','status','createdAt'],
    Settings:['key','value'],
    Contact_Messages:['id','name','mobile','message','date','status']
  };
  Object.keys(sheets).forEach(n=>{
    let sh=ss.getSheetByName(n);
    if(!sh) sh=ss.insertSheet(n);
    if(sh.getLastRow()===0) sh.appendRow(sheets[n]);
  });
  return 'Store sheets ready';
}

function json(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function rows(name){
  const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if(!sh)return [];
  const v=sh.getDataRange().getValues();
  if(v.length<2)return [];
  const h=v.shift();
  return v.map(r=>Object.fromEntries(h.map((x,i)=>[x,r[i]])));
}

function sha256(text){
  const bytes=Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    text,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b=>('0'+(b&0xff).toString(16)).slice(-2)).join('');
}

function createSession(admin){
  const token=Utilities.getUuid()+'-'+Utilities.getUuid();
  CacheService.getScriptCache().put(
    'session:'+token,
    JSON.stringify({
      username:String(admin.username),
      role:String(admin.role||'admin'),
      permissions:String(admin.permissions||'')
    }),
    SESSION_TTL
  );
  return token;
}

function getSession(token){
  if(!token)return null;
  const v=CacheService.getScriptCache().get('session:'+token);
  return v?JSON.parse(v):null;
}

function requireSession(token){
  const s=getSession(token);
  if(!s) throw new Error('Unauthorized. Please login again.');
  return s;
}

function hasPermission(session, permission){
  if(session.role==='superadmin')return true;
  const p=String(session.permissions||'').split(',').map(x=>x.trim());
  return p.includes(permission);
}

function doGet(e){
  const a=e.parameter.action||'products';

  if(a==='products'){
    return json({
      ok:true,
      products:rows('Products').filter(x=>String(x.status||'Active')==='Active')
    });
  }

  if(a==='categories'){
    return json({
      ok:true,
      categories:rows('Categories').filter(x=>String(x.status||'Active')==='Active')
    });
  }

  return json({ok:false,error:'Unknown action'});
}

function doPost(e){
  try{
    const body=JSON.parse(e.postData.contents||'{}');

    if(body.action==='setup'){
      return json({ok:true,message:setupStore()});
    }

    if(body.action==='adminLogin'){
      const username=String(body.username||'').trim();
      const password=String(body.password||'');
      const admin=rows('Admins').find(a=>
        String(a.username)===username &&
        String(a.status||'Active')==='Active'
      );

      if(!admin || String(admin.passwordHash)!==sha256(password)){
        return json({ok:false,error:'Invalid ID or password'});
      }

      const token=createSession(admin);

      return json({
        ok:true,
        token:token,
        admin:{
          username:admin.username,
          role:admin.role,
          permissions:admin.permissions||''
        }
      });
    }

    if(body.action==='adminLogout'){
      if(body.token){
        CacheService.getScriptCache().remove('session:'+body.token);
      }
      return json({ok:true});
    }

    if(body.action==='createAdmin'){
      const s=requireSession(body.token);
      if(s.role!=='superadmin') return json({ok:false,error:'Super Admin only'});

      const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Admins');
      const a=body.admin||{};
      const username=String(a.username||'').trim();

      if(!username || !a.password){
        return json({ok:false,error:'Username and password required'});
      }

      if(rows('Admins').some(x=>String(x.username)===username)){
        return json({ok:false,error:'Username already exists'});
      }

      sh.appendRow([
        'AD'+Date.now(),
        username,
        sha256(String(a.password)),
        a.role||'admin',
        a.permissions||'products,orders',
        'Active',
        new Date()
      ]);

      return json({ok:true,message:'Admin created'});
    }

    if(body.action==='uploadImage'){
      const s=requireSession(body.token);
      if(!hasPermission(s,'products')){
        return json({ok:false,error:'Products permission required'});
      }
      return json(uploadImageToDrive(body));
    }

    if(body.action==='createProduct'){
      const s=requireSession(body.token);
      if(!hasPermission(s,'products')){
        return json({ok:false,error:'Products permission required'});
      }

      const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Products');
      const p=body.product||{};

      sh.appendRow([
        p.id||('RS'+Date.now()),
        p.name,
        p.category,
        p.price,
        p.discount||'',
        p.stock||0,
        p.image||'',
        p.description||'',
        p.badge||'',
        p.status||'Active',
        new Date()
      ]);

      return json({ok:true,message:'Product created'});
    }

    if(body.action==='createOrder'){
      const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Orders');
      const o=body.order||{};
      const orderId=o.orderId||('RS'+Date.now());

      sh.appendRow([
        orderId,o.name||'',o.email||'',o.mobile||'',
        o.address||'',o.city||'',o.pin||'',o.payment||'',
        JSON.stringify(o.items||[]),o.total||0,'Confirmed',
        new Date(),'No'
      ]);

      if(o.email){
        sendOrderConfirmationEmail({
          orderId:orderId,name:o.name,email:o.email,mobile:o.mobile,
          address:o.address,city:o.city,pin:o.pin,
          payment:o.payment,items:o.items||[],total:o.total||0
        });
      }

      return json({ok:true,orderId:orderId,emailSent:!!o.email});
    }

    return json({ok:false,error:'Unknown action'});

  }catch(err){
    return json({ok:false,error:String(err)});
  }
}

function uploadImageToDrive(body){
  if(!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID.indexOf('PASTE_')===0){
    return {ok:false,error:'Google Drive Folder ID is not configured'};
  }

  const name=String(body.fileName||'product-image');
  const mime=String(body.mimeType||'image/jpeg');

  if(!/^image\\/(jpeg|jpg|png|webp|gif)$/i.test(mime)){
    return {ok:false,error:'Only JPG, PNG, WEBP and GIF images are allowed'};
  }

  const base64=String(body.base64||'');
  if(!base64)return {ok:false,error:'Image data missing'};

  // Limit approximately 5 MB to keep Apps Script request size reasonable.
  if(base64.length > 7_000_000){
    return {ok:false,error:'Image is too large. Please use an image under 5 MB.'};
  }

  const bytes=Utilities.base64Decode(base64);
  const blob=Utilities.newBlob(bytes,mime,name);
  const folder=DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const file=folder.createFile(blob);

  // Product images need to be viewable by the website. This makes only this file accessible.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);

  return {
    ok:true,
    fileId:file.getId(),
    url:'https://drive.google.com/uc?export=view&id='+file.getId(),
    name:file.getName()
  };
}

function sendOrderConfirmationEmail(order){
  try{
    let itemRows='';
    (order.items||[]).forEach(item=>{
      const price=Number(item.price||0),qty=Number(item.qty||1);
      itemRows+=`<tr><td style="padding:10px;border-bottom:1px solid #eee">${escapeHtml(item.name||'Product')}</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:center">${qty}</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">₹${(price*qty).toLocaleString('en-IN')}</td></tr>`;
    });

    const html=`<div style="font-family:Arial;background:#f5f7fa;padding:30px">
      <div style="max-width:650px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="background:#0d1b2a;color:#fff;padding:25px"><h2 style="margin:0">${STORE_NAME}</h2><p>Order Confirmation</p></div>
      <div style="padding:25px"><h3>Hello ${escapeHtml(order.name||'Customer')} 👋</h3>
      <p>Your order has been confirmed.</p>
      <div style="background:#f1f5f9;padding:15px;border-radius:8px"><b>Order ID:</b> ${order.orderId}<br><br><b>Payment:</b> ${escapeHtml(order.payment||'N/A')}</div>
      <h3>Order Details</h3><table style="width:100%;border-collapse:collapse">
      <tr><th style="text-align:left;padding:10px">Product</th><th>Qty</th><th style="text-align:right">Amount</th></tr>${itemRows}</table>
      <div style="text-align:right;font-size:20px;font-weight:bold;margin-top:20px">Total: ₹${Number(order.total).toLocaleString('en-IN')}</div>
      <hr><h3>Delivery Address</h3><p>${escapeHtml(order.address||'')}<br>${escapeHtml(order.city||'')}, ${escapeHtml(order.pin||'')}<br>Mobile: ${escapeHtml(order.mobile||'')}</p>
      <p style="color:#64748b">Thank you for shopping with ${STORE_NAME}.</p></div></div></div>`;

    GmailApp.sendEmail(
      order.email,
      `Order Confirmed #${order.orderId} | ${STORE_NAME}`,
      `Your order ${order.orderId} has been confirmed.`,
      {htmlBody:html,name:STORE_NAME}
    );

    markEmailSent(order.orderId);

  }catch(error){
    console.log('Email Error: '+error);
  }
}

function markEmailSent(orderId){
  const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Orders');
  const data=sh.getDataRange().getValues();
  if(data.length<2)return;
  const h=data[0],oc=h.indexOf('orderId')+1,ec=h.indexOf('emailSent')+1;

  for(let i=1;i<data.length;i++){
    if(String(data[i][oc-1])===String(orderId)){
      sh.getRange(i+1,ec).setValue('Yes');
      break;
    }
  }
}

function escapeHtml(text){
  return String(text||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}
