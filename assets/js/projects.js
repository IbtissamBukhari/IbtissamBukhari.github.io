// Project layouts, rendered from data/projects.json.
// Shared by the public pages and the admin panel. Mirrors spread() and row() in the page generator.
(function () {
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var EXT = ' target="_blank" rel="noopener"';
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  // Only http(s) links and plain relative paths are allowed, so no javascript: URLs get through.
  function safeUrl(u, base) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.indexOf('//') === 0) return '';
    return (base || '') + u.replace(/^\/+/, '');
  }

  // "View project": the case study if there is one, then the live demo, then the code.
  function primaryLink(p, base) {
    var l = p.links || {};
    if (l.caseStudy) return { href: safeUrl(l.caseStudy, base), label: 'View project' };
    if (l.demo) return { href: safeUrl(l.demo, base), label: 'View project', external: true };
    if (l.code) return { href: safeUrl(l.code, base), label: 'View on GitHub', external: true };
    return null;
  }

  function thumb(p, base, compact) {
    if (p.image) {
      // data:image URLs only occur in the admin preview, for a screenshot that hasn't been published yet
      var src = /^data:image\/(png|jpeg|webp);base64,/.test(p.image) ? p.image : safeUrl(p.image, base);
      var webp = p.imageWebp ? '<source srcset="' + esc(safeUrl(p.imageWebp, base)) + '" type="image/webp">' : '';
      return '<picture>' + webp + '<img src="' + esc(src) + '" alt="' + esc(p.imageAlt || p.title) +
        '" width="1280" height="720" loading="lazy" decoding="async"></picture>';
    }
    var cat = p.category || 'Project';
    if (compact) return '<div class="thumb-ph" role="img" aria-label="' + esc(cat) + '"><span>' + esc(cat) + '</span></div>';
    var steps = (p.schematic && p.schematic.length) ? p.schematic : [cat];
    return '<div class="schematic" role="img" aria-label="System overview: ' + esc(steps.join(', ')) + '">' +
      steps.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('<i aria-hidden="true">↓</i>') + '</div>';
  }

  function smallLinks(p, base) {
    var l = p.links || {}, out = '';
    if (l.demo) out += '<a href="' + esc(safeUrl(l.demo, base)) + '"' + EXT + '>' + esc(l.demoLabel || 'Live demo') + ' ↗</a>';
    if (l.code) out += '<a href="' + esc(safeUrl(l.code, base)) + '"' + EXT + '>Code ↗</a>';
    if (l.linkedin) out += '<a href="' + esc(safeUrl(l.linkedin, base)) + '"' + EXT + '>LinkedIn post ↗</a>';
    return out;
  }

  // Large "Project No_01" section with screenshot, numbers and links.
  function spread(p, i, base, opts) {
    base = base || ''; opts = opts || {};
    var main = primaryLink(p, base), ext = main && main.external ? EXT : '';
    var media = main ? '<a class="spread-media" href="' + esc(main.href) + '"' + ext + ' tabindex="-1" aria-hidden="true">' + thumb(p, base) + '</a>'
      : '<div class="spread-media">' + thumb(p, base) + '</div>';
    var title = main ? '<a href="' + esc(main.href) + '"' + ext + '>' + esc(p.title) + '</a>' : esc(p.title);
    var stats = (p.results || []).filter(function (r) { return r && (r.value || r.label); }).map(function (r) {
      return '<div><dt>' + esc(r.label) + '</dt><dd>' + esc(r.value) + '</dd></div>';
    }).join('');
    var stack = (p.stack || []).map(esc).join(' / ');
    var meta = [p.category, p.tag].filter(Boolean).map(esc).join(' · ');
    var go = main ? '<a class="go" href="' + esc(main.href) + '"' + ext + '>' + esc(main.label) + ' <span class="arrow" aria-hidden="true">→</span></a>' : '';
    return '<article class="spread' + (opts.reveal === false ? '' : ' reveal') + (i % 2 ? ' flip' : '') + '" data-category="' + esc(p.category || '') + '">' +
      '<header class="spread-head"><span class="spread-word">Project</span><span class="spread-no">No_' + pad(i + 1) + '</span><span class="spread-meta">' + meta + '</span></header>' +
      '<div class="spread-body">' + media + '<div class="spread-text">' +
      (p.spec ? '<p class="spec">' + esc(p.spec) + '</p>' : '') +
      '<h3 class="spread-title">' + title + '</h3>' +
      (p.summary ? '<p class="spread-sum">' + esc(p.summary) + '</p>' : '') +
      (stats ? '<dl class="spread-stats">' + stats + '</dl>' : '') +
      (stack ? '<p class="spread-stack">' + stack + '</p>' : '') +
      '<div class="spread-links">' + go + smallLinks(p, base) + '</div></div></div></article>';
  }

  // Compact row for the project index.
  function row(p, i, base, opts) {
    base = base || ''; opts = opts || {};
    var main = primaryLink(p, base), ext = main && main.external ? EXT : '';
    var title = main ? '<a class="prow-link" href="' + esc(main.href) + '"' + ext + '>' + esc(p.title) + '</a>' : esc(p.title);
    var r0 = (p.results || []).filter(function (r) { return r && r.value; })[0];
    var links = smallLinks(p, base);
    return '<article class="prow' + (opts.reveal === false ? '' : ' reveal') + '" data-category="' + esc(p.category || '') + '">' +
      '<span class="prow-no">' + pad(i + 1) + '</span>' +
      '<div class="prow-thumb">' + thumb(p, base, true) + '</div>' +
      '<div class="prow-main"><h3>' + title + '</h3>' + (p.summary ? '<p>' + esc(p.summary) + '</p>' : '') +
      (links ? '<div class="prow-links">' + links + '</div>' : '') + '</div>' +
      '<span class="prow-cat">' + esc(p.category || '') + '</span>' +
      '<span class="prow-stat">' + (r0 ? '<b>' + esc(r0.value) + '</b> ' + esc(r0.label) : '') + '</span>' +
      '<span class="prow-arrow" aria-hidden="true">→</span></article>';
  }

  function load(base) {
    return fetch((base || '') + 'data/projects.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('projects.json ' + r.status);
      return r.json();
    });
  }

  window.Portfolio = {
    esc: esc, safeUrl: safeUrl, primaryLink: primaryLink, spread: spread, row: row, load: load,
    card: function (p, base, opts) { return spread(p, 0, base, opts); }
  };
})();
