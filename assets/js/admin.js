// Portfolio admin: edits data/projects.json in the GitHub repository through the GitHub API.
// Access needs a GitHub token with write access to the repository, so only the owner can change anything.
(function () {
  'use strict';
  var OWNER = 'IbtissamBukhari';
  var REPO = 'IbtissamBukhari.github.io';
  var BRANCH = 'main';
  var DATA_PATH = 'data/projects.json';
  var API = 'https://api.github.com';
  var KEY = 'pf-admin-token';
  var esc = Portfolio.esc;

  var $ = function (id) { return document.getElementById(id); };
  var state = { token: '', user: null, projects: [], saved: '[]', sha: null, uploads: {}, previews: {}, editing: -1, draftImage: null, repos: null };

  // ---------------------------------------------------------------- storage
  function readToken() {
    try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  }
  function storeToken(t, remember) {
    try {
      sessionStorage.removeItem(KEY); localStorage.removeItem(KEY);
      if (t) (remember ? localStorage : sessionStorage).setItem(KEY, t);
    } catch (e) { /* storage unavailable: the token lives in memory for this visit only */ }
  }

  // ---------------------------------------------------------------- GitHub API
  function gh(path, opts) {
    opts = opts || {};
    var headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (state.token && opts.auth !== false) headers.Authorization = 'Bearer ' + state.token;
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (t) {
          var data = t ? JSON.parse(t) : null;
          if (!r.ok) { var e = new Error((data && data.message) || ('GitHub error ' + r.status)); e.status = r.status; throw e; }
          return data;
        });
      });
  }
  var b64encode = function (str) { return btoa(unescape(encodeURIComponent(str))); };
  var b64decode = function (b64) { return decodeURIComponent(escape(atob(b64.replace(/\s/g, '')))); };

  function loadData() {
    return gh('/repos/' + OWNER + '/' + REPO + '/contents/' + DATA_PATH + '?ref=' + BRANCH).then(function (f) {
      state.sha = f.sha;
      state.projects = JSON.parse(b64decode(f.content));
      state.saved = JSON.stringify(state.projects);
      state.uploads = {};
    });
  }

  // ---------------------------------------------------------------- views
  function show(view) {
    ['signin', 'dash', 'edit'].forEach(function (v) { $('view-' + v).hidden = v !== view; });
    $('signout').hidden = view === 'signin';
    window.scrollTo(0, 0);
  }
  var toastTimer;
  function toast(msg, kind) {
    var t = $('toast');
    t.textContent = msg; t.className = 'adm-toast ' + (kind || ''); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 5000);
  }
  function dirtyCount() {
    var before = JSON.parse(state.saved), byId = {}, n = 0;
    before.forEach(function (b) { byId[b.id] = JSON.stringify(b); });
    state.projects.forEach(function (p) { if (byId[p.id] !== JSON.stringify(p)) n++; });
    var nowIds = state.projects.map(function (p) { return p.id; });
    before.forEach(function (b) { if (nowIds.indexOf(b.id) < 0) n++; });
    if (!n && nowIds.join() !== before.map(function (b) { return b.id; }).join()) n = 1;
    return n;
  }
  function refreshPublishBar() {
    var n = dirtyCount();
    $('publish-bar').hidden = n === 0;
    $('publish-text').textContent = n + (n === 1 ? ' unpublished change' : ' unpublished changes') + ' — visitors still see the old version';
  }

  // ---------------------------------------------------------------- sign in
  function signIn(token, remember) {
    state.token = token;
    return gh('/user').then(function (u) {
      if (u.login.toLowerCase() !== OWNER.toLowerCase()) throw new Error('This key belongs to @' + u.login + ', not @' + OWNER + '.');
      state.user = u;
      return gh('/repos/' + OWNER + '/' + REPO);
    }).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) throw new Error('This key can read the repository but not change it. Give it "Contents: Read and write".');
      storeToken(token, remember);
      return loadData();
    }).then(function () {
      $('who').textContent = 'Signed in as @' + state.user.login;
      renderDash();
      show('dash');
    }).catch(function (e) {
      state.token = ''; storeToken('');
      throw e.status === 401 ? new Error('GitHub did not accept this key. Check that it was copied completely and has not expired.') : e;
    });
  }

  $('signin-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('token').value.trim();
    var msg = $('signin-msg'); msg.textContent = 'Checking…'; msg.className = 'form-msg';
    signIn(t, $('remember').checked).then(function () { $('token').value = ''; msg.textContent = ''; })
      .catch(function (err) { msg.textContent = err.message; msg.className = 'form-msg err'; });
  });

  $('signout').addEventListener('click', function () {
    if (dirtyCount() && !window.confirm('You have unpublished changes. Sign out anyway?')) return;
    storeToken(''); state.token = ''; state.user = null; state.projects = []; state.saved = '[]';
    $('publish-bar').hidden = true;
    show('signin');
  });

  // ---------------------------------------------------------------- dashboard
  function renderDash() {
    renderStats();
    renderList();
    refreshPublishBar();
  }

  function renderStats() {
    var p = state.projects, vis = p.filter(function (x) { return !x.hidden; });
    var tiles = [
      [vis.length, 'Projects on the site'],
      [vis.filter(function (x) { return x.featured; }).length + ' / 3', 'Featured on home'],
      [vis.filter(function (x) { return x.links && x.links.demo; }).length, 'Live demos'],
      [p.length - vis.length, 'Hidden drafts']
    ];
    var u = state.user || {};
    var html = tiles.map(function (t) { return '<div class="metric"><span class="num">' + esc(t[0]) + '</span><span class="what">' + esc(t[1]) + '</span></div>'; }).join('');
    html += '<div class="metric"><span class="num" id="stat-stars">–</span><span class="what">GitHub stars</span></div>';
    html += '<div class="metric"><span class="num">' + esc(u.public_repos != null ? u.public_repos : '–') + '</span><span class="what">Public repositories</span></div>';
    $('stats').innerHTML = html;
    loadRepos().then(function (repos) {
      var s = repos.reduce(function (a, r) { return a + (r.stargazers_count || 0); }, 0);
      var el = $('stat-stars'); if (el) el.textContent = s;
    }).catch(function () {});
  }

  function thumbHtml(p) {
    var src = state.previews[p.image] || (p.image ? Portfolio.safeUrl(p.image, '') : '');
    return src ? '<img src="' + esc(src) + '" alt="">' : '<span>' + esc((p.title || '?').slice(0, 1)) + '</span>';
  }

  function renderList() {
    var list = $('project-list');
    if (!state.projects.length) { list.innerHTML = '<li class="muted empty">No projects yet. Add your first one.</li>'; return; }
    list.innerHTML = state.projects.map(function (p, i) {
      var main = Portfolio.primaryLink(p, '');
      var flags = (p.featured && !p.hidden ? '<span class="flag feat">Featured</span>' : '') + (p.hidden ? '<span class="flag hid">Hidden</span>' : '');
      return '<li class="adm-item' + (p.hidden ? ' is-hidden' : '') + '" data-i="' + i + '">' +
        '<div class="thumb">' + thumbHtml(p) + '</div>' +
        '<div class="info"><b>' + esc(p.title) + '</b>' + flags + '<span class="muted">' + esc(p.category || 'No area') +
        (p.links && p.links.demo ? ' · <span class="demo-status" data-url="' + esc(p.links.demo) + '">live demo</span>' : '') + '</span></div>' +
        '<div class="ops">' +
        '<button type="button" class="icon" data-act="up" aria-label="Move ' + esc(p.title) + ' up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="icon" data-act="down" aria-label="Move ' + esc(p.title) + ' down"' + (i === state.projects.length - 1 ? ' disabled' : '') + '>↓</button>' +
        (main ? '<a class="btn small ghost" href="' + esc(main.href) + '" target="_blank" rel="noopener">View</a>' : '') +
        '<button type="button" class="btn small" data-act="edit">Edit</button>' +
        '<button type="button" class="btn small ghost" data-act="hide">' + (p.hidden ? 'Show' : 'Hide') + '</button>' +
        '<button type="button" class="btn small danger" data-act="delete">Delete</button>' +
        '</div></li>';
    }).join('');
  }

  $('project-list').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var i = +b.closest('.adm-item').getAttribute('data-i');
    var p = state.projects, act = b.getAttribute('data-act');
    if (act === 'up' && i > 0) { p.splice(i - 1, 0, p.splice(i, 1)[0]); }
    else if (act === 'down' && i < p.length - 1) { p.splice(i + 1, 0, p.splice(i, 1)[0]); }
    else if (act === 'hide') { p[i].hidden = !p[i].hidden; }
    else if (act === 'edit') { return openEditor(i); }
    else if (act === 'delete') {
      if (b.getAttribute('data-confirm') !== '1') { b.setAttribute('data-confirm', '1'); b.textContent = 'Click again to delete'; return; }
      p.splice(i, 1);
      toast('Deleted. Publish to remove it from the site, or Discard to undo.');
    }
    renderDash();
  });

  // demo status: a no-cors request resolves if the server answers at all (it may take ~1 min to wake up on free hosting)
  $('check-demos').addEventListener('click', function () {
    var els = document.querySelectorAll('.demo-status');
    if (!els.length) { toast('No live demos to check.'); return; }
    els.forEach(function (el) {
      el.textContent = 'checking…'; el.className = 'demo-status wait';
      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 75000);
      fetch(el.getAttribute('data-url'), { mode: 'no-cors', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
        .then(function () { el.textContent = 'demo online'; el.className = 'demo-status ok'; })
        .catch(function () { el.textContent = 'demo not responding'; el.className = 'demo-status bad'; })
        .then(function () { clearTimeout(timer); });
    });
  });

  // tabs
  function selectTab(name) {
    ['projects', 'repos'].forEach(function (t) {
      var on = t === name;
      $('tab-' + t).setAttribute('aria-selected', String(on));
      $('tab-' + t).tabIndex = on ? 0 : -1;
      $('panel-' + t).hidden = !on;
    });
    if (name === 'repos') renderRepos();
  }
  $('tab-projects').addEventListener('click', function () { selectTab('projects'); });
  $('tab-repos').addEventListener('click', function () { selectTab('repos'); });
  document.querySelector('.adm-tabs').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      var next = $('tab-projects').getAttribute('aria-selected') === 'true' ? 'repos' : 'projects';
      selectTab(next); $('tab-' + next).focus();
    }
  });

  // ---------------------------------------------------------------- GitHub repositories
  function loadRepos() {
    if (state.repos) return Promise.resolve(state.repos);
    return gh('/users/' + OWNER + '/repos?per_page=100&sort=pushed', { auth: false }).then(function (r) {
      state.repos = r.filter(function (x) { return !x.fork && x.name.toLowerCase() !== REPO.toLowerCase(); });
      return state.repos;
    });
  }
  function onPortfolio(repo) {
    var url = repo.html_url.toLowerCase();
    return state.projects.some(function (p) { return p.links && (p.links.code || '').toLowerCase().replace(/\/$/, '') === url; });
  }
  function renderRepos() {
    loadRepos().then(function (repos) {
      $('repo-list').innerHTML = repos.map(function (r, i) {
        var on = onPortfolio(r);
        return '<li class="adm-repo"><div><a href="' + esc(r.html_url) + '" target="_blank" rel="noopener"><b>' + esc(r.name) + '</b></a>' +
          '<p class="muted">' + esc(r.description || 'No description') + '</p>' +
          '<span class="meta">' + esc(r.language || '—') + ' · ★ ' + r.stargazers_count + ' · updated ' + new Date(r.pushed_at).toLocaleDateString() + '</span></div>' +
          (on ? '<span class="flag feat">On portfolio</span>' : '<button type="button" class="btn small" data-repo="' + i + '">Add to portfolio</button>') + '</li>';
      }).join('') || '<li class="muted">No public repositories found.</li>';
    }).catch(function (e) { $('repo-list').innerHTML = '<li class="form-msg err">Could not load repositories: ' + esc(e.message) + '</li>'; });
  }
  $('repo-list').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-repo]'); if (!b) return;
    var r = state.repos[+b.getAttribute('data-repo')];
    var title = r.name.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    openEditor(-1, {
      title: title, summary: r.description || '', category: '', tag: r.homepage ? 'Live demo' : '',
      stack: (r.topics && r.topics.length ? r.topics : [r.language]).filter(Boolean),
      links: { code: r.html_url, demo: r.homepage || '', demoLabel: r.homepage ? 'Live demo' : '' }
    });
  });

  // ---------------------------------------------------------------- editor
  var F = ['title', 'summary', 'category', 'tag', 'spec', 'stack', 'demo', 'demoLabel', 'code', 'linkedin', 'caseStudy', 'imageAlt', 'schematic'];
  function blank() { return { id: '', title: '', summary: '', spec: '', tag: '', category: '', image: '', imageWebp: '', imageAlt: '', schematic: [], results: [], stack: [], links: {}, featured: false, hidden: false }; }

  function openEditor(i, prefill) {
    state.editing = i;
    var p = i >= 0 ? JSON.parse(JSON.stringify(state.projects[i])) : Object.assign(blank(), prefill || {});
    p.links = p.links || {};
    state.draftImage = { image: p.image || '', imageWebp: p.imageWebp || '' };
    var vals = { title: p.title, summary: p.summary, category: p.category, tag: p.tag, spec: p.spec, stack: (p.stack || []).join(', '),
      demo: p.links.demo, demoLabel: p.links.demoLabel, code: p.links.code, linkedin: p.links.linkedin, caseStudy: p.links.caseStudy,
      imageAlt: p.imageAlt, schematic: (p.schematic || []).join(', ') };
    F.forEach(function (k) { $('f-' + k).value = vals[k] || ''; });
    $('f-featured').checked = !!p.featured; $('f-hidden').checked = !!p.hidden;
    var rows = '';
    for (var r = 0; r < 3; r++) {
      var x = (p.results || [])[r] || {};
      rows += '<div class="row2"><div><label for="r-v' + r + '">Value</label><input id="r-v' + r + '" maxlength="12" placeholder="' + ['0.91', '76%', '4×'][r] + '" value="' + esc(x.value || '') + '"></div>' +
        '<div><label for="r-l' + r + '">What it measures</label><input id="r-l' + r + '" maxlength="30" placeholder="' + ['AUC-ROC', 'of churners caught', 'smaller model'][r] + '" value="' + esc(x.label || '') + '"></div></div>';
    }
    $('f-results').innerHTML = rows;
    var cats = {}; state.projects.forEach(function (q) { if (q.category) cats[q.category] = 1; });
    ['Machine Learning', 'NLP', 'Computer Vision', 'Data Analysis', 'MLOps', 'Deep Learning'].forEach(function (c) { cats[c] = 1; });
    $('cat-list').innerHTML = Object.keys(cats).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
    $('edit-title').textContent = i >= 0 ? 'Edit project' : 'New project';
    $('edit-crumb').textContent = i >= 0 ? p.title : 'New project';
    $('edit-msg').textContent = '';
    $('f-image').value = '';
    show('edit');
    updatePreview();
    $('f-title').focus();
  }

  var list = function (s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); };
  function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'project'; }

  function formProject() {
    var base = state.editing >= 0 ? state.projects[state.editing] : blank();
    var v = function (k) { return $('f-' + k).value.trim(); };
    var results = [];
    for (var r = 0; r < 3; r++) {
      var a = $('r-v' + r).value.trim(), b = $('r-l' + r).value.trim();
      if (a || b) results.push({ value: a, label: b });
    }
    var links = {};
    ['demo', 'demoLabel', 'code', 'linkedin', 'caseStudy'].forEach(function (k) { if (v(k)) links[k] = v(k); });
    if (links.demo && !links.demoLabel) links.demoLabel = 'Live demo';
    if (!links.demo) delete links.demoLabel;
    return Object.assign({}, base, {
      title: v('title'), summary: v('summary'), category: v('category'), tag: v('tag'), spec: v('spec'),
      stack: list(v('stack')), schematic: list(v('schematic')), imageAlt: v('imageAlt'),
      image: state.draftImage.image, imageWebp: state.draftImage.imageWebp,
      results: results, links: links, featured: $('f-featured').checked, hidden: $('f-hidden').checked
    });
  }

  function previewProject(p) {
    // Show freshly uploaded images before they exist on the site.
    var q = JSON.parse(JSON.stringify(p));
    if (state.previews[q.image]) { q.image = state.previews[q.image]; q.imageWebp = ''; }
    return q;
  }
  function updatePreview() {
    var p = formProject();
    if (!p.title) p.title = 'Project title';
    var src = previewProject(p);
    $('preview').innerHTML = Portfolio.card(src, '', { reveal: false });
    $('img-prev').innerHTML = src.image ? '<img src="' + esc(/^data:/.test(src.image) ? src.image : Portfolio.safeUrl(src.image, '')) + '" alt="">' : '<span class="muted">No image</span>';
    $('img-remove').hidden = !p.image;
  }
  $('edit-form').addEventListener('input', updatePreview);
  $('edit-form').addEventListener('change', updatePreview);

  function validUrl(u) { return !u || /^https?:\/\/[^\s]+\.[^\s]+/.test(u); }

  $('edit-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = formProject(), msg = $('edit-msg');
    var bad = [];
    if (!p.title) bad.push('a title');
    if (!p.summary) bad.push('a one-line summary');
    ['demo', 'code', 'linkedin'].forEach(function (k) { if (!validUrl(p.links[k])) bad.push('a full ' + { demo: 'demo', code: 'GitHub', linkedin: 'LinkedIn' }[k] + ' link starting with https://'); });
    if (p.links.caseStudy && !/^https?:\/\//.test(p.links.caseStudy) && !/^[\w\-./]+$/.test(p.links.caseStudy)) bad.push('a valid case study link');
    if (bad.length) { msg.textContent = 'Please add ' + bad.join(', ') + '.'; msg.className = 'form-msg err'; return; }
    if (!p.id) {
      var id = slugify(p.title), n = 2;
      while (state.projects.some(function (q) { return q.id === id; })) id = slugify(p.title) + '-' + n++;
      p.id = id;
    }
    if (state.editing >= 0) state.projects[state.editing] = p; else state.projects.unshift(p);
    var feat = state.projects.filter(function (q) { return q.featured && !q.hidden; }).length;
    show('dash'); selectTab('projects'); renderDash();
    toast(feat > 3 ? 'Saved. Note: only the first 3 featured projects appear on the home page.' : 'Saved. Click "Publish to site" when you are ready.', 'ok');
  });

  function backToDash(e) { if (e) e.preventDefault(); show('dash'); renderDash(); }
  $('cancel-edit').addEventListener('click', backToDash);
  $('back').addEventListener('click', backToDash);
  $('add-project').addEventListener('click', function () { openEditor(-1); });

  // image upload: resize in the browser to 1280px wide, keep a JPEG and a WebP copy
  $('f-image').addEventListener('change', function () {
    var file = this.files && this.files[0]; if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('Please choose a PNG, JPG or WebP image.', 'err'); return; }
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var w = Math.min(1280, img.naturalWidth), h = Math.round(img.naturalHeight * w / img.naturalWidth);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      var name = 'assets/img/uploads/' + slugify($('f-title').value || 'project') + '-' + Date.now().toString(36);
      var jpg = c.toDataURL('image/jpeg', 0.85), webp = c.toDataURL('image/webp', 0.82);
      state.uploads[name + '.jpg'] = jpg.split(',')[1];
      if (webp.indexOf('data:image/webp') === 0) state.uploads[name + '.webp'] = webp.split(',')[1];
      state.previews[name + '.jpg'] = jpg;
      state.draftImage = { image: name + '.jpg', imageWebp: state.uploads[name + '.webp'] ? name + '.webp' : '' };
      if (!$('f-imageAlt').value) $('f-imageAlt').value = 'Screenshot of ' + ($('f-title').value || 'the project');
      updatePreview();
    };
    img.onerror = function () { toast('That image could not be read.', 'err'); };
    img.src = url;
  });
  $('img-remove').addEventListener('click', function () { state.draftImage = { image: '', imageWebp: '' }; updatePreview(); });

  // ---------------------------------------------------------------- publish
  function usedUploads() {
    var used = {};
    state.projects.forEach(function (p) { [p.image, p.imageWebp].forEach(function (x) { if (x && state.uploads[x]) used[x] = state.uploads[x]; }); });
    return used;
  }
  $('publish').addEventListener('click', function () {
    var btn = this; btn.disabled = true; btn.textContent = 'Publishing…';
    var files = usedUploads(), paths = Object.keys(files);
    var chain = Promise.resolve();
    paths.forEach(function (path) {
      chain = chain.then(function () {
        return gh('/repos/' + OWNER + '/' + REPO + '/contents/' + path, { method: 'PUT', body: { message: 'Add project image ' + path.split('/').pop(), content: files[path], branch: BRANCH } });
      });
    });
    chain.then(function () {
      var body = JSON.stringify(state.projects, null, 2) + '\n';
      return gh('/repos/' + OWNER + '/' + REPO + '/contents/' + DATA_PATH, { method: 'PUT', body: { message: 'Update portfolio projects', content: b64encode(body), sha: state.sha, branch: BRANCH } });
    }).then(function (res) {
      state.sha = res.content.sha;
      state.saved = JSON.stringify(state.projects);
      paths.forEach(function (p) { delete state.uploads[p]; });
      refreshPublishBar(); renderList();
      toast('Published. The live site updates in about a minute.', 'ok');
    }).catch(function (e) {
      if (e.status === 409 || e.status === 422) toast('The projects changed somewhere else since you opened this page. Reload the page and make your change again.', 'err');
      else toast('Publishing failed: ' + e.message, 'err');
    }).then(function () { btn.disabled = false; btn.textContent = 'Publish to site'; });
  });

  $('discard').addEventListener('click', function () {
    state.projects = JSON.parse(state.saved); state.uploads = {};
    renderDash(); show('dash'); toast('Changes discarded.');
  });

  window.addEventListener('beforeunload', function (e) {
    if (state.user && dirtyCount()) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------------------------------------------------------------- start
  var saved = readToken();
  if (saved) {
    signIn(saved, (function () { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } })())
      .catch(function (err) { $('signin-msg').textContent = err.message; $('signin-msg').className = 'form-msg err'; show('signin'); });
  } else {
    show('signin');
  }
})();
