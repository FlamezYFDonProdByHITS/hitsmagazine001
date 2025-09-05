(function(){
  const cfg = window.MAG_CONFIG || {};
  const $book = document.getElementById('book');
  const $bookWrap = document.getElementById('bookWrap');
  const $pageIndicator = document.getElementById('pageIndicator');
  const $pageSlider = document.getElementById('pageSlider');
  const $pageInput = document.getElementById('pageInput');
  const $btnFirst = document.getElementById('btnFirst');
  const $btnPrev = document.getElementById('btnPrev');
  const $btnNext = document.getElementById('btnNext');
  const $btnLast = document.getElementById('btnLast');
  const $btnGrid = document.getElementById('btnGrid');
  const $btnZoom = document.getElementById('btnZoom');
  const $btnFull = document.getElementById('btnFull');
  const $btnPlay = document.getElementById('btnPlay');
  const $gridOverlay = document.getElementById('gridOverlay');
  const $grid = document.getElementById('grid');
  const $btnCloseGrid = document.getElementById('btnCloseGrid');
  const $hotkey = document.getElementById('hotkey');
  const $progress = document.getElementById('progress');

  // Diagnostics
  const $diag = document.getElementById('diag');
  const $diagList = document.getElementById('diagList');
  if (window.DIAG) $diag.hidden = false;
  const log = (m, ok=true)=>{ if(!$diagList) return; const d=document.createElement('div'); d.innerHTML=`<span class="${ok?'ok':'bad'}">●</span> ${m}`; $diagList.appendChild(d); };

  // Utils
  const pad = (n, size)=> (cfg.pad ? String(n).padStart(cfg.pad, '0') : String(n));
  const src = (n)=> `${cfg.path}/${cfg.prefix}${pad(n, cfg.pad)}.${cfg.ext}`;
  const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
  const isMobile = ()=> window.innerWidth <= 980;

  // State
  const total = Math.max(1, cfg.totalPages|0);
  let current = clamp(readHash() || readSaved() || (cfg.startPage||1), 1, total);
  let display = (total===1 || (cfg.singlePageOnMobile && isMobile())) ? 'single' : 'double';
  let dragging = null;
  let autoplayId = null;
  let zoomed = false;

  // Init controls
  $pageSlider.max = String(total);
  $pageInput.max = String(total);

  // Build grid (thumbnails)
  (function buildGrid(){
    const frag = document.createDocumentFragment();
    for(let i=1;i<=total;i++){
      const t = document.createElement('div');
      t.className = 'tile'; t.dataset.go = i;
      const im = document.createElement('img');
      im.loading = (i<=12) ? 'eager' : 'lazy';
      im.src = src(i);
      im.onerror = ()=> log(`Grid MISS p${i}: ${im.src}`, false);
      const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = i;
      t.appendChild(im); t.appendChild(tag);
      t.addEventListener('click', ()=>{
        current = i; hideGrid(); build();
      });
      frag.appendChild(t);
    }
    $grid.innerHTML = ''; $grid.appendChild(frag);
  })();

  // Preload neighbors
  function preload(n){ if(n<1||n>total) return; const im=new Image(); im.src=src(n); }
  [current-1,current,current+1,current+2].forEach(preload);

  // Build pages
  function build(){
    $book.innerHTML = '';
    if(display==='single'){
      const wrap = document.createElement('div'); wrap.className='spread';
      const p = mkPage(current, 'single'); p.style.width='100%'; p.style.left='0%'; p.style.border='none';
      wrap.appendChild(p); $book.appendChild(wrap);
    } else {
      const wrap = document.createElement('div'); wrap.className='spread';
      const leftIndex  = current%2===0 ? current : current-1 < 1 ? 1 : current-1;
      const rightIndex = clamp(leftIndex+1,1,total);
      wrap.appendChild(mkPage(leftIndex,  'left'));
      wrap.appendChild(mkPage(rightIndex, 'right'));
      $book.appendChild(wrap);
    }
    applyUI();
    bindHover();
    saveState();
    updateHash();
    [current-2,current-1,current+1,current+2].forEach(preload);
  }

  function mkPage(n, side){
    const d = document.createElement('div');
    d.className = 'page' + (side==='right' ? ' right' : '');
    d.dataset.page = String(n);
    const img = document.createElement('img');
    img.alt = `Page ${n}`; img.decoding='async';
    if(side==='single' || side==='left' || side==='right'){
      img.loading = (Math.abs(n-current)<=2) ? 'eager' : 'lazy';
    }
    img.src = src(n);
    img.onerror = ()=> log(`Image MISS p${n}: ${img.src}`, false);
    d.appendChild(img);
    // Pointer interactions
    d.addEventListener('pointerdown', (e)=>startDrag(e,d));
    d.addEventListener('pointerup', endDrag);
    d.addEventListener('pointerleave', endDrag);
    d.addEventListener('pointermove', onDrag);
    return d;
  }

  // Hover gloss
  function bindHover(){
    $book.querySelectorAll('.page').forEach(p=>{
      p.addEventListener('mouseenter', ()=> p.classList.add('hover'));
      p.addEventListener('mouseleave', ()=> p.classList.remove('hover'));
    });
  }

  // Indicator + slider + progress
  function applyUI(){
    $pageIndicator.textContent = `${current} / ${total}`;
    $pageSlider.value = String(current);
    $pageInput.value = String(current);
    $pageInput.max = String(total);
    const pct = ((current-1)/(total-1||1))*100;
    $progress.style.width = `${pct}%`;
  }

  // Flip anim overlay
  function animateFlip(dir){
    const overlay = document.createElement('div');
    overlay.className = 'page flipping';
    overlay.style.width = (display==='single') ? '100%' : '50%';
    overlay.style.left  = (dir==='prev' ? '0%' : (display==='single' ? '0%' : '50%'));
    overlay.style.transformOrigin = (dir==='prev') ? 'left center' : 'right center';
    overlay.style.background = 'linear-gradient(180deg, #111, #0b0b0b)';
    $book.appendChild(overlay);
    overlay.style.transform = 'rotateY(0.0001deg)'; overlay.getBoundingClientRect();
    overlay.style.transition = 'transform 420ms cubic-bezier(.25,.8,.25,1)';
    overlay.style.transform = `rotateY(${dir==='prev'?90:-90}deg)`;
    setTimeout(()=> overlay.remove(), 440);
  }

  // Flip helpers
  function next(){
    if(display==='single'){ if(current<total){ animateFlip('next'); current++; build(); } }
    else {
      const base = current%2===0 ? current+2 : current+1;
      if(base<=total){ animateFlip('next'); current=base; build(); }
    }
  }
  function prev(){
    if(display==='single'){ if(current>1){ animateFlip('prev'); current--; build(); } }
    else {
      const base = current%2===0 ? current-2 : current-1;
      if(base>=1){ animateFlip('prev'); current=base; build(); }
    }
  }
  function first(){ current = display==='single' ? 1 : 1; build(); }
  function last (){
    current = display==='single' ? total : (total%2===0 ? total-1 : total);
    if(total===1) current=1;
    build();
  }

  // Drag to flip
  function startDrag(e, el){
    dragging = { startX: e.clientX, el }; el.setPointerCapture(e.pointerId); el.classList.add('flipping');
  }
  function onDrag(e){
    if(!dragging) return;
    const dx = e.clientX - dragging.startX;
    const w  = dragging.el.clientWidth;
    const isRight = dragging.el.classList.contains('right') || display==='single';
    let angle = (dx / w) * (isRight ? -90 : 90);
    angle = clamp(angle, -90, 90);
    dragging.el.style.transform = `rotateY(${angle}deg)`;
  }
  function endDrag(){
    if(!dragging) return;
    const el = dragging.el;
    const m = el.style.transform.match(/rotateY\((-?\d+\.?\d*)deg\)/);
    const angle = m ? parseFloat(m[1]) : 0;
    el.classList.remove('flipping');
    el.style.transition = 'transform 220ms ease';
    const commit = Math.abs(angle) > 35;
    if(commit){
      el.style.transform = `rotateY(${angle>0?90:-90}deg)`;
      setTimeout(()=>{ el.style.transition=''; el.style.transform=''; (angle<0)?next():prev(); }, 220);
    } else {
      el.style.transform = 'rotateY(0deg)';
      setTimeout(()=> el.style.transition='', 220);
    }
    dragging = null;
  }

  // Keyboard
  document.addEventListener('keydown', (e)=>{
    if(e.key==='ArrowRight') next();
    if(e.key==='ArrowLeft')  prev();
    if(e.key==='Home')       first();
    if(e.key==='End')        last();
    if(e.key==='g' || e.key==='G') toggleGrid();
    if(e.key==='z' || e.key==='Z') toggleZoom();
    if(e.key==='f' || e.key==='F') toggleFull();
    if(e.key===' ') { e.preventDefault(); toggleAuto(); }
    if(e.key==='Escape' && $gridOverlay.classList.contains('show')) hideGrid();
  });

  // Buttons
  $btnNext.addEventListener('click', next);
  $btnPrev.addEventListener('click', prev);
  $btnFirst.addEventListener('click', first);
  $btnLast.addEventListener('click',  last);
  $btnGrid.addEventListener('click',  toggleGrid);
  $btnZoom.addEventListener('click',  toggleZoom);
  $btnFull.addEventListener('click',  toggleFull);
  $btnPlay.addEventListener('click',  toggleAuto);
  document.getElementById('btnCloseGrid').addEventListener('click', hideGrid);
  $hotkey.addEventListener('click', ()=> alert('Shortcuts:\n\n← / → : Prev / Next\nHome / End : First / Last\nG : Grid overlay\nZ : Zoom\nF : Fullscreen\nSpace : Auto-flip on/off'));

  // Slider + input
  $pageSlider.addEventListener('input', (e)=> {
    current = clamp(parseInt(e.target.value,10)||1,1,total);
    build();
  });
  $pageInput.addEventListener('change', (e)=>{
    current = clamp(parseInt(e.target.value,10)||1,1,total);
    build();
  });

  // Zoom
  function toggleZoom(){
    zoomed = !zoomed;
    document.body.classList.toggle('zoomed', zoomed);
  }
  $bookWrap.addEventListener('wheel', (e)=>{
    if(e.ctrlKey){
      e.preventDefault();
      zoomed = e.deltaY < 0 ? true : false;
      document.body.classList.toggle('zoomed', zoomed);
    }
  }, { passive:false });

  // Fullscreen
  function toggleFull(){
    if(!document.fullscreenElement) $bookWrap.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // Auto flip
  function toggleAuto(){
    if(autoplayId){ clearInterval(autoplayId); autoplayId=null; $btnPlay.textContent='►'; return; }
    $btnPlay.textContent='❚❚';
    autoplayId = setInterval(()=>{
      if(display==='single' && current>=total) { toggleAuto(); return; }
      if(display!=='single' && (current>=total || (current%2===0 && current+2>total))) { toggleAuto(); return; }
      next();
    }, cfg.autoplayMs || 2500);
  }

  // Grid
  function toggleGrid(){ $gridOverlay.classList.toggle('show'); }
  function hideGrid(){ $gridOverlay.classList.remove('show'); }

  // Hash + resume
  function readHash(){ const m=location.hash.match(/page=(\d+)/); return m?parseInt(m[1],10):null; }
  function updateHash(){ try{ const u=new URL(location.href); u.hash=`page=${current}`; history.replaceState(null,'',u); }catch{} }
  function saveState(){ try{ localStorage.setItem('flip.last', String(current)); }catch{} }
  function readSaved(){ try{ const v=localStorage.getItem('flip.last'); return v?parseInt(v,10):null; }catch{ return null; } }

  // Resize: switch single/double automatically
  let rid=null;
  window.addEventListener('resize', ()=>{
    clearTimeout(rid);
    rid=setTimeout(()=>{
      const nd = (total===1 || (cfg.singlePageOnMobile && isMobile())) ? 'single' : 'double';
      if(nd!==display){ display=nd; build(); }
    }, 120);
  });

  // Boot
  log(`Location: ${location.href}`, true);
  log(`totalPages: ${total}`, true);
  log(`first image: ${src(1)}`, true);

  // Initialize slider min/max + starting values
  $pageSlider.min = '1'; $pageSlider.max = String(total); $pageSlider.value = String(current);
  $pageInput.min  = '1'; $pageInput.max  = String(total); $pageInput.value  = String(current);

  build();
})();
