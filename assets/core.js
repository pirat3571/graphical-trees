/* Общий движок: парсинг, раскладка и рисование деревьев, пошаговый плеер. */
(function(){
  'use strict';
  const TS = window.TreeSite = {};

  TS.$ = id => document.getElementById(id);
  TS.esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  TS.fmtBal = b => b > 0 ? '+' + b : b < 0 ? '−' + (-b) : '0';

  TS.height = function height(n){
    return n ? 1 + Math.max(height(n.l), height(n.r)) : 0;
  };
  TS.balance = function balance(n){
    return n ? TS.height(n.r) - TS.height(n.l) : 0;
  };
  TS.clone = function clone(n){
    if(!n) return null;
    const c = {id:n.id, d:n.d, l:TS.clone(n.l), r:TS.clone(n.r)};
    if(n.b !== undefined) c.b = n.b;
    return c;
  };
  TS.cloneB = function cloneB(n){
    if(!n) return null;
    return {id:n.id, keys:n.keys.slice(), ch:n.ch.map(TS.cloneB)};
  };
  TS.parseKeys = function(raw, max){
    max = max || 24;
    const chars = [...String(raw)].filter(c => !/[\s,;]/.test(c));
    const seen = new Set(), keys = [];
    let dups = 0;
    for(const c of chars){
      if(seen.has(c)){ dups++; continue; }
      seen.add(c);
      keys.push(c);
      if(keys.length >= max) break;
    }
    return {keys, dups, total:chars.length};
  };
  TS.mkGen = function(){
    let i = 0;
    return d => ({id:++i, d, l:null, r:null});
  };
  TS.weightedCost = function(root, weights){
    let cost = 0;
    (function walk(n, d){
      if(!n) return;
      cost += (weights[n.d] || 0) * (d + 1);
      walk(n.l, d + 1); walk(n.r, d + 1);
    })(root, 0);
    return cost;
  };
  TS.avgDepth = function(root){
    let sum = 0, count = 0;
    (function walk(n, d){
      if(!n) return;
      sum += d; count++;
      walk(n.l, d + 1); walk(n.r, d + 1);
    })(root, 0);
    return count ? sum / count : 0;
  };

  /* ---------- Раскладка двоичного дерева ---------- */
  TS.layoutBinary = function(root, gap, lvl){
    gap = gap || 52; lvl = lvl || 76;
    let x = 0, depth = 0;
    const pos = {};
    (function walk(n, d){
      if(!n) return;
      walk(n.l, d + 1);
      pos[n.id] = {x:x++, d};
      if(d > depth) depth = d;
      walk(n.r, d + 1);
    })(root, 0);
    return {pos, count:x, depth, gap, lvl};
  };

  /* ---------- Рисование двоичного дерева ---------- */
  TS.renderBinary = function(el, snap, opts){
    opts = opts || {};
    const t = snap.tree;
    if(!t){ el.innerHTML = '<div class="empty">Дерево пусто</div>'; return; }
    const gap = opts.gap || 52, lvl = opts.level || 76, R = 19;
    const L = TS.layoutBinary(t, gap, lvl);
    const innerW = (L.count - 1) * gap;
    const W = Math.max(innerW + 70, 300);
    const H = L.depth * lvl + 78;
    const ox = (W - innerW) / 2;
    const X = id => ox + L.pos[id].x * gap;
    const Y = id => 28 + L.pos[id].d * lvl;

    const bad = new Set(Array.isArray(snap.bad) ? snap.bad : (snap.bad !== undefined && snap.bad !== null ? [snap.bad] : []));
    const tags = snap.tags || {};
    const path = new Set(snap.path || []);
    const showBal = opts.showBal !== undefined ? opts.showBal : !!snap.showBal;
    const weightMap = opts.weightMap || null;
    let edges = '', nodes = '';

    (function walk(n){
      if(!n) return;
      [n.l, n.r].forEach(c => {
        if(c) edges += `<line x1="${X(n.id)}" y1="${Y(n.id)}" x2="${X(c.id)}" y2="${Y(c.id)}" stroke="var(--mut)" stroke-width="1.4" opacity=".75"/>`;
        walk(c);
      });
    })(t);

    (function walk(n){
      if(!n) return;
      walk(n.l); walk(n.r);
      const cx = X(n.id), cy = Y(n.id);
      let fill = 'var(--node)', stroke = 'var(--bd)', sw = 1.5, col = 'var(--tx)';
      if(bad.has(n.id)){ fill = 'var(--bad)'; stroke = 'var(--bad)'; col = '#fff'; }
      else if(n.id === snap.newId){ fill = 'var(--ok)'; stroke = 'var(--ok)'; col = '#fff'; }
      if(path.has(n.id)){ stroke = 'var(--ac)'; sw = 3; }
      if(tags[n.id]){ stroke = 'var(--ac)'; sw = 3.5; }
      nodes += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      nodes += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="16" font-weight="600" fill="${col}">${TS.esc(n.d)}</text>`;
      let sub = null, subCol = 'var(--mut)';
      if(weightMap && weightMap[n.d] !== undefined) sub = 'w=' + weightMap[n.d];
      else if(showBal){
        const b = TS.balance(n);
        sub = 'bal ' + TS.fmtBal(b);
        if(Math.abs(b) > 1) subCol = 'var(--bad)';
      }
      if(sub !== null) nodes += `<text x="${cx}" y="${cy + 35}" text-anchor="middle" font-size="12" fill="${subCol}">${TS.esc(sub)}</text>`;
      if(tags[n.id]) nodes += `<text x="${cx - 25}" y="${cy - 13}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ac)">${TS.esc(tags[n.id])}</text>`;
    })(t);

    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${edges}${nodes}</svg>`;
  };

  /* ---------- Полоска ключей ---------- */
  TS.strip = function(items, o){
    o = o || {};
    const lo = o.lo === undefined ? -1 : o.lo;
    const hi = o.hi === undefined ? -1 : o.hi;
    const mid = o.mid === undefined ? -1 : o.mid;
    const done = o.done ? new Set(o.done) : null;
    let h = '<div class="strip' + (o.cls ? ' ' + o.cls : '') + '">';
    items.forEach((it, i) => {
      const key = (it && typeof it === 'object') ? it.k : it;
      const sub = (it && typeof it === 'object') ? it.w : (o.index ? i : null);
      let cls = 'chip';
      if(lo >= 0 && (i < lo || i > hi)) cls += ' off';
      if(i === mid) cls += ' mid';
      if(done && done.has(i)) cls += ' done';
      h += `<span class="${cls}"><b>${TS.esc(key)}</b>${sub !== null && sub !== undefined ? `<i>${TS.esc(sub)}</i>` : ''}</span>`;
    });
    return h + '</div>';
  };

  /* ---------- B-дерево ---------- */
  TS.layoutBTree = function(root, cellW){
    cellW = cellW || 42;
    function measure(n){
      const w = Math.max(n.keys.length * cellW + 16, 54);
      let sum = 0;
      n.ch.forEach((c, i) => { measure(c); sum += c._sub + (i ? 14 : 0); });
      n._w = w;
      n._sub = Math.max(w, sum);
      return n._sub;
    }
    measure(root);
    let maxDepth = 0;
    function place(n, left, depth){
      n._cx = left + n._sub / 2;
      n._d = depth;
      if(depth > maxDepth) maxDepth = depth;
      let sum = 0;
      n.ch.forEach((c, i) => { sum += c._sub + (i ? 14 : 0); });
      let cx = left + (n._sub - sum) / 2;
      n.ch.forEach((c, i) => { place(c, cx, depth + 1); cx += c._sub + (i ? 14 : 0); });
    }
    place(root, 0, 0);
    return {maxDepth, width:root._sub};
  };

  TS.renderBTree = function(el, snap){
    const t = snap.tree;
    if(!t){ el.innerHTML = '<div class="empty">Дерево пусто</div>'; return; }
    const CELL = 42, PAD = 8, NH = 42, LEVEL = 86;
    const L = TS.layoutBTree(t, CELL);
    const W = Math.max(L.width + 44, 320);
    const H = L.maxDepth * LEVEL + 76;
    const ox = (W - L.width) / 2;
    const nodesHl = new Set(snap.nodes || []);
    const bad = new Set(snap.bad || []);
    let edges = '', nodes = '';

    (function walk(n){
      const w = n.keys.length * CELL + PAD * 2;
      const x = n._cx + ox, y = 22 + n._d * LEVEL;
      n.ch.forEach((c, i) => {
        const cw = c.keys.length * CELL + PAD * 2;
        const cx = c._cx + ox, cy = 22 + c._d * LEVEL;
        const x1 = x - w / 2 + PAD + i * CELL;
        edges += `<line x1="${x1}" y1="${y + NH}" x2="${cx}" y2="${cy}" stroke="var(--mut)" stroke-width="1.4" opacity=".75"/>`;
        walk(c);
      });
    })(t);

    (function walk(n){
      const w = n.keys.length * CELL + PAD * 2;
      const x = n._cx + ox, y = 22 + n._d * LEVEL;
      const isBad = bad.has(n.id), isHl = nodesHl.has(n.id);
      nodes += `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${NH}" rx="8" fill="${isBad ? 'var(--bad)' : 'var(--node)'}" stroke="${isBad ? 'var(--bad)' : isHl ? 'var(--ac)' : 'var(--bd)'}" stroke-width="${isBad || isHl ? 3 : 1.3}"/>`;
      n.keys.forEach((k, j) => {
        const cellX = x - w / 2 + PAD + j * CELL;
        const keyHl = n.id === snap.hiNode && k === snap.hiKey;
        if(keyHl) nodes += `<rect x="${cellX}" y="${y + 3}" width="${CELL}" height="${NH - 6}" rx="6" fill="var(--ok)"/>`;
        nodes += `<text x="${cellX + CELL / 2}" y="${y + NH / 2 + 5}" text-anchor="middle" font-size="15" font-weight="600" fill="${keyHl || isBad ? '#fff' : 'var(--tx)'}">${TS.esc(k)}</text>`;
        if(j < n.keys.length - 1) nodes += `<line x1="${cellX + CELL}" y1="${y + 8}" x2="${cellX + CELL}" y2="${y + NH - 8}" stroke="var(--bd)" stroke-width="1"/>`;
      });
      n.ch.forEach(walk);
    })(t);

    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${edges}${nodes}</svg>`;
  };

  /* ---------- Таблица динамического программирования ---------- */
  TS.renderDPTable = function(el, o){
    const keys = o.keys, C = o.C, R = o.R, n = o.n;
    let h = '<div class="table-wrap"><table class="dp"><thead><tr><th>i\\j</th>';
    for(let j = 0; j < n; j++) h += `<th>${j}</th>`;
    h += '</tr></thead><tbody>';
    for(let i = 0; i < n; i++){
      h += `<tr><th>${i}</th>`;
      for(let j = 0; j < n; j++){
        if(i <= j){
          const v = C[i][j];
          const cur = o.cur && o.cur[0] === i && o.cur[1] === j;
          const cls = cur ? ' class="cur"' : (v !== null && v !== undefined ? ' class="done"' : '');
          h += `<td${cls}>${v !== null && v !== undefined ? `<b>${v}</b><i>${TS.esc(keys[R[i][j]])}</i>` : ''}</td>`;
        } else {
          h += '<td class="na">·</td>';
        }
      }
      h += '</tr>';
    }
    h += '</tbody></table></div>';
    el.innerHTML = h;
  };

  /* ---------- Пошаговый плеер ---------- */
  TS.mountPlayer = function(mount, opts){
    opts = opts || {};
    mount.innerHTML = `
      <div class="card stage">
        <div class="row controls">
          <button type="button" data-act="rs" title="В начало" aria-label="В начало">⏮</button>
          <button type="button" data-act="pv">← Назад</button>
          <button type="button" data-act="nx" class="p">Дальше →</button>
          <button type="button" data-act="pl">▶ Авто</button>
          <span class="counter meta"></span>
        </div>
        <input type="range" class="scrub" min="0" max="0" value="0" step="1" aria-label="Номер шага">
        <div class="canvas"></div>
        ${opts.legend ? `<div class="legend">${opts.legend}</div>` : ''}
      </div>
      <div class="card explain">
        <div class="step-title" aria-live="polite"></div>
        <div class="step-text"></div>
      </div>`;
    const q = sel => mount.querySelector(sel);
    const canvas = q('.canvas'), title = q('.step-title'), text = q('.step-text');
    const counter = q('.counter'), range = q('.scrub');
    const bRs = q('[data-act="rs"]'), bPv = q('[data-act="pv"]'), bNx = q('[data-act="nx"]'), bPl = q('[data-act="pl"]');
    let steps = [], cur = 0, timer = null;

    const api = {
      setSteps(s){ steps = s || []; cur = 0; stop(); draw(); },
      go, reset(){ go(0); },
      redraw: draw,
      stop,
      get index(){ return cur; },
      get total(){ return steps.length; },
      get step(){ return steps[cur]; }
    };

    function stop(){
      if(timer){ clearInterval(timer); timer = null; }
      bPl.textContent = '▶ Авто';
    }
    function go(n){
      cur = Math.max(0, Math.min(steps.length - 1, n));
      draw();
    }
    function draw(){
      if(!steps.length){ canvas.innerHTML = ''; title.textContent = ''; text.textContent = ''; counter.textContent = ''; return; }
      cur = Math.max(0, Math.min(cur, steps.length - 1));
      const s = steps[cur];
      title.innerHTML = s.title || '';
      text.innerHTML = s.text || '';
      counter.textContent = `Шаг ${cur + 1} / ${steps.length}`;
      range.max = String(Math.max(0, steps.length - 1));
      range.value = String(cur);
      bRs.disabled = bPv.disabled = cur === 0;
      bNx.disabled = cur === steps.length - 1;
      bRs.disabled = bPv.disabled = cur === 0;
      canvas.innerHTML = '';
      if(opts.render) opts.render(canvas, s, api);
      if(opts.onStep) opts.onStep(s, api);
      requestAnimationFrame(() => {
        const extra = canvas.scrollWidth - canvas.clientWidth;
        if(extra > 8) canvas.scrollLeft = extra / 2;
      });
    }

    bRs.onclick = () => { stop(); go(0); };
    bPv.onclick = () => { stop(); go(cur - 1); };
    bNx.onclick = () => { stop(); go(cur + 1); };
    range.oninput = () => { stop(); go(+range.value); };
    bPl.onclick = () => {
      if(timer){ stop(); return; }
      if(cur >= steps.length - 1) cur = 0;
      bPl.textContent = '⏸ Пауза';
      draw();
      timer = setInterval(() => {
        if(cur >= steps.length - 1){ stop(); return; }
        go(cur + 1);
      }, opts.autoplay || 1700);
    };
    document.addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(tag)) return;
      if(e.key === 'ArrowRight'){ stop(); go(cur + 1); }
      if(e.key === 'ArrowLeft'){ stop(); go(cur - 1); }
    });
    return api;
  };

  /* ---------- Тема ---------- */
  TS.initTheme = function(){
    const root = document.documentElement;
    const btn = document.getElementById('themeBtn');
    const ORDER = ['light', 'dark', 'amoled'];
    const ICONS = {
      light:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
      dark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
      amoled:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/></svg>'
    };
    function current(){
      if(root.dataset.theme) return root.dataset.theme;
      return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function paint(){
      if(!btn) return;
      const th = current();
      btn.innerHTML = ICONS[th];
      btn.title = th === 'light' ? 'Тёмная тема' : th === 'dark' ? 'AMOLED-тема' : 'Светлая тема';
    }
    try{
      const saved = localStorage.getItem('tree-theme');
      if(ORDER.indexOf(saved) >= 0) root.dataset.theme = saved;
    }catch(e){}
    paint();
    if(btn) btn.addEventListener('click', () => {
      root.dataset.theme = ORDER[(ORDER.indexOf(current()) + 1) % ORDER.length];
      try{ localStorage.setItem('tree-theme', root.dataset.theme); }catch(e){}
      paint();
    });
  };
  TS.initTheme();

  /* ---------- Позиция курсора для подсветки краёв стекла ---------- */
  TS.initGlassCursor = function(){
    const s = document.documentElement.style;
    s.setProperty('--gx', '-500px');
    s.setProperty('--gy', '-500px');
    window.addEventListener('pointermove', e => {
      s.setProperty('--gx', e.clientX + 'px');
      s.setProperty('--gy', e.clientY + 'px');
    }, {passive:true});
  };
  TS.initGlassCursor();

  /* ---------- Общая отрисовка шага с полоской ---------- */
  TS.drawBinaryStep = function(canvas, step, opts){
    canvas.classList.toggle('compact', !step.tree);
    canvas.innerHTML = (step.strip || '') + '<div class="tree-host"></div>';
    TS.renderBinary(canvas.querySelector('.tree-host'), step, opts);
  };

  /* ---------- Liquid glass: SVG-фильтр преломления под размер каждого hero ---------- */
  TS.initLiquidGlass = function(){
    function mapDataUrl(w, h){
      const RAD = Math.max(24, Math.round(Math.min(w, h) * .3));
      const RING = Math.max(26, Math.round(Math.min(w, h) * .22));
      const rr = (x, a, b, ww, hh, r) => {
        x.beginPath();
        if(x.roundRect){ x.roundRect(a, b, ww, hh, r); return; }
        x.rect(a, b, ww, hh);
      };
      /* карта смещения: центр нейтрален, у краёв градиенты (красный — X, зелёный — Y) */
      const grad = document.createElement('canvas');
      grad.width = w; grad.height = h;
      const g = grad.getContext('2d');
      const gx = g.createLinearGradient(0, 0, w, 0);
      gx.addColorStop(0, '#000'); gx.addColorStop(1, '#f00');
      g.fillStyle = gx; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'screen';
      const gy = g.createLinearGradient(0, 0, 0, h);
      gy.addColorStop(0, '#000'); gy.addColorStop(1, '#0f0');
      g.fillStyle = gy; g.fillRect(0, 0, w, h);
      const mask = document.createElement('canvas');
      mask.width = w; mask.height = h;
      const m = mask.getContext('2d');
      m.filter = 'blur(' + Math.round(RING * .6) + 'px)';
      m.fillStyle = '#fff';
      rr(m, 0, 0, w, h, RAD); m.fill();
      m.globalCompositeOperation = 'destination-out';
      m.filter = 'blur(' + Math.round(RING * .45) + 'px)';
      rr(m, RING, RING, w - 2 * RING, h - 2 * RING, Math.max(0, RAD - RING)); m.fill();
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(mask, 0, 0);
      const base = document.createElement('canvas');
      base.width = w; base.height = h;
      const bx = base.getContext('2d');
      bx.fillStyle = 'rgb(128,128,128)';
      bx.fillRect(0, 0, w, h);
      bx.drawImage(grad, 0, 0);
      return base.toDataURL();
    }

    let host = null;
    function build(){
      try{
        if(host) host.remove();
        const NS = 'http://www.w3.org/2000/svg';
        host = document.createElementNS(NS, 'svg');
        host.setAttribute('width', '0');
        host.setAttribute('height', '0');
        host.style.position = 'absolute';
        document.querySelectorAll('.hero').forEach((el, k) => {
          const w = Math.max(60, Math.round(el.offsetWidth));
          const h = Math.max(60, Math.round(el.offsetHeight));
          const filter = document.createElementNS(NS, 'filter');
          const id = 'lgFilter' + k;
          filter.setAttribute('id', id);
          filter.setAttribute('filterUnits', 'userSpaceOnUse');
          filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
          filter.setAttribute('x', '0');
          filter.setAttribute('y', '0');
          filter.setAttribute('width', w);
          filter.setAttribute('height', h);
          const url = mapDataUrl(w, h);
          const feImage = document.createElementNS(NS, 'feImage');
          feImage.setAttribute('href', url);
          feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
          feImage.setAttribute('x', '0');
          feImage.setAttribute('y', '0');
          feImage.setAttribute('width', w);
          feImage.setAttribute('height', h);
          feImage.setAttribute('preserveAspectRatio', 'none');
          feImage.setAttribute('result', 'map');
          const feDisp = document.createElementNS(NS, 'feDisplacementMap');
          feDisp.setAttribute('in', 'SourceGraphic');
          feDisp.setAttribute('in2', 'map');
          feDisp.setAttribute('scale', '48');
          feDisp.setAttribute('xChannelSelector', 'R');
          feDisp.setAttribute('yChannelSelector', 'G');
          filter.appendChild(feImage);
          filter.appendChild(feDisp);
          host.appendChild(filter);
          const bf = 'blur(3px) saturate(170%) url(#' + id + ')';
          el.style.backdropFilter = bf;
          el.style.webkitBackdropFilter = bf;
        });
        document.body.appendChild(host);
      }catch(e){}
    }
    build();
    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(build, 250);
    });
  };
  TS.initLiquidGlass();

  /* ---------- Динамический фон из частиц ---------- */
  TS.initParticles = function(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'particleBg';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    let W = 0, H = 0, palette = [];
    function readPalette(){
      if(document.documentElement.dataset.theme === 'amoled'){
        palette = ['#ffffff', '#ffffff', '#ffffff', '#ffffff'];
        return;
      }
      const cs = getComputedStyle(document.documentElement);
      palette = ['--ac', '--ok', '--vio', '--warn'].map(v => cs.getPropertyValue(v).trim());
    }
    function resize(){
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    readPalette();
    resize();
    window.addEventListener('resize', resize);
    new MutationObserver(readPalette).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
    try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readPalette); }catch(e){}

    const COUNT = Math.max(36, Math.min(110, Math.round(W * H / 16000)));
    const parts = [];
    for(let i = 0; i < COUNT; i++){
      parts.push({
        x:Math.random() * W, y:Math.random() * H,
        vx:(Math.random() - .5) * .4, vy:(Math.random() - .5) * .4,
        r:1.3 + Math.random() * 1.9,
        ci:(Math.random() * 4) | 0,
        a:.16 + Math.random() * .3,
        k:.8 + Math.random() * .5,
        in:false
      });
    }

    let mx = -1e4, my = -1e4;
    window.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, {passive:true});
    document.documentElement.addEventListener('mouseleave', () => { mx = -1e4; my = -1e4; });

    /* Магнитное поле: внутри радиуса — пружина к центру курсора с демпфированием
       и лёгким броуновским дрожанием. При выходе из поля частица получает
       дополнительный случайный импульс, который затухает за 1–2 секунды. */
    const MAGNET = 80, K = .014, DAMP = .085, WANDER = .03, DRAG = .968, MAXV = 18, JITTER = .04, BOOST = 2.5;

    let last = performance.now();
    function frame(t){
      const dt = Math.min(2.5, Math.max(.2, (t - last) / 16.667));
      last = t;

      ctx.clearRect(0, 0, W, H);
      for(const p of parts){
        const dx = mx - p.x, dy = my - p.y;
        const d2 = dx * dx + dy * dy;
        const inField = d2 < MAGNET * MAGNET;
        let dmp;
        if(inField){
          p.vx += dx * K * p.k * dt + (Math.random() - .5) * JITTER * dt;
          p.vy += dy * K * p.k * dt + (Math.random() - .5) * JITTER * dt;
          dmp = Math.pow(1 - DAMP, dt);
        } else {
          if(p.in){
            /* отпускание: дополнительный рывок в случайную сторону —
               вперёд частицу несёт скорость, набранная при погоне за курсором */
            const ang = Math.random() * Math.PI * 2;
            const imp = BOOST + Math.random() * 3;
            p.vx += Math.cos(ang) * imp;
            p.vy += Math.sin(ang) * imp;
          }
          p.vx += (Math.random() - .5) * WANDER * dt;
          p.vy += (Math.random() - .5) * WANDER * dt;
          dmp = Math.pow(DRAG, dt);
        }
        p.in = inField;
        p.vx *= dmp; p.vy *= dmp;
        const sp = Math.hypot(p.vx, p.vy);
        if(sp > MAXV){ p.vx *= MAXV / sp; p.vy *= MAXV / sp; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if(p.x < -12) p.x = W + 12; else if(p.x > W + 12) p.x = -12;
        if(p.y < -12) p.y = H + 12; else if(p.y > H + 12) p.y = -12;

        ctx.globalAlpha = Math.min(.9, p.a + Math.min(.3, sp * .02));
        ctx.fillStyle = palette[p.ci] || '#3b6fe0';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    TS._particles = parts;
  };
  TS.initParticles();
})();
