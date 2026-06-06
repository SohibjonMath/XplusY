const admin=require('firebase-admin');

function cleanText(v,max=500){return String(v==null?'':v).trim().slice(0,max)}
function safeId(v){return cleanText(v,128).replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')}
function clampInt(v,min=1,max=999){const n=Number(v);return Number.isInteger(n)&&n>=min&&n<=max?n:null}
function parsePrice(v){if(typeof v==='number'&&Number.isFinite(v))return Math.max(0,Math.round(v));const d=String(v==null?'':v).replace(/[^0-9]/g,'');return d?Math.max(0,parseInt(d.slice(0,12),10)||0):0}
function firstPrice(...vals){for(const v of vals){const n=parsePrice(v);if(n>0)return n}return 0}
function asArray(v){return Array.isArray(v)?v:[]}
function pickVariant(product,item){const vs=asArray(product?.variants);if(!vs.length)return null;const color=cleanText(item?.color,100)||null,size=cleanText(item?.size,100)||null;const same=(a,b)=>(a??null)===(b??null);return vs.find(v=>same(v?.color,color)&&same(v?.size,size))||vs.find(v=>same(v?.color,color))||vs.find(v=>same(v?.size,size))||vs[0]||null}
function productImage(product,item,variant){const color=cleanText(item?.color,100);const by=product?.imagesByColor&&typeof product.imagesByColor==='object'?product.imagesByColor:{};const imgs=color&&Array.isArray(by[color])?by[color]:[];return cleanText(item?.image||variant?.image||imgs[0]||product?.images?.[0]||product?.image||product?.imageUrl,900)||null}
function roundMoney(n){return Math.max(0,Math.round(Number(n)||0))}
async function sellerSnapshot(db,product,cache){
  const id=safeId(product?.sellerId||((product?.ownerType==='seller')?'':'orzumall'))||'orzumall';
  if(id==='orzumall')return{id:'orzumall',name:'OrzuMall',logo:cleanText(product?.sellerLogo,900),phone:'',active:true,commissionPercent:0};
  if(cache.has(id))return cache.get(id);
  const snap=await db.doc(`sellers/${id}`).get();
  if(!snap.exists)throw new Error(`SELLER_NOT_FOUND:${id}`);
  const d=snap.data()||{};
  if(d.active===false)throw new Error(`SELLER_DISABLED:${id}`);
  const out={id,name:cleanText(d.storeName||product?.sellerName||'Seller',140),logo:cleanText(d.logoUrl||product?.sellerLogo,900),phone:cleanText(d.phone,80),active:true,commissionPercent:Math.max(0,Math.min(100,Number(d.commissionPercent??10)||0))};
  cache.set(id,out);return out;
}
async function loadCatalogLines(db,rawItems){
  const items=asArray(rawItems);if(items.length<1||items.length>80)throw new Error('ITEMS_RANGE');
  const productCache=new Map(),sellerCache=new Map(),lines=[];
  let subtotalUZS=0,totalWeightKg=0;
  for(const raw of items){
    const productId=safeId(raw?.productId||raw?.id||'');const qty=clampInt(raw?.qty??raw?.count??1);
    if(!productId||!qty)throw new Error('ITEM_FORMAT');
    if(!productCache.has(productId)){const snap=await db.doc(`products/${productId}`).get();productCache.set(productId,snap.exists?{id:snap.id,...(snap.data()||{})}:null)}
    const product=productCache.get(productId);if(!product)throw new Error(`PRODUCT_NOT_FOUND:${productId}`);
    const status=cleanText(product.status||'approved',40).toLowerCase();if(status!=='approved')throw new Error(`PRODUCT_NOT_APPROVED:${productId}`);if(product.isActive===false||product.sellerActive===false)throw new Error(`PRODUCT_INACTIVE:${productId}`);
    const variant=pickVariant(product,raw);
    const unitPriceUZS=firstPrice(variant?.priceUZS,variant?.currentPriceUZS,variant?.price,variant?.salePrice,product.priceUZS,product.currentPriceUZS,product.price,product.salePrice,product.newPrice,product.basePrice,product.amount);
    if(!unitPriceUZS)throw new Error(`PRICE_NOT_FOUND:${productId}`);
    const stockRaw=variant?.stockQty??product.stockQty??product.stock??null;const stockQty=stockRaw==null||stockRaw===''?null:Number(stockRaw);
    if(Number.isFinite(stockQty)&&stockQty>=0&&qty>stockQty)throw new Error(`OUT_OF_STOCK:${productId}`);
    const seller=await sellerSnapshot(db,product,sellerCache);
    const gross=roundMoney(unitPriceUZS*qty),commission=roundMoney(gross*seller.commissionPercent/100),net=roundMoney(gross-commission);
    const weightKg=Math.max(0,Number(product.weightKg??product.weight??raw.weightKg??0)||0);
    const line={
      productId,id:productId,sku:cleanText(variant?.sku||product.sku||product.article||productId,100),article:cleanText(product.article||product.sku||productId,100),
      name:cleanText(product.name||product.title||'Mahsulot',180),title:cleanText(product.title||product.name||'Mahsulot',180),
      color:cleanText(raw?.color,100)||null,size:cleanText(raw?.size,100)||null,variant:cleanText(raw?.variant,140)||null,qty,
      priceUZS:unitPriceUZS,unitPriceUZS,lineTotalUZS:gross,weightKg,lineWeightKg:weightKg*qty,image:productImage(product,raw,variant),
      stockQty:Number.isFinite(stockQty)?stockQty:null,fulfillmentType:cleanText(product.fulfillmentType||raw?.fulfillmentType||'stock',30),
      deliveryMinDays:Number(product.deliveryMinDays??raw?.deliveryMinDays??1)||1,deliveryMaxDays:Number(product.deliveryMaxDays??raw?.deliveryMaxDays??7)||7,prepayRequired:Boolean(product.prepayRequired??raw?.prepayRequired??false),
      sellerId:seller.id,sellerName:seller.name,sellerLogo:seller.logo,sellerPhone:seller.phone,sellerCommissionPercent:seller.commissionPercent,sellerGrossUZS:gross,sellerCommissionUZS:commission,sellerNetUZS:net
    };
    lines.push(line);subtotalUZS+=gross;totalWeightKg+=line.lineWeightKg;
  }
  return{lines,subtotalUZS:roundMoney(subtotalUZS),totalWeightKg,sellerSummary:buildSellerSummary(lines)};
}
function buildSellerSummary(lines){
  const accounting={},progress={};
  for(const line of asArray(lines)){
    const id=safeId(line.sellerId)||'orzumall';
    if(!accounting[id])accounting[id]={sellerId:id,sellerName:cleanText(line.sellerName||'Seller',140),sellerLogo:cleanText(line.sellerLogo,900),sellerPhone:cleanText(line.sellerPhone,80),commissionPercent:Number(line.sellerCommissionPercent||0),grossUZS:0,commissionUZS:0,netUZS:0,itemCount:0,settlementStatus:'pending'};
    const a=accounting[id];a.grossUZS+=roundMoney(line.sellerGrossUZS??line.lineTotalUZS);a.commissionUZS+=roundMoney(line.sellerCommissionUZS);a.netUZS+=roundMoney(line.sellerNetUZS??line.lineTotalUZS);a.itemCount+=Number(line.qty||0);
  }
  Object.values(accounting).forEach(a=>{a.grossUZS=roundMoney(a.grossUZS);a.commissionUZS=roundMoney(a.commissionUZS);a.netUZS=roundMoney(a.netUZS);progress[a.sellerId]={sellerId:a.sellerId,sellerName:a.sellerName,status:'new',itemCount:a.itemCount,subtotalUZS:a.grossUZS,updatedAt:admin.firestore.Timestamp.now()}});
  return{sellerIds:Object.keys(accounting),sellerAccounting:accounting,sellerProgress:progress};
}
module.exports={cleanText,safeId,clampInt,parsePrice,firstPrice,loadCatalogLines,buildSellerSummary,roundMoney};
