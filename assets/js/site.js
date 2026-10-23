// Small, dependency-free behaviour for the portfolio.
(function () {
  document.documentElement.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Copy-to-clipboard buttons
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });

  // Reveal on scroll: only elements that start below the fold are hidden, so the page is complete without JS.
  var io = null;
  if (!reduce && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); countUp(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
  }
  function watch(root) {
    if (!io) return;
    root.querySelectorAll('.reveal').forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('pre'); io.observe(el); }
    });
  }
  watch(document);

  // Results count up once when they scroll into view: "0.911", "76%", "4×", "88.6%".
  function countUp(el) {
    el.querySelectorAll('.numbers .n, .n').forEach(function (n) {
      if (n.dataset.done) return;
      var m = n.textContent.trim().match(/^([\d.]+)(.*)$/);
      if (!m) return;
      n.dataset.done = '1';
      var target = parseFloat(m[1]), dec = (m[1].split('.')[1] || '').length, suffix = m[2], t0 = null;
      var final = n.textContent;
      var tick = function (t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3);
        n.textContent = (target * e).toFixed(dec) + suffix;
        if (k < 1) requestAnimationFrame(tick); else n.textContent = final;
      };
      requestAnimationFrame(tick);
    });
  }

  // Project lists: the HTML already contains them (so the page works without JS);
  // here they are refreshed from data/projects.json, which the admin panel edits.
  var lists = document.querySelectorAll('[data-projects]');
  if (lists.length && window.Portfolio) {
    var base = document.body.getAttribute('data-base') || '';
    Portfolio.load(base).then(function (all) {
      var visible = all.filter(function (p) { return !p.hidden; });
      lists.forEach(function (box) {
        var mode = box.getAttribute('data-projects');
        var list = mode === 'featured' ? visible.filter(function (p) { return p.featured; }).slice(0, 3) : visible;
        if (!list.length) return;
        var render = mode === 'featured' ? Portfolio.spread : Portfolio.row;
        box.innerHTML = list.map(function (p, i) { return render(p, i, base); }).join('');
        watch(box);
      });
      var c = document.querySelector('.count-total');
      if (c) c.textContent = '(' + (visible.length < 10 ? '0' : '') + visible.length + ')';
      setupFilters();
    }).catch(setupFilters);
  }

  function setupFilters() {
    var bar = document.getElementById('filters');
    var box = document.querySelector('[data-projects="all"]');
    if (!bar || !box) return;
    var items = Array.prototype.slice.call(box.querySelectorAll('[data-category]'));
    var counts = {};
    items.forEach(function (c) { var k = c.getAttribute('data-category') || 'Other'; counts[k] = (counts[k] || 0) + 1; });
    var cats = Object.keys(counts); // in the order projects appear, so the most important areas come first
    var count = document.getElementById('project-count');
    var btn = function (label, n, on) {
      return '<button type="button" class="filter" data-filter="' + Portfolio.esc(label) + '" aria-pressed="' + on + '">' +
        Portfolio.esc(label) + '<span>(' + n + ')</span></button>';
    };
    bar.innerHTML = btn('All', items.length, true) + cats.map(function (c) { return btn(c, counts[c], false); }).join('');
    bar.hidden = false;
    var apply = function (f) {
      var shown = 0;
      items.forEach(function (c) { var on = f === 'All' || c.getAttribute('data-category') === f; c.hidden = !on; if (on) { shown++; c.classList.remove('pre'); } });
      if (count) count.textContent = shown + (shown === 1 ? ' project' : ' projects');
      bar.querySelectorAll('.filter').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === f)); });
    };
    bar.onclick = function (e) {
      var b = e.target.closest('.filter');
      if (b) apply(b.getAttribute('data-filter'));
    };
    apply('All');
  }
})();
