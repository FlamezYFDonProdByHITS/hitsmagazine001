(function(){
  const cfg = window.MAG_CONFIG || {};
  const $flip = document.getElementById('flipbook');
  const $thumbs = document.getElementById('thumbs');
  const $pageIndicator = document.getElementById('pageIndicator');
  const $btnPrev = document.getElementById('btnPrev');
  const $btnNext = document.getElementById('btnNext');
  const $btnZoom = document.getElementById('btnZoom');
  const $btnDownload = document.getElementById('btnDownload');

  // Helpers
  const pad = (n, size) => (cfg.pad ? String(n).padStart(cfg.pad, '0') : String(n));
  const imgSrc = (n)=> `${cfg.path}/${cfg.prefix}${pad(n, cfg.pad)}.${cfg.ext}`;
  const isMobile = () => window.innerWidth <= 980;

  // Create page DOM nodes
  function makePage(n){
    const d = document.createElement('div');
    d.className = 'page';
    d.setAttribute('data-page', String(n));

    const img = document.createElement('img');
    img.alt = `Page ${n}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.setAttribute('data-src', imgSrc(n));
    d.appendChild(img);

    return d;
  }

  // Lazy load images when the page is created/turned into view
  function ensureLoaded(pageNum){
    const page = $flip.querySelector(`.page[data-page="${pageNum}"]`);
    if(!page) return;
    const img = page.querySelector('img[data-src]');
    if(img && !img.src){
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
    }
  }

  // Build thumbnails
  function buildThumbs(){
    const frag = document.createDocumentFragment();
    for(let i=1; i<=cfg.totalPages; i++){
      const t = document.createElement('div');
      t.className = 'thumb';
      t.setAttribute('data-go', i);
      const im = document.createElement('img');
      im.src = imgSrc(i); // thumbs load small or same if you don't have separate thumbs
      const tag = document.createElement('div');
      tag.className = 'num';
      tag.textContent = i;
      t.appendChild(im); t.appendChild(tag);
      t.addEventListener('click', ()=> $('#flipbook').turn('page', i));
      frag.appendChild(t);
    }
    $thumbs.innerHTML = "";
    $thumbs.appendChild(frag);
  }

  // jQuery-free shorthand
  function $(sel){ return (sel === '#flipbook') ? window.jQuery(sel) : document.querySelector(sel); }

  // Initialize Turn.js
  function initFlipbook(){
    // If you prefer CDN, replace vendor file in index.html
    if(typeof jQuery === 'undefined'){
      // Create a bare-minimal jQuery shim just for Turn.js (Turn.js expects jQuery selection)
      // This micro-shim wraps only what turn.js uses (width/height/turn)
      window.jQuery = function(sel){
        if(sel === '#flipbook'){
          const api = {
            el: $flip,
            data: {},
            turn: function(action, param){
              if(action === 'page'){ if(param) api.methods.page(param); else return api.methods.page(); }
              else if(action === 'next'){ api.methods.next(); }
              else if(action === 'previous'){ api.methods.previous(); }
              else if(action === 'display'){ api.data.display = param; /* no-op for shim */ }
              return api;
            },
            methods: {}
          };
          return api;
        }
        return { };
      };
    }

    // Build inner pages container once
    $flip.innerHTML = "";
    for(let i=1; i<=cfg.totalPages; i++){
      $flip.appendChild(makePage(i));
    }

    // Use real Turn.js if present
    if(typeof jQuery === 'function' && typeof jQuery.fn?.turn !== 'function'){
      // If your turn.min.js depends on real jQuery, ensure you load jQuery before turn.min.js.
      // Most modern builds of turn.js also ship a vanilla init; the standard version expects jQuery.
      console.warn("If Turn.js requires jQuery, include jQuery before turn.min.js.");
    }

    // Initialize with options
    const displayMode = (cfg.singlePageOnMobile && isMobile()) ? 'single' : 'double';
    $('#flipbook').turn({
      width: $flip.clientWidth,
      height: $flip.clientHeight,
      autoCenter: true,
      display: displayMode,
      pages: cfg.totalPages,
      elevation: 50,
      gradients: true,
      when: {
        turning: function(e, page, view){
          // Preload target + neighbors
          [page-2, page-1, page, page+1, page+2].forEach(n=>{
            if(n>=1 && n<=cfg.totalPages) ensureLoaded(n);
          });
        },
        turned: function(e, page){
          updateIndicator(page);
        }
      }
    });

    // Load first spread images
    ensureLoaded(cfg.startPage || 1);
    ensureLoaded((cfg.startPage || 1)+1);
    updateIndicator($('#flipbook').turn('page'));

    // Resize handling
    window.addEventListener('resize', debounce(()=>{
      $('#flipbook').turn('size', $flip.clientWidth, calcHeight());
    }, 120));

    // Hash navigation (#page=5)
    applyHash();
    window.addEventListener('hashchange', applyHash);
  }

  function calcHeight(){
    // keep aspect ratio ~ 3:2 depending on viewport; you can customize
    return $flip.clientHeight;
  }

  function updateIndicator(cur){
    const total = cfg.totalPages;
    const page = cur || 1;
    $pageIndicator.textContent = `Page ${page} / ${total}`;
    // keep URL hash in sync
    try{
      const url = new URL(location.href);
      url.hash = `page=${page}`;
      history.replaceState(null, "", url);
    }catch{}
  }

  function applyHash(){
    const m = location.hash.match(/page=(\d+)/);
    if(m){
      const p = Math.max(1, Math.min(cfg.totalPages, parseInt(m[1],10)));
      $('#flipbook').turn('page', p);
    }
  }

  // Debounce util
  function debounce(fn, t){
    let id=null; return function(){ clearTimeout(id); id=setTimeout(()=>fn.apply(this, arguments), t); };
  }

  // Controls
  $btnPrev.addEventListener('click', ()=> $('#flipbook').turn('previous'));
  $btnNext.addEventListener('click', ()=> $('#flipbook').turn('next'));
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowLeft') $('#flipbook').turn('previous');
    if(e.key === 'ArrowRight') $('#flipbook').turn('next');
  });

  // Zoom (CSS scale)
  let zoomed = false;
  $btnZoom.addEventListener('click', toggleZoom);
  $flip.addEventListener('click', (e)=>{
    // double-click-ish zoom when clicking page background (not buttons)
    if(e.target === $flip || e.target.classList.contains('page')) toggleZoom();
  });
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
  // wheel zoom
  $flip.addEventListener('wheel', (e)=>{
    if(e.ctrlKey){
      e.preventDefault();
      zoomed = e.deltaY < 0 ? true : false;
      document.body.classList.toggle('zoomed', zoomed);
      $flip.style.transform = zoomed ? 'scale(1.2)' : '';
      $flip.style.transformOrigin = 'center center';
    }
  }, { passive:false });

  // Optional: download button
  if(cfg.downloadZipUrl){
    $btnDownload.href = cfg.downloadZipUrl;
  } else {
    $btnDownload.style.display = 'none';
  }

  // Build thumbnails + init
  buildThumbs();
  initFlipbook();

})();
