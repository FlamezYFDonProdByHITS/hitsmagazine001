(function(){
  const cfg = window.MAG_CONFIG || {};
  const $book = document.getElementById('book');
  const $bookWrap = document.getElementById('bookWrap');
  const $thumbs = document.getElementById('thumbs');
  const $pageIndicator = document.getElementById('pageIndicator');
  const $btnPrev = document.getElementById('btnPrev');
  const $btnNext = document.getElementById('btnNext');
  const $btnZoom = document.getElementById('btnZoom');
  const $diag = document.getElementById('diag');
  const $diagList = document.getElementById('diagList');

  // Toggle diagnostics via console
  if (window.DIAG) $diag.hidden = false;

  const pad = (n, size)=> (cfg.pad ? String(n).padStart(cfg.pad, '0') : String(n));
  const src = (n)=> `${cfg.path}/${cfg.prefix}${pad(n, cfg.pad)}.${cfg.ext}`;
  const isMobile = ()=> window.innerWidth <= 980;

  // State
  const total = Math.max(1, cfg.totalPages|0);
  let current = Math.min(Math.max(cfg.startPage||1, 1), total); // 1..total
  let display = (total === 1 || (cfg.singlePageOnMobile && isMobile())) ? 'single' : 'double';
  let dragging = null;

  // Log helper
  function log(msg, ok=true){
    if(!$diagList) return;
    const row = document.createElement('div');
    row.innerHTML = `<span class="${ok?'ok':'bad'}">●</span> ${msg}`;
    $diagList.appendChild(row);
  }

  // Preload a few images
  function preload(n){
    if(n<1 || n>total) return;
    const im = new Image();
    im.src = src(n);
  }
  [current-1,current,current+1,current+2].forEach(preload);

  // Build spreads/pages
  function build(){
    $book.innerHTML = '';
    if(display === 'single'){
      // One page centered
      const wrap = document.createElement('div');
      wrap.className = 'spread';
      const p = mkPage(current, 'single');
      p.style.width = '100%';
      p.style.left = '0%';
      p.style.border = 'none';
      wrap.appendChild(p);
      $book.appendChild(wrap);
    } else {
      // Double page
      const wrap = document.createElement('div');
      wrap.className = 'spread';
      const leftIndex = Math.max(1, current - (current%2===0 ? 1 : 0)); // make current the left if even/odd mismatch
      const rightIndex = Math.min(total, leftIndex + 1);
      const left = mkPage(leftIndex, 'left');
      const right = mkPage(rightIndex, 'right');
      wrap.appendChild(left);
      wrap.appendChild(right);
      $book.appendChild(wrap);
    }
    updateIndicator();
    bindHover();
  }

  function mkPage(n, side){
    const d = document.createElement('div');
    d.className = 'page' + (side==='right' ? ' right' : '');
    d.dataset.page = String(n);
    const img = document.createElement('img');
    img.alt = `Page ${n}`;
    img.src = src(n);
    img.onerror = ()=> log(`MISS p${n}: ${img.src}`, false);
    d.appendChild(img);

    // Interaction
    d.addEventListener('pointerdown', (e)=>startDrag(e, d));
    d.addEventListener('pointerup', endDrag);
    d.addEventListener('pointerleave', endDrag);
    d.addEventListener('pointermove', onDrag);
    return d;
  }

  function updateIndicator(){
    $pageIndicator.textContent = `Page ${current} / ${total}`;
  }

  // Flip logic
  function flipNext(){
    if(display==='single'){
      if(current < total){ animateFlip('next-single'); current++; build(); }
    } else {
      // increment to next spread start (odd to even, etc.)
      const base = current%2===0 ? current+2 : current+1;
      if(base <= total){ animateFlip('next'); current = base; build(); }
    }
  }
  function flipPrev(){
    if(display==='single'){
      if(current > 1){ animateFlip('prev-single'); current--; build(); }
    } else {
      const base = current%2===0 ? current-2 : current-1;
      if(base >= 1){ animateFlip('prev'); current = base; build(); }
    }
  }

  // Minimal flip animation (CSS rotateY on a temporary overlay page)
  function animateFlip(dir){
    const overlay = document.createElement('div');
    overlay.className = 'page flipping';
    overlay.style.width = (display==='single') ? '100%' : '50%';
    overlay.style.left  = (dir.startsWith('prev')) ? (display==='single' ? '0%' : '0%') : (display==='single' ? '0%' : '50%');
    overlay.style.transformOrigin = dir.startsWith('prev') ? 'left center' : 'right center';
    overlay.style.background = 'linear-gradient(180deg, #14141a, #0d0d10)';

    $book.appendChild(overlay);
    const start = dir.startsWith('prev') ? -0.0001 : 0.0001; // tiny offset to trigger transition
    overlay.style.transform = `rotateY(${start}deg)`;
    overlay.getBoundingClientRect(); // force style calc
    overlay.style.transition = 'transform 400ms cubic-bezier(.25,.8,.25,1)';
    overlay.style.transform = `rotateY(${dir.startsWith('prev')?90:-90}deg)`;
    setTimeout(()=> overlay.remove(), 420);
  }

  // Hover hints
  function bindHover(){
    const pages = $book.querySelectorAll('.page');
    pages.forEach(p=>{
      p.addEventListener('mouseenter', ()=> p.classList.add('hover'));
      p.addEventListener('mouseleave', ()=> p.classList.remove('hover'));
    });
  }

  // Drag to flip (simple — triggers prev/next on release threshold)
  function startDrag(e, pageEl){
    dragging = { startX: e.clientX, el: pageEl };
    pageEl.setPointerCapture(e.pointerId);
    pageEl.classList.add('flipping');
  }
  function onDrag(e){
    if(!dragging) return;
    const dx = e.clientX - dragging.startX;
    const el = dragging.el;
    const isRight = el.classList.contains('right') || display==='single';
    const w = el.clientWidth;
    // Map drag to angle
    let angle = (dx / w) * (isRight ? -90 : 90);
    angle = Math.max(Math.min(angle, 90), -90);
    el.style.transform = `rotateY(${angle}deg)`;
  }
  function endDrag(){
    if(!dragging) return;
    const el = dragging.el;
    const angleStr = el.style.transform.match(/rotateY\((-?\d+\.?\d*)deg\)/);
    const angle = angleStr ? parseFloat(angleStr[1]) : 0;
    el.classList.remove('flipping');
    el.style.transition = 'transform 220ms ease';
    const committed = Math.abs(angle) > 35;
    if(committed){
      el.style.transform = `rotateY(${angle>0?90:-90}deg)`;
      setTimeout(()=>{
        el.style.transition = ''; el.style.transform = '';
        (angle<0) ? flipNext() : flipPrev();
      }, 220);
    } else {
      el.style.transform = 'rotateY(0deg)';
      setTimeout(()=>{ el.style.transition=''; }, 220);
    }
    dragging = null;
  }

  // Thumbs
  function buildThumbs(){
    const frag = document.createDocumentFragment();
    for(let i=1;i<=total;i++){
      const t = document.createElement('div');
      t.className = 'thumb'; t.dataset.go = i;
      const im = document.createElement('img');
      im.src = src(i);
      im.onerror = ()=> log(`Thumb MISS p${i}: ${im.src}`, false);
      const tag = document.createElement('div'); tag.className = 'num'; tag.textContent = i;
      t.appendChild(im); t.appendChild(tag);
      t.addEventListener('click', ()=> { current = i; build(); });
      frag.appendChild(t);
    }
    $thumbs.innerHTML = ''; $thumbs.appendChild(frag);
  }

  // Controls
  $btnPrev.addEventListener('click', flipPrev);
  $btnNext.addEventListener('click', flipNext);
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowLeft') flipPrev();
    if(e.key === 'ArrowRight') flipNext();
  });

  // Zoom (CSS scale)
  let zoomed = false;
  function toggleZoom(){
    zoomed = !zoomed;
    document.body.classList.toggle('zoomed', zoomed);
  }
  $btnZoom.addEventListener('click', toggleZoom);
  $bookWrap.addEventListener('wheel', (e)=>{
    if(e.ctrlKey){
      e.preventDefault();
      zoomed = e.deltaY < 0 ? true : false;
      document.body.classList.toggle('zoomed', zoomed);
    }
  }, { passive:false });

  // Responsive: switch single/double on resize
  let resizeId=null;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeId);
    resizeId = setTimeout(()=>{
      const newDisplay = (total===1 || (cfg.singlePageOnMobile && isMobile())) ? 'single' : 'double';
      if(newDisplay !== display){ display = newDisplay; build(); }
    }, 120);
  });

  // Debug
  log(`Location: ${location.origin}${location.pathname}`, true);
  log(`totalPages: ${total}`, true);
  log(`first image: ${src(1)}`, true);

  // Boot
  buildThumbs();
  build();
})();
