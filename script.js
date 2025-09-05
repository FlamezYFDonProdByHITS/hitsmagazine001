(function(){
  const cfg = window.MAG_CONFIG || {};
  const $flip = document.getElementById('flipbook');
  const $thumbs = document.getElementById('thumbs');
  const $pageIndicator = document.getElementById('pageIndicator');
  const $btnPrev = document.getElementById('btnPrev');
  const $btnNext = document.getElementById('btnNext');
  const $btnZoom = document.getElementById('btnZoom');

  const pad = (n, size) => (cfg.pad ? String(n).padStart(cfg.pad, '0') : String(n));
  const imgSrc = (n)=> `${cfg.path}/${cfg.prefix}${pad(n, cfg.pad)}.${cfg.ext}`;
  const isMobile = () => window.innerWidth <= 980;

  function makePage(n){
    const d = document.createElement('div');
    d.className = 'page';
    d.setAttribute('data-page', String(n));
    const img = document.createElement('img');
    img.alt = `Page ${n}`;
    img.loading = 'eager'; // with 1 page, eager is fine
    img.decoding = 'async';
    img.src = imgSrc(n);
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
      const tag = document.createElement('div');
      tag.className = 'num';
      tag.textContent = i;
      t.appendChild(im); t.appendChild(tag);
      t.addEventListener('click', ()=> jQuery('#flipbook').turn('page', i));
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
    // Build pages
    $flip.innerHTML = "";
    for(let i=1; i<=cfg.totalPages; i++){
      $flip.appendChild(makePage(i));
    }

    // Turn.js expects jQuery build by default
    if(typeof jQuery === 'undefined' || typeof jQuery.fn?.turn !== 'function'){
      console.warn('Make sure jQuery is loaded BEFORE vendor/turn.min.js, and turn.min.js exists.');
    }

    const mode = (cfg.totalPages === 1 || (cfg.singlePageOnMobile && isMobile())) ? 'single' : 'double';

    // Initialize turn
    jQuery('#flipbook').turn({
      width: $flip.clientWidth,
      height: $flip.clientHeight,
      autoCenter: true,
      display: mode,
      pages: cfg.totalPages,
      elevation: 50,
      gradients: true,
      when: {
        turned: function(e, page){ updateIndicator(page); }
      }
    });

    // With only 1 page, make sure we’re on page 1
    jQuery('#flipbook').turn('page', cfg.startPage || 1);

    // Resize
    window.addEventListener('resize', debounce(()=>{
      jQuery('#flipbook').turn('size', $flip.clientWidth, $flip.clientHeight);
    }, 120));
  }

  function debounce(fn, t){
    let id=null; return function(){ clearTimeout(id); id=setTimeout(()=>fn.apply(this, arguments), t); };
  }

  // Controls
  $btnPrev.addEventListener('click', ()=> jQuery('#flipbook').turn('previous'));
  $btnNext.addEventListener('click', ()=> jQuery('#flipbook').turn('next'));
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowLeft') jQuery('#flipbook').turn('previous');
    if(e.key === 'ArrowRight') jQuery('#flipbook').turn('next');
  });

  // Zoom (simple CSS scale)
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

  // Go
  buildThumbs();
  initFlipbook();
})();
