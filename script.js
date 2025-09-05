(function(){
  const cfg = window.MAG_CONFIG || {};
  const $book = document.getElementById('book');
  const $bookWrap = document.getElementById('bookWrap');
  const $stage = document.getElementById('stage');
  const $pageIndicator = document.getElementById('pageIndicator');
  const $pageSlider = document.getElementById('pageSlider');
  const $pageInput  = document.getElementById('pageInput');

  const $btnFirst = document.getElementById('btnFirst');
  const $btnPrev  = document.getElementById('btnPrev');
  const $btnNext  = document.getElementById('btnNext');
  const $btnLast  = document.getElementById('btnLast');

  const $btnGrid  = document.getElementById('btnGrid');
  const $gridOverlay = document.getElementById('gridOverlay');
  const $grid = document.getElementById('grid');
  const $btnCloseGrid = document.getElementById('btnCloseGrid');

  const $btnZoom  = document.getElementById('btnZoom');
  const $btnFull  = document.getElementById('btnFull');
  const $btnPlay  = document.getElementById('btnPlay');

  const $edgeLeft = document.getElementById('edgeLeft');
  const $edgeRight= document.getElementById('edgeRight');

  const $hotkey   = document.getElementById('hotkey');
  const $progress = document.getElementById('progress');

  const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
  const pad   = (n, size)=> (cfg.pad ? String(n).padStart(cfg.pad, '0') : String(n));
  const src   = (n)=> `${cfg.path}/${cfg.prefix}${pad(n, cfg.pad)}.${cfg.ext}`;
  const isMobile = ()=> window.innerWidth <= 980;

  const total = Math.max(1, cfg.totalPages|0);
  let current = clamp(readHash() || readSaved() || (cfg.startPage||1), 1, total);
  let display = computeDisplayMode();
  let dragging = null;
  let autoplayId = null;
  let zoomed = false;

  // Build grid
  (function buildGrid(){
    const frag = document.createDocumentFragment();
    for(let i=1;i<=total;i++){
      const t = document.createElement('div');
      t.className = 'tile'; t.dataset.go = i;
      const im = document.createElement('img');
      im.loading = (i<=12) ? 'eager' : 'lazy';
      im.src = src(i);
      const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = i;
      t.appendChild(im); t.appendChild(tag);
      t.addEventListener('click', ()=>{ current = i; hideGrid(); build(); });
      frag.appendChild(t);
    }
    $grid.innerHTML = ''; $grid.appendChild(frag);
  })();

  // Slider bounds
  $pageSlider.min = '1'; $pageSlider.max = String(total); $pageSlider.value = String(current);
  $pageInput.min  = '1'; $pageInput.max  = String(total); $pageInput.value  = String(current);

  // ---- Rendering ----

  function computeDisplayMode(){
    return (total===1 || (cfg.singlePageOnMobile && isMobile())) ? 'single' : 'double';
  }

  function getSpreadFor(page){
    if(display==='single') return { type:'single', left:null, right: clamp(page,1,total) };
    if(page<=1) return { type:'cover', left:null, right:1 };
    if(page%2===0){
      const left = page, right = clamp(page+1,1,total);
      return { type:'spread', left, right };
    } else {
      const left = clamp(page-1,1,total), right = page;
      return { type:'spread', left, right };
    }
  }

  function build(){
    $book.innerHTML = '';
    display = computeDisplayMode();

    const s = getSpreadFor(current);
    const wrap = document.createElement('div'); wrap.className='spread';

    if(s.type==='single' || s.type==='cover'){
      wrap.appendChild(mkPage(s.right, 'single'));
    } else {
      wrap.appendChild(mkPage(s.left,  'left'));
      wrap.appendChild(mkPage(s.right, 'right'));
    }

    $book.appendChild(wrap);
    applyUI();
    bindHover();
    saveState();
    updateHash();
    preloadNeighbors();

    // Fit to viewport AFTER images load (so we know their natural sizes)
    fitBookToViewport();
  }

  function mkPage(n, side){
    const d = document.createElement('div');
    d.className = 'page' + (side==='right' ? ' right' : '') + (side==='single' ? ' single' : '');
    d.dataset.page = String(n);

    const img = document.createElement('img');
    img.alt = `Page ${n}`; img.decoding='async';
    img.loading = (Math.abs(n-current)<=2) ? 'eager' : 'lazy';
    img.src = src(n);
    d.appendChild(img);

    // If an image loads later (cache miss), refit the book
    const refit = ()=> fitBookToViewport();
    img.addEventListener('load', refit, { once:true });

    // interactions for drag flip
    d.addEventListener('pointerdown', (e)=>startDrag(e,d,side));
    d.addEventListener('pointerup', endDrag);
    d.addEventListener('pointerleave', endDrag);
    d.addEventListener('pointermove', onDrag);

    return d;
  }

  function bindHover(){
    $book.querySelectorAll('.page').forEach(p=>{
      p.addEventListener('mouseenter', ()=> p.classList.add('hover'));
      p.addEventListener('mouseleave', ()=> p.classList.remove('hover'));
    });
  }

  function preloadNeighbors(){
    [current-2,current-1,current+1,current+2].forEach(n=>{
      if(n>=1 && n<=total){ const im=new Image(); im.src=src(n); }
    });
  }

  // === FIT LOGIC (no scrolling) ===
  function fitBookToViewport(){
    // Available area = stage middle row (the big central grid cell)
    const gridMiddle = $bookWrap.parentElement; // #stage's middle cell
    const availW = gridMiddle.clientWidth;
    const availH = gridMiddle.clientHeight;

    // Measure images currently shown
    const pages = [...$book.querySelectorAll('.page img')];
    if(pages.length === 0){ return; }

    // Compute spread natural size
    let natW, natH;
    if(display === 'single' || pages.length === 1){
      const img = pages[0];
      natW = img.naturalWidth || img.width || 800;
      natH = img.naturalHeight || img.height || 600;
    } else {
      // Double spread: width = sum of both; height = max of both
      const L = pages[0], R = pages[1];
      const lw = L.naturalWidth || L.width || 800;
      const lh = L.naturalHeight || L.height || 600;
      const rw = R.naturalWidth || R.width || 800;
      const rh = R.naturalHeight || R.height || 600;
      natW = lw + rw;
      natH = Math.max(lh, rh);
    }

    // Scale to fit both width AND height (and never upscale)
    const scale = Math.min(1, availW / natW, availH / natH);
    const fitW = Math.floor(natW * scale);
    const fitH = Math.floor(natH * scale);

    // Apply exact size to wrapper; the internal pages use % of this box
    $bookWrap.style.width  = fitW + 'px';
    $bookWrap.style.height = fitH + 'px';
  }

  // ---- UI & controls ----
  function applyUI(){
    $pageIndicator.textContent = `${current} / ${total}`;
    $pageSlider.value = String(current);
    $pageInput.value  = String(current);
    const pct = ((current-1)/(total-1 || 1))*100;
    $progress.style.width = `${pct}%`;
  }

  function first(){ current = 1; build(); }
  function last (){
    if(display==='single'){ current = total; }
    else { current = (total===1) ? 1 : (total%2===0 ? total-1 : total-1); }
    build();
  }

  function next(){
    if(display==='single'){
      if(current < total){ animateFlip('next'); current++; build(); }
      return;
    }
    if(current === 1){ animateFlip('next'); current = Math.min(2, total); build(); return; }
    const base = (current%2===0) ? current+2 : current+1;
    if(base <= total){ animateFlip('next'); current = base; build(); }
  }

  function prev(){
    if(display==='single'){
      if(current > 1){ animateFlip('prev'); current--; build(); }
      return;
    }
    if(current === 1) return;
    const base = (current%2===0) ? current-2 : current-1;
    current = Math.max(1, base);
    animateFlip('prev'); build();
  }

  // Flip animation
  function animateFlip(dir){
    const overlay = document.createElement('div');
    overlay.className = 'page flipping';
    const singleLike = (display==='single' || current===1);
    overlay.style.width = singleLike ? '100%' : '50%';
    overlay.style.left  = (dir==='prev') ? '0%' : (singleLike ? '0%' : '50%');
    overlay.style.transformOrigin = (dir==='prev') ? 'left center' : 'right center';
    overlay.style.background = 'linear-gradient(180deg, #111, #0b0b0b)';
    $book.appendChild(overlay);
    overlay.style.transform = 'rotateY(0.0001deg)'; overlay.getBoundingClientRect();
    overlay.style.transition = 'transform 420ms cubic-bezier(.25,.8,.25,1)';
    overlay.style.transform = `rotateY(${dir==='prev'?90:-90}deg)`;
    setTimeout(()=> overlay.remove(), 440);
  }

  // Drag-to-flip
  function startDrag(e, el, side){
    dragging = { startX: e.clientX, el, side };
    el.setPointerCapture(e.pointerId);
    el.classList.add('flipping');
  }
  function onDrag(e){
    if(!dragging) return;
    const dx = e.clientX - dragging.startX;
    const w  = dragging.el.clientWidth;
    const isRight = (dragging.side==='right' || dragging.side==='single');
    let angle = (dx / w) * (isRight ? -90 : 90);
    angle = Math.max(-90, Math.min(90, angle));
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

  // Buttons / keys / edges
  $btnFirst.addEventListener('click', first);
  $btnLast .addEventListener('click', last);
  $btnNext .addEventListener('click', next);
  $btnPrev .addEventListener('click', prev);

  $edgeLeft .addEventListener('click', prev);
  $edgeRight.addEventListener('click', next);

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

  // Slider / input
  $pageSlider.addEventListener('input', (e)=>{
    current = clamp(parseInt(e.target.value,10)||1,1,total);
    build();
  });
  $pageInput.addEventListener('change', (e)=>{
    current = clamp(parseInt(e.target.value,10)||1,1,total);
    build();
  });

  // Grid overlay
  function toggleGrid(){ $gridOverlay.classList.toggle('show'); }
  function hideGrid(){ $gridOverlay.classList.remove('show'); }
  $btnGrid.addEventListener('click', toggleGrid);
  $btnCloseGrid.addEventListener('click', hideGrid);

  // Zoom / Fullscreen / Auto
  function toggleZoom(){ zoomed = !zoomed; document.body.classList.toggle('zoomed', zoomed); }
  $btnZoom.addEventListener('click', toggleZoom);
  $bookWrap.addEventListener('wheel', (e)=>{
    if(e.ctrlKey){ e.preventDefault(); zoomed = e.deltaY < 0 ? true : false; document.body.classList.toggle('zoomed', zoomed); }
  }, { passive:false });

  function toggleFull(){ if(!document.fullscreenElement) $bookWrap.requestFullscreen?.(); else document.exitFullscreen?.(); }
  $btnFull.addEventListener('click', toggleFull);

  function toggleAuto(){
    if(autoplayId){ clearInterval(autoplayId); autoplayId=null; $btnPlay.textContent='►'; return; }
    $btnPlay.textContent='❚❚';
    autoplayId = setInterval(()=>{
      if(display==='single' && current>=total){ toggleAuto(); return; }
      if(display!=='single' && (current>=total || (current%2===0 && current+2>total))){ toggleAuto(); return; }
      next();
    }, cfg.autoplayMs || 2500);
  }
  $btnPlay.addEventListener('click', toggleAuto);

  // Hash + resume
  function readHash(){ const m=location.hash.match(/page=(\d+)/); return m?parseInt(m[1],10):null; }
  function updateHash(){ try{ const u=new URL(location.href); u.hash=`page=${current}`; history.replaceState(null,'',u); }catch{} }
  function saveState(){ try{ localStorage.setItem('flip.last', String(current)); }catch{} }
  function readSaved(){ try{ const v=localStorage.getItem('flip.last'); return v?parseInt(v,10):null; }catch{ return null; } }

  // Resize: recompute mode, rebuild, and refit strictly to viewport
  let rid=null;
  window.addEventListener('resize', ()=>{
    clearTimeout(rid);
    rid=setTimeout(()=>{
      const nd = computeDisplayMode();
      if(nd!==display){ display=nd; build(); }
      else fitBookToViewport();  // refit even if mode didn’t change
    }, 60);
  });

  // Boot
  build();
})();
