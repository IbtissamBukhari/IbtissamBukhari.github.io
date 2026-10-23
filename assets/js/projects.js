// Project cards, rendered from data/projects.json.
// Shared by the public pages and the admin panel so both show exactly the same card.
(function () {
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // Only http(s) links and plain relative paths are allowed, so no javascript: URLs get through.
  function safeUrl(u, base) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.indexOf('//') === 0) return '';
    return (base || '') + u.replace(/^\/+/, '');
  }

  // The main "View project" target: the case study if there is one, then the demo, then the code.
  function primaryLink(p, base) {
    var l = p.links || {};
    if (l.caseStudy) return { href: safeUrl(l.caseStudy, base), label: 'View project' };
    if (l.demo) return { href: safeUrl(l.demo, base), label: 'View project', external: true };
    if (l.code) return { href: safeUrl(l.code, base), label: 'View on GitHub', external: true };
    return null;
  }

  function thumb(p, base) {
    if (p.image) {
      // data:image URLs only occur in the admin preview, for a screenshot that hasn't been published yet
      var src = /^data:image\/(png|jpeg|webp);base64,/.test(p.image) ? p.image : safeUrl(p.image, base);
      var webp = p.imageWebp ? '<source srcset="' + esc(safeUrl(p.imageWebp, base)) + '" type="image/webp">' : '';
      return '<picture>' + webp + '<img src="' + esc(src) + '" alt="' + esc(p.imageAlt || p.title) +
        '" width="1280" height="720" loading="lazy" decoding="async"></picture>';
    }
    var steps = (p.schematic && p.schematic.length) ? p.schematic : [p.category || 'Project'];
    return '<div class="schematic" role="img" aria-label="System overview: ' + esc(steps.join(', ')) + '">' +
      steps.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('<i aria-hidden="true">→</i>') + '</div>';
  }

  function card(p, base, opts) {
    base = base || '';
    opts = opts || {};
    var l = p.links || {};
    var ext = ' target="_blank" rel="noopener"';
    var links = [];
    if (l.demo) links.push('<a href="' + esc(safeUrl(l.demo, base)) + '"' + ext + '>' + esc(l.demoLabel || 'Live demo') + '</a>');
    if (l.code) links.push('<a href="' + esc(safeUrl(l.code, base)) + '"' + ext + '>Code</a>');
    if (l.linkedin) links.push('<a href="' + esc(safeUrl(l.linkedin, base)) + '"' + ext + '>LinkedIn post</a>');
    var main = primaryLink(p, base);
    var view = main ? '<a class="case" href="' + esc(main.href) + '"' + (main.external ? ext : '') + '>' + esc(main.label) +
      ' <span class="arrow" aria-hidden="true">→</span></a>' : '';
    var results = (p.results || []).filter(function (r) { return r && (r.value || r.label); }).map(function (r) {
      return '<li><b>' + esc(r.value) + '</b> ' + esc(r.label) + '</li>';
    }).join('');
    var stack = (p.stack || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var h = opts.heading || 'h3';
    return '<article class="pcard' + (opts.reveal === false ? '' : ' reveal') + '" data-category="' + esc(p.category || '') + '">' +
      '<div class="shot">' + thumb(p, base) + (p.tag ? '<span class="tag">' + esc(p.tag) + '</span>' : '') + '</div>' +
      '<div class="pbody">' +
      (p.spec ? '<div class="spec">' + esc(p.spec) + '</div>' : '') +
      '<' + h + '>' + esc(p.title) + '</' + h + '>' +
      (p.summary ? '<p>' + esc(p.summary) + '</p>' : '') +
      (results ? '<ul class="chips" aria-label="Key results">' + results + '</ul>' : '') +
      (stack ? '<ul class="badges" aria-label="Tools">' + stack + '</ul>' : '') +
      '<div class="plinks">' + links.join('') + view + '</div>' +
      '</div></article>';
  }

  function load(base) {
    return fetch((base || '') + 'data/projects.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('projects.json ' + r.status);
      return r.json();
    });
  }

  window.Portfolio = { esc: esc, safeUrl: safeUrl, card: card, load: load, primaryLink: primaryLink };
})();
