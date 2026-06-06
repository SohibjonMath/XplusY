(function(){
  const SELECTORS = '#nprogress,.nprogress,.nprogress-bar,.pace,.pace-progress,.pace-active,.top-loader,.top-progress,.loading-bar,.progress-line,.app-progress,.page-progress,.page-loading-line,.router-progress,.loading-progress,[data-top-progress],[data-page-progress],#omProfessionalLoader,.om-pro-loader';
  function removeLoadingUI(){
    document.querySelectorAll(SELECTORS).forEach(el=>{ try{ el.remove(); } catch(_){ el.style.display='none'; } });
  }
  const noop=()=>{};
  window.OrzuLoader={show:noop,hide:noop,pulse:noop,removeOldBars:removeLoadingUI,withPromise:async p=>await p};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',removeLoadingUI,{once:true}); else removeLoadingUI();
  window.addEventListener('load',removeLoadingUI,{once:true});
  window.addEventListener('pageshow',removeLoadingUI);
  const mo=new MutationObserver(removeLoadingUI);
  if(document.documentElement) mo.observe(document.documentElement,{childList:true,subtree:true});
})();
