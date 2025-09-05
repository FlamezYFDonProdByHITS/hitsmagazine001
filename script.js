(function(){
  const cfg = window.MAG_CONFIG || {};
  const $flip = document.getElementById('flipbook');
  const $thumbs = document.getElementById('thumbs');
  const $pageIndicator = document.getElementById('pageIndicator');
  const $btnPrev = document.getElementById('btnPrev');
  const $btnNext = document.getElementById('btnNext');
  const $btnZoom = document.getElementById('btnZoom');
  const $diagList = document.getElementById('diagList');

  // Helpers
  const pad = (n, size) => (cfg.pad ? String(n).padStart(cfg.pad, '0') : String(n));
  const imgSrc = (n)=> `${cfg.path}/${cfg.prefix}${pad(n, cfg.pad)}.${cfg.ext}`;
  const isMobile = () => window.innerWidth <= 980;

  function log(msg, ok=true){
    if(!$diagList) return;
    const row = document.createElement('div');
    row.innerHTML = `<span class="${ok?'ok':'bad'}">●</span> ${msg}`;
    $diagList.appendChild(row);
  }

  function testImage(url, label){
    return new Promise((resolve)=>{
      const img = new Image();
      img.onload = ()=>{ log(`OK ${label}: ${url}`, true); resolve(true); };
      img.onerror = ()=>{ log(`MISS ${label}: ${url}`, false); resolve(false); };
      img.src = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
    });
  }

  // Build page node (no lazy for single page)
  function makePage(n){
    const d = document.createElement('div');
    d.className = 'page';
    d.setAttribute('data-page', String(n));
    const img = document.createElement('img');
    img.alt = `Page ${n}`;
    img.loading = 'eager';
    img.decoding = 'async';
    img.src = imgSrc(n);
    img.onerror = ()=> log(`IMG tag error @ page ${n} → ${img.src}`, false);
    d.appendChild(img);
    return d;
  }

  function buildThumbs(){
    const frag = document.createDocumentFragment();
    for(let i=1; i<=cfg.totalPages; i++){
      const t = document.createElement('div');
      t.className = 'thumb';
      t.setAttribute('data-go', i);
      const im = document.createElement('img');
      im.src = imgSrc(i);
      im.onerror = ()=> log(`Thumb error p${i} → ${im.src}`, false);
      const tag = document.createElement('div');
      tag.className = 'num';
      tag.textContent = i;
      t.appendChild(im); t.appendChild(tag);
      t.addEventListener('click', ()=> window.jQuery && jQuery('#flipbook').turn ? jQuery('#flipbook').turn('page', i) : null);
      frag.appendChild(t);
    }
    $thumbs.innerHTML = "";
    $thumbs.appendChild(frag);
  }

  function updateIndicator(cur){
    const total = cfg.totalPages;
    const page = cur || 1;
    $pageIndicator.textContent = `Page ${page} / ${total}`;
  }

  function initFlipbook(){
    // Build pages container
    $flip.innerHTML = "";
    for(let i=1; i<=cfg.totalPages; i++){
      $flip.appendChild(makePage(i));
    }

    // Probe environment
    log(`Location: ${location.origin}${location.pathname}`);
    log(`flipbook size: ${$flip.clientWidth}×${$flip.clientHeight} (if 0×0, CSS/height issue)`, $flip.clientWidth>0 && $flip.clientHeight>0);
    log(`jQuery loaded: ${typeof window.jQuery === 'function'}`, !!window.jQuery);
    log(`Turn.js loaded: ${typeof window.jQuery?.fn?.turn === 'function' || window.__turnLoaded === true}`, !!(window.jQuery?.fn?.turn));

    // Probe image URL(s)
    for(let i=1;i<=Math.min(cfg.totalPages,3);i++){
      testImage(imgSrc(i), `p${i}`);
    }

    // If Turn.js not ready, show a graceful fallback (still shows the image!)
    if(!(window.jQuery && jQuery.fn && typeof jQuery.fn.turn === 'function')){
      log('Turn.js not available → showing static image fallback', false);
      updateIndicator(1);
      // Nothing else to init; image already visible as plain <img>
      return;
    }

    const mode = (cfg.totalPages === 1 || (cfg.singlePageOnMobile && isMobile())) ? 'single' : 'double';

    // Initialize Turn.js
    jQuery('#flipbook').turn({
      width: $flip.clientWidth || 800,
      height: $flip.clientHeight || 600,
      autoCenter: true,
      display: mode,
      pages: cfg.totalPages,
      elevation: 50,
      gradients: true,
      when: {
        turned: function(e, page){ updateIndicator(page); }
      }
    });

    jQuery('#flipbook').turn('page', cfg.startPage || 1);

    // Resize handler
    window.addEventListener('resize', debounce(()=>{
      jQuery('#flipbook').turn('size', $flip.clientWidth, $flip.clientHeight);
    }, 120));
  }

  function debounce(fn, t){
    let id=null; return function(){ clearTimeout(id); id=setTimeout(()=>fn.apply(this, arguments), t); };
  }

  // Controls
  $btnPrev.addEventListener('click', ()=> window.jQuery?.fn?.turn && jQuery('#flipbook').turn('previous'));
  $btnNext.addEventListener('click', ()=> window.jQuery?.fn?.turn && jQuery('#flipbook').turn('next'));
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowLeft') window.jQuery?.fn?.turn && jQuery('#flipbook').turn('previous');
    if(e.key === 'ArrowRight') window.jQuery?.fn?.turn && jQuery('#flipbook').turn('next');
  });

  // Zoom (CSS)
  let zoomed = false;
  function toggleZoom(){
    zoomed = !zoomed;
    document.body.classList.toggle('zoomed', zoomed);
    if(zoomed){
      $flip.style.transform = 'scale(1.2)';
      $flip.style.transformOrigin = 'center center';
    } else {
      $flip.style.transform = '';
      $flip.style.transformOrigin = '';
    }
  }
  $btnZoom.addEventListener('click', toggleZoom);
  $flip.addEventListener('wheel', (e)=>{
    if(e.ctrlKey){
      e.preventDefault();
      zoomed = e.deltaY < 0 ? true : false;
      document.body.classList.toggle('zoomed', zoomed);
      $flip.style.transform = zoomed ? 'scale(1.2)' : '';
      $flip.style.transformOrigin = 'center center';
    }
  }, { passive:false });

  // Boot
  buildThumbs();
  initFlipbook();
})();
