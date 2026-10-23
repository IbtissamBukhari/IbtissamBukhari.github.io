// Small, dependency-free behaviour for the portfolio.
(function () {
  document.documentElement.classList.add('js');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobile menu: the three-line button opens and closes the page links
  var header = document.querySelector('.site-header'), menuBtn = document.querySelector('.menu-btn');
  if (header && menuBtn) {
    var setMenu = function (open) {
      header.classList.toggle('menu-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    menuBtn.addEventListener('click', function () { setMenu(!header.classList.contains('menu-open')); });
    header.querySelectorAll('.nav a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && header.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); } });
    document.addEventListener('click', function (e) { if (!header.contains(e.target)) setMenu(false); });
  }

  // Copy-to-clipboard buttons
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const text = btn.getAttribute('data-copy');
      const done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });

  // Reveal on scroll: only elements that start below the fold are hidden, so the page is complete without JS.
  if (!reduce && 'IntersectionObserver' in window) {
    const items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('pre'); io.observe(el); }
    });
  }

  // Project grids: the HTML already contains the cards (so the page works without JS);
  // here they are refreshed from data/projects.json, which the admin panel edits.
  var grids = document.querySelectorAll('[data-projects]');
  if (grids.length && window.Portfolio) {
    var base = document.body.getAttribute('data-base') || '';
    Portfolio.load(base).then(function (all) {
      var visible = all.filter(function (p) { return !p.hidden; });
      grids.forEach(function (grid) {
        var mode = grid.getAttribute('data-projects');
        var list = mode === 'featured' ? visible.filter(function (p) { return p.featured; }).slice(0, 3) : visible;
        if (!list.length) return;
        grid.innerHTML = list.map(function (p) { return Portfolio.card(p, base, { reveal: false }); }).join('');
      });
      setupFilters(visible);
    }).catch(function () { setupFilters(null); });
  }

  function setupFilters(list) {
    var bar = document.getElementById('filters');
    var grid = document.querySelector('[data-projects="all"]');
    if (!bar || !grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.pcard'));
    var counts = {};
    cards.forEach(function (c) { var k = c.getAttribute('data-category') || 'Other'; counts[k] = (counts[k] || 0) + 1; });
    var cats = Object.keys(counts); // in the order projects appear, so the most important areas come first
    var count = document.getElementById('project-count');
    var btn = function (label, n, on) {
      return '<button type="button" class="filter" data-filter="' + Portfolio.esc(label) + '" aria-pressed="' + on + '">' +
        Portfolio.esc(label) + ' <span>' + n + '</span></button>';
    };
    bar.innerHTML = btn('All', cards.length, true) + cats.map(function (c) { return btn(c, counts[c], false); }).join('');
    bar.hidden = false;
    var apply = function (f) {
      var shown = 0;
      cards.forEach(function (c) { var on = f === 'All' || c.getAttribute('data-category') === f; c.hidden = !on; if (on) shown++; });
      if (count) count.textContent = shown + (shown === 1 ? ' project' : ' projects');
      bar.querySelectorAll('.filter').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === f)); });
    };
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('.filter');
      if (b) apply(b.getAttribute('data-filter'));
    });
    apply('All');
  }

  // Hero network: slow-moving nodes with faint links.
  const canvas = document.getElementById('net');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, nodes = [], running = false, raf = 0;

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(18, Math.min(70, Math.round((w * h) / 16000)));
    nodes = [];
    for (let i = 0; i < count; i++) {
      nodes.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22, r: Math.random() * 1.4 + 0.8 });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const max = 130;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < max) {
          ctx.strokeStyle = 'rgba(10, 122, 160,' + (0.22 * (1 - d / max)).toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      ctx.fillStyle = 'rgba(10, 122, 160, 0.5)';
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function step() {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.x += n.vx; n.y += n.vy;
      if (n.x < -10) n.x = w + 10; if (n.x > w + 10) n.x = -10;
      if (n.y < -10) n.y = h + 10; if (n.y > h + 10) n.y = -10;
    }
    draw();
    if (running) raf = requestAnimationFrame(step);
  }

  function start() { if (!running && !reduce) { running = true; raf = requestAnimationFrame(step); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  size(); draw();
  window.addEventListener('resize', function () { size(); draw(); });
  if (!reduce) {
    new IntersectionObserver(function (e) { e[0].isIntersecting ? start() : stop(); }).observe(canvas);
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  }
})();
