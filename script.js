(async function(){
  const cfg = window.MAG_CONFIG || {};
  const $flip = document.getElementById('flipbook');
  const $thumbs = document.getElementById('thumbs');
  const $pageIndicator = document.getElementById('pageIndicator');
  const $btnPrev = document.getElementById('btnPrev');
  const $btnNext = document.getElementById('btnNext');
  const $btnZoom = document.getElementById('btnZoom');
  const $diagList = document.getElementById('diagList');

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

  // Build UI
  $flip.innerHTML = "";
  for(let i=1; i<=cfg.totalPages; i++){
    $flip.appendChild(makePage(i));
  }
  buildThumbs();

  // Environment probes
  log(`Location: ${location.origin}${location.pathname}`);
  log(`flipbook size: ${$flip.clientWidth}×${$flip.clientHeight}`, $flip.clientWidth>0 && $flip.clientHeight>0);

  const turnWhere = await (window.__turnReady || Promise.resolve('unknown'));
  log(`Turn.js source: ${turnWhere}`, turnWhere !== 'failed');
  log(`jQuery loaded: ${typeof window.jQuery === 'function'}`, !!window.jQuery);
  log(`Turn.js API available: ${!!(window.jQuery?.fn?.turn)}`, !!(window.jQuery?.fn?.turn));

  // Probe image(s)
  for(let i=1;i<=Math.min(cfg.totalPages,3);i++){
    await testImage(imgSrc(i), `p${i}`);
  }

  // If Turn.js missing, keep static image fallback
  if(!(window.jQuery && jQuery.fn && typeof jQuery.fn.turn === 'function')){
    log('Turn.js not available → showing static image fallback', false);
    updateIndicator(1);
    wireControlsFallback();
    return;
  }

  const mode = (cfg.totalPages === 1 || (cfg.singlePageOnMobile && isMobile())) ? 'single' : 'double';

  // Init flipbook
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

  // Resize
  window.addEventListener('resize', debounce(()=>{
    jQuery('#flipbook').turn('size', $flip.clientWidth, $flip.clientHeight);
  }, 120));

  wireControlsFlip();

  // Controls when Turn.js IS available
  function wireControlsFlip(){
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'ArrowLeft') jQuery('#flipbook').turn('previous');
      if(e.key === 'ArrowRight') jQuery('#flipbook').turn('next');
    });
    $btnPrev.addEventListener('click', ()=> jQuery('#flipbook').turn('previous'));
    $btnNext.addEventListener('click', ()=> jQuery('#flipbook').turn('next'));
    setupZoom();
  }

  // Controls when Turn.js is NOT available
  function wireControlsFallback(){
    document.addEventListener('keydown', (e)=>{ /* nothing to flip on single image */ });
    $btnPrev.addEventListener('click', ()=>{});
    $btnNext.addEventListener('click', ()=>{});
    setupZoom();
  }

  function setupZoom(){
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
  }

  function debounce(fn, t){
    let id=null; return function(){ clearTimeout(id); id=setTimeout(()=>fn.apply(this, arguments), t); };
  }
})();
