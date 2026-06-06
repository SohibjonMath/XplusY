(function(){
  const OLD_SELECTORS='#nprogress,.nprogress,.pace,.pace-progress,.top-loader,.top-progress,.loading-bar,.progress-line,.app-progress,[data-top-progress]';
  let root=null,hold=0,failSafe=null,pulseTimer=null;
  function removeOldBars(){document.querySelectorAll(OLD_SELECTORS).forEach(x=>{try{x.remove()}catch(_){x.style.display='none'}})}
  function ensure(){
    if(root&&document.body?.contains(root))return root;
    if(!document.body)return null;
    root=document.createElement('div');
    root.id='omProfessionalLoader';root.className='om-pro-loader is-hidden';root.setAttribute('aria-live','polite');root.setAttribute('aria-label','Yuklanmoqda');
    root.innerHTML='<div class="om-loader-card"><div><div class="om-loader-stage"><span class="om-loader-ring"></span><span class="om-loader-ring r2"></span><span class="om-loader-ring r3"></span><span class="om-loader-logo"><img src="/logo.webp" alt="OrzuMall"></span></div><div class="om-loader-copy"><b id="omLoaderTitle">OrzuMall tayyorlanmoqda</b><span id="omLoaderText">Bir necha soniya kuting...</span></div><div class="om-loader-dots"><i></i><i></i><i></i></div></div></div>';
    document.body.appendChild(root);return root;
  }
  function setText(label,sub){const r=ensure();if(!r)return;const a=r.querySelector('#omLoaderTitle'),b=r.querySelector('#omLoaderText');if(a&&label)a.textContent=label;if(b&&sub)b.textContent=sub}
  function show(label='Sahifa tayyorlanmoqda',opts={}){removeOldBars();const r=ensure();if(!r)return;hold+=1;setText(label,opts.sub||'Bir necha soniya kuting...');r.classList.toggle('is-soft',!!opts.soft);r.classList.remove('is-hidden');clearTimeout(failSafe);failSafe=setTimeout(()=>hide(true),Math.max(3500,Number(opts.timeout)||9000))}
  function hide(force=false){const r=ensure();if(!r)return;if(force)hold=0;else hold=Math.max(0,hold-1);if(hold>0)return;clearTimeout(failSafe);r.classList.add('is-hidden');setTimeout(()=>r.classList.remove('is-soft'),320)}
  function pulse(label='Sahifa tayyorlanmoqda',ms=520){clearTimeout(pulseTimer);show(label,{soft:true,timeout:2200});pulseTimer=setTimeout(()=>hide(),Math.max(260,Number(ms)||520))}
  async function withPromise(p,label='Ma’lumotlar yuklanmoqda'){show(label);try{return await p}finally{hide()}}
  window.OrzuLoader={show,hide,pulse,withPromise,removeOldBars};
  function initial(){removeOldBars();show('OrzuMall yuklanmoqda',{sub:'Sahifa xavfsiz tayyorlanmoqda...',timeout:5200});if(document.readyState==='complete')setTimeout(()=>hide(true),240)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initial,{once:true});else initial();
  window.addEventListener('load',()=>setTimeout(()=>hide(true),280),{once:true});
  window.addEventListener('pageshow',()=>setTimeout(()=>hide(true),140));
  window.addEventListener('hashchange',()=>pulse('Sahifa tayyorlanmoqda',430));
  document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(!a)return;try{const u=new URL(a.href,location.href);if(u.origin===location.origin&&u.pathname!==location.pathname)show('Sahifa ochilmoqda',{sub:'Kerakli bo‘lim tayyorlanmoqda...'})}catch(_){}});
  const mo=new MutationObserver(removeOldBars);if(document.documentElement)mo.observe(document.documentElement,{childList:true,subtree:true});
})();
