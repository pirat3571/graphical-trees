/* Общие визуальные помощники для разделов «Сортировки», «Поиск», «Индексация». */
(function(){
  'use strict';
  const TS = window.TreeSite;

  TS.code = function(ch){
    const s = String(ch);
    return s.codePointAt(0) || 0;
  };

  /* Разбор строки в массив символов. Для сортировок повторы разрешены. */
  TS.parseChars = function(raw, max, keepDup){
    max = max || 24;
    const chars = [...String(raw)].filter(c => !/[\s,;]/.test(c));
    if(keepDup) return {chars:chars.slice(0, max), dups:0, total:chars.length};
    const seen = new Set(), out = [];
    let dups = 0;
    for(const c of chars){
      if(seen.has(c)){ dups++; continue; }
      seen.add(c); out.push(c);
      if(out.length >= max) break;
    }
    return {chars:out, dups, total:chars.length};
  };

  /* Столбики: шаг сортировки. */
  TS.renderSortStep = function(el, step){
    if(!step || !step.arr || !step.arr.length){
      el.innerHTML = '<div class="empty">Введите буквы и нажмите «Построить»</div>';
      return;
    }
    const arr = step.arr;
    const codes = arr.map(TS.code);
    const lo = Math.min.apply(null, codes), hi = Math.max.apply(null, codes);
    const span = Math.max(1, hi - lo);
    const cmp = new Set(step.cmp || []);
    const move = new Set(step.move || []);
    const done = new Set(step.done || []);
    const tags = step.tags || {};
    let bars = '';
    arr.forEach((ch, i) => {
      const h = 36 + Math.round((TS.code(ch) - lo) / span * 150);
      let cls = 'bar';
      if(cmp.has(i)) cls += ' cmp';
      if(move.has(i)) cls += ' move';
      if(done.has(i)) cls += ' done';
      if(step.pivot === i) cls += ' pivot';
      bars += `<div class="${cls}">${tags[i] ? `<span class="tag">${TS.esc(tags[i])}</span>` : ''}<div class="col" style="height:${h}px"><b>${TS.esc(ch)}</b></div><span class="ix">${i}</span></div>`;
    });
    let h = `<div class="bars">${bars}</div>`;
    if(step.caption) h += `<div class="bars-caption">${step.caption}</div>`;
    if(step.aux) h += `<div class="auxline">${step.aux}</div>`;
    if(step.buckets) h += TS.renderBuckets(step);
    el.innerHTML = h;
  };

  TS.renderBuckets = function(step){
    const keys = Object.keys(step.buckets).map(Number).filter(k => step.buckets[k] && step.buckets[k].length);
    if(!keys.length) return '';
    keys.sort((a, b) => a - b);
    let h = '<div class="buckets">';
    for(const k of keys){
      const vals = step.buckets[k].map(v => `<span class="chip">${TS.esc(v)}</span>`).join('');
      const label = step.bucketLabels ? step.bucketLabels[k] : String.fromCharCode(65 + k);
      h += `<div class="bucket${step.hotBucket === k ? ' hot' : ''}"><span class="bt"><span>${TS.esc(label)}</span><span>${k}</span></span><div class="vals">${vals}</div></div>`;
    }
    return h + '</div>';
  };

  /* Двоичная куча из массива: маленькое дерево над столбиками. */
  TS.renderHeap = function(step){
    const arr = step.arr || [];
    const n = step.heapSize === undefined ? arr.length : step.heapSize;
    if(n < 2) return '';
    const levels = Math.floor(Math.log2(n)) + 1;
    const cell = 54, W = Math.pow(2, levels - 1) * cell + 40, H = levels * 62 + 22;
    const X = i => {
      const d = Math.floor(Math.log2(i + 1));
      const pos = i - (Math.pow(2, d) - 1);
      const slots = Math.pow(2, d);
      return 20 + (W - 40) * (pos + 0.5) / slots;
    };
    const Y = i => 22 + Math.floor(Math.log2(i + 1)) * 62;
    const cmp = new Set(step.cmp || []), move = new Set(step.move || []);
    let edges = '', nodes = '';
    for(let i = 1; i < n; i++){
      const p = Math.floor((i - 1) / 2);
      edges += `<line x1="${X(p)}" y1="${Y(p)}" x2="${X(i)}" y2="${Y(i)}" stroke="var(--mut)" stroke-width="1.2" opacity=".6"/>`;
    }
    for(let i = 0; i < n; i++){
      const fill = move.has(i) ? 'var(--bad)' : cmp.has(i) ? 'var(--acsoft)' : i === step.pivot ? 'var(--oksoft)' : 'var(--node)';
      const col = move.has(i) ? '#fff' : 'var(--tx)';
      nodes += `<circle cx="${X(i)}" cy="${Y(i)}" r="15" fill="${fill}" stroke="${cmp.has(i) || i === step.pivot ? 'var(--ac)' : 'var(--bd)'}" stroke-width="${cmp.has(i) || i === step.pivot ? 2.5 : 1.2}"/>`;
      nodes += `<text x="${X(i)}" y="${Y(i) + 5}" text-anchor="middle" font-size="13" font-weight="600" fill="${col}">${TS.esc(arr[i])}</text>`;
    }
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Двоичная куча">${edges}${nodes}</svg>`;
  };

  /* Полоска символов с номерами позиций. */
  TS.indexLine = function(chars, marks){
    marks = marks || {};
    const on = new Set(marks.on || []), off = new Set(marks.off || []), hot = new Set(marks.hot || []), pick = marks.pick;
    let h = '<div class="idx-line">';
    chars.forEach((ch, i) => {
      let cls = 'idx-cell';
      if(off.has(i)) cls += ' off';
      if(on.has(i)) cls += ' on';
      if(hot.has(i)) cls += ' hot';
      if(pick === i) cls += ' pick';
      h += `<span class="${cls}"><b>${TS.esc(ch)}</b><i>${i}</i></span>`;
    });
    return h + '</div>';
  };

  TS.pairLine = function(pairs, marks){
    marks = marks || {};
    const cmp = new Set(marks.cmp || []), move = new Set(marks.move || []);
    let h = '<div class="pairs">';
    pairs.forEach((p, i) => {
      let cls = 'pair';
      if(cmp.has(i)) cls += ' cmp';
      if(move.has(i)) cls += ' move';
      h += `<span class="${cls}">${TS.esc(p.ch)}<i>поз. ${p.pos}</i></span>`;
    });
    return h + '</div>';
  };
})();
