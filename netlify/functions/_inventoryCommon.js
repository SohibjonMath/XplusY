const admin=require('firebase-admin');

function text(v,max=140){return String(v==null?'':v).trim().slice(0,max)}
function safeId(v){const s=text(v,128);return s && !s.includes('/') ? s : ''}
function qty(v){const n=Number(v);return Number.isInteger(n)&&n>0&&n<=999?n:0}
function asArray(v){return Array.isArray(v)?v:[]}
function numberOrNull(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.round(n)):null}
function norm(v){return text(v,120).toLowerCase()}
function same(a,b){return norm(a)===norm(b)}
function lineKey(line={}){return `${safeId(line.productId||line.id)}::${norm(line.sku)}::${norm(line.color)}::${norm(line.size)}`}
function chooseVariantIndex(product={},line={}){
  const variants=asArray(product.variants);if(!variants.length)return -1;
  const sku=norm(line.sku),color=norm(line.color),size=norm(line.size);
  let idx=-1;
  if(sku)idx=variants.findIndex(v=>norm(v?.sku)===sku);
  if(idx<0&&color&&size)idx=variants.findIndex(v=>same(v?.color,color)&&same(v?.size,size));
  if(idx<0&&color)idx=variants.findIndex(v=>same(v?.color,color));
  if(idx<0&&size)idx=variants.findIndex(v=>same(v?.size,size));
  return idx;
}
function aggregateLines(lines=[]){
  const out=new Map();
  for(const raw of asArray(lines)){
    const productId=safeId(raw?.productId||raw?.id),count=qty(raw?.qty??raw?.count);
    if(!productId||!count)throw new Error('INVENTORY_LINE_INVALID');
    const k=lineKey({...raw,productId});
    if(!out.has(k))out.set(k,{productId,sku:text(raw?.sku,120),color:text(raw?.color,120)||null,size:text(raw?.size,120)||null,qty:0});
    out.get(k).qty+=count;
  }
  return [...out.values()];
}
function reservationStatus(order={}){return String(order?.inventory?.status||order?.inventoryStatus||'').toLowerCase()}
function isExternalCatalogProduct(product={}){return String(product?.fulfillmentType||'').toLowerCase()==='external_catalog'||!!product?.externalMarket||!!product?.externalCatalog||String(product?.sourceType||'').toLowerCase().includes('external-market')}
function shouldTrack(product={},line={},variantIndex=-1){
  const variants=asArray(product.variants),variant=variantIndex>=0?variants[variantIndex]:null;
  if(isExternalCatalogProduct(product)&&product?.stockKnown!==true&&product?.externalMarket?.stockKnown!==true&&variant?.stockKnown!==true)return false;
  return numberOrNull(variant?.stockQty)!==null || numberOrNull(product.stockQty??product.stock)!==null;
}
async function reserveInventory(tx,db,lines,orderId){
  const grouped=aggregateLines(lines),byProduct=new Map();
  for(const line of grouped){if(!byProduct.has(line.productId))byProduct.set(line.productId,[]);byProduct.get(line.productId).push(line)}
  const refs=[...byProduct.keys()].map(id=>db.doc(`products/${id}`));
  const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
  const reservations=[];
  for(let i=0;i<refs.length;i++){
    const ref=refs[i],snap=snaps[i];
    if(!snap.exists)throw new Error(`PRODUCT_NOT_FOUND:${ref.id}`);
    const product=snap.data()||{},status=text(product.status||'approved',40).toLowerCase();
    if(status!=='approved')throw new Error(`PRODUCT_NOT_APPROVED:${ref.id}`);
    if(product.isActive===false||product.sellerActive===false)throw new Error(`PRODUCT_INACTIVE:${ref.id}`);
    const variants=asArray(product.variants).map(v=>({...v}));
    let productStock=numberOrNull(product.stockQty??product.stock),productDecrease=0,variantTouched=false;
    const rows=[];
    for(const line of byProduct.get(ref.id)||[]){
      const variantIndex=chooseVariantIndex(product,line),variant=variantIndex>=0?variants[variantIndex]:null;
      const variantStock=numberOrNull(variant?.stockQty),track=shouldTrack(product,line,variantIndex);
      if(track&&variantIndex>=0&&variantStock!==null){
        if(line.qty>variantStock)throw new Error(`OUT_OF_STOCK:${ref.id}`);
        variants[variantIndex]={...variant,stockQty:variantStock-line.qty};variantTouched=true;
      }
      const variantTracked=track&&variantIndex>=0&&variantStock!==null;
      const productTracked=track&&!variantTracked&&productStock!==null;
      if(productTracked)productDecrease+=line.qty;
      rows.push({productId:ref.id,sku:line.sku||'',color:line.color||null,size:line.size||null,qty:line.qty,variantIndex,tracked:track,variantTracked,productTracked});
    }
    if(productStock!==null){if(productDecrease>productStock)throw new Error(`OUT_OF_STOCK:${ref.id}`);productStock-=productDecrease}
    const patch={inventoryUpdatedAt:admin.firestore.FieldValue.serverTimestamp()};
    if(productStock!==null)patch.stockQty=productStock;
    if(variantTouched)patch.variants=variants;
    if(productStock!==null||variantTouched)tx.set(ref,patch,{merge:true});
    reservations.push(...rows);
  }
  return{status:'reserved',orderId:String(orderId||''),reservedAt:admin.firestore.Timestamp.now(),restored:false,lines:reservations};
}
async function prepareRestoreInventory(tx,db,order={}){
  const current=reservationStatus(order);
  const inv=order.inventory||{};
  if(current!=='reserved'||inv.restored===true)return{result:{restored:false,already:current==='restored'||inv.restored===true},apply:()=>{}};
  const source=asArray(inv.lines).length?inv.lines:aggregateLines(order.items||[]).map(x=>({...x,tracked:true,variantTracked:true,productTracked:true,variantIndex:-1}));
  const byProduct=new Map();
  for(const row of source){const id=safeId(row.productId);if(!id||!qty(row.qty))continue;if(!byProduct.has(id))byProduct.set(id,[]);byProduct.get(id).push({...row,productId:id,qty:qty(row.qty)})}
  const refs=[...byProduct.keys()].map(id=>db.doc(`products/${id}`));
  const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
  const writes=[];
  for(let i=0;i<refs.length;i++){
    const ref=refs[i],snap=snaps[i];if(!snap.exists)continue;
    const product=snap.data()||{},variants=asArray(product.variants).map(v=>({...v}));
    let productStock=numberOrNull(product.stockQty??product.stock),productIncrease=0,variantTouched=false;
    for(const row of byProduct.get(ref.id)||[]){
      let variantIndex=Number.isInteger(Number(row.variantIndex))?Number(row.variantIndex):-1;
      if(variantIndex<0||!variants[variantIndex])variantIndex=chooseVariantIndex(product,row);
      if(row.variantTracked&&variantIndex>=0&&variants[variantIndex]){
        const before=numberOrNull(variants[variantIndex].stockQty)??0;
        variants[variantIndex]={...variants[variantIndex],stockQty:before+row.qty};variantTouched=true;
      }
      if(row.productTracked&&productStock!==null)productIncrease+=row.qty;
    }
    const patch={inventoryUpdatedAt:admin.firestore.FieldValue.serverTimestamp()};
    if(productStock!==null){patch.stockQty=productStock+productIncrease}
    if(variantTouched)patch.variants=variants;
    if(productStock!==null||variantTouched)writes.push(()=>tx.set(ref,patch,{merge:true}));
  }
  return{
    result:{restored:true,lineCount:source.length},
    apply:(patch={},reason='')=>{
      writes.forEach(fn=>fn());
      patch.inventory={...inv,status:'restored',restored:true,restoreReason:text(reason,500),restoredAt:admin.firestore.Timestamp.now()};
      patch.inventoryStatus='restored';
      patch.inventoryRestoredAt=admin.firestore.FieldValue.serverTimestamp();
    }
  };
}
module.exports={reserveInventory,prepareRestoreInventory,reservationStatus,aggregateLines,chooseVariantIndex,numberOrNull};
