/* Benchsy interactions.
   Plain JavaScript is intentional: the UI has no build step and this keeps the
   site easy to open, edit, and eventually migrate. */

const CONFIG = {
  rowDensity: 'comfortable',
  highlightLeader: true,
};

const ROW_HEIGHT = { comfortable: 88, compact: 70 };

const state = {
  view: 'leaderboard',
  category: 'overall',
  expandedId: null,
  pricingMode: 'expensive',
  selectedLab: null,
  compareIds: ['gpt-5-6-terra', 'claude-sonnet-5', 'gemini-3-6-flash'],
};

const el = {
  categories: document.getElementById('categories'),
  board: document.getElementById('board'),
  feed: document.getElementById('feed'),
  themeToggle: document.getElementById('theme-toggle'),
  leaderboardTitle: document.getElementById('leaderboard-title'),
  pricingChart: document.getElementById('pricing-chart'),
  modelIndex: document.getElementById('model-index'),
  modelFilter: document.getElementById('model-filter'),
  labRace: document.getElementById('lab-race'),
  labDetail: document.getElementById('lab-detail'),
  compareSlots: document.getElementById('compare-slots'),
  compareSelect: document.getElementById('compare-select'),
  compareSummary: document.getElementById('compare-summary'),
  compareGrid: document.getElementById('compare-grid'),
  compareFacts: document.getElementById('compare-facts'),
  methodologyDialog: document.getElementById('methodology-dialog'),
  weightList: document.getElementById('weight-list'),
  sourceList: document.getElementById('source-list'),
  searchOverlay: document.getElementById('search-overlay'),
  globalSearch: document.getElementById('global-search'),
  searchResults: document.getElementById('search-results'),
};

const rowHeight = () => ROW_HEIGHT[CONFIG.rowDensity] ?? ROW_HEIGHT.comfortable;
const modelById = (id) => MODELS.find((model) => model.id === id);
const categoryByKey = (key) => CATEGORIES.find((category) => category.key === key);
// Always two decimals: prices sit in aligned columns next to sub-dollar rates.
const formatPrice = (value) => `$${value.toFixed(2)}`;
const formatContext = (tokens) => tokens >= 1000000 ? `${tokens / 1000000}M` : `${tokens / 1000}K`;
const sortedFor = (key) => MODELS.slice().sort((a, b) => b.scores[key] - a.scores[key]);
const rankFor = (model, key) => sortedFor(key).findIndex((item) => item.id === model.id) + 1;

/* Lab logos. Icon marks render inside the circular avatars; the three
   wordmark-only labs keep their letter monogram, which stays legible where a
   shrunk wordmark would not. Logos are used exactly as provided — never
   recolored — so OpenAI and Anthropic swap to their official dark variant by
   theme, while xAI and Moonshot (black marks with no inverse published) sit on
   a light plate in dark mode instead. See assets/labs/sources.json. */
const LAB_LOGOS = {
  OpenAI: { file: 'openai', dark: true },
  Anthropic: { file: 'anthropic', dark: true },
  Google: { file: 'google' },
  xAI: { file: 'xai', plate: true },
  'Moonshot AI': { file: 'moonshot', plate: true },
};

function hasLogo(labName) {
  return Boolean(LAB_LOGOS[labName]);
}

// Inner HTML for an avatar/monogram element: the lab logo when one exists,
// otherwise the letter fallback. Pair with markClass() on the container.
function labMark(labName, fallbackText) {
  const logo = LAB_LOGOS[labName];
  if (!logo) return fallbackText;
  const base = `assets/labs/${logo.file}.svg`;
  if (logo.dark) {
    return `<img class="lab-logo lab-logo-lt" src="${base}" alt="" aria-hidden="true">` +
      `<img class="lab-logo lab-logo-dk" src="assets/labs/${logo.file}-dark.svg" alt="" aria-hidden="true">`;
  }
  return `<img class="lab-logo" src="${base}" alt="" aria-hidden="true">`;
}

// Container modifier classes: marks the element as holding a logo, and flags
// the two labs that need a light plate behind a black mark in dark mode.
function markClass(labName) {
  const logo = LAB_LOGOS[labName];
  if (!logo) return '';
  return logo.plate ? ' has-logo has-plate' : ' has-logo';
}

function bestCategory(model) {
  return SCORE_CATEGORIES.reduce((best, category) =>
    model.scores[category.key] > model.scores[best.key] ? category : best
  );
}

/* ── navigation ──────────────────────────────────────────────────────── */

function showView(view, options = {}) {
  const nextView = document.querySelector(`[data-view="${view}"]`) ? view : 'leaderboard';
  state.view = nextView;
  document.querySelector('.page').classList.toggle('is-secondary', nextView !== 'leaderboard');

  document.querySelectorAll('.product-view').forEach((section) => {
    const active = section.dataset.view === nextView;
    section.hidden = !active;
    section.classList.toggle('is-active', active);
  });

  document.querySelectorAll('[data-view-link]').forEach((link) => {
    if (link.dataset.viewLink === nextView) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  if (!options.fromHash) history.replaceState(null, '', `#${nextView}`);
  if (nextView === 'pricing') renderPricing();
  if (nextView === 'models') renderModelIndex(el.modelFilter.value);
  if (nextView === 'labs') renderLabs();
  if (nextView === 'compare') renderCompare();
  if (options.scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-view-link]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    showView(link.dataset.viewLink, { scroll: true });
  });
});

window.addEventListener('hashchange', () => {
  showView(location.hash.slice(1) || 'leaderboard', { fromHash: true });
});

/* ── category control ───────────────────────────────────────────────── */

function renderCategories() {
  CATEGORIES.forEach((category) => {
    const label = document.createElement('label');
    label.className = 'seg-opt';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'category';
    input.value = category.key;
    input.checked = category.key === state.category;
    input.addEventListener('change', () => {
      state.category = category.key;
      renderBoard();
    });

    label.append(input, document.createTextNode(category.shortLabel ?? category.label));
    el.categories.append(label);
  });
}

/* ── leaderboard ────────────────────────────────────────────────────── */

const rowNodes = new Map();

/* Each model owns one row for the life of the page. A row is a container that
   holds the always-visible summary line (.row-main) and a detail panel
   (.row-detail) built the first time the row is opened. The board never
   re-renders on sort or expand — it only re-measures and re-positions rows,
   which is what lets both the re-sort and the expand animate. */
function buildRow(model) {
  const root = document.createElement('div');
  root.className = 'row';
  root.setAttribute('role', 'listitem');
  root.dataset.modelId = model.id;

  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'row-main';
  main.setAttribute('aria-expanded', 'false');
  main.innerHTML = `
    <span class="row-rank"></span>
    <span class="row-avatar${markClass(model.lab)}">${labMark(model.lab, model.initials)}</span>
    <span class="row-id">
      <span class="row-name"></span>
      <span class="row-lab text-muted"></span>
    </span>
    <span class="row-track"><i class="row-bar" style="width:0%"></i></span>
    <span class="row-score"></span>
    <span class="row-change"></span>
    <span class="row-caret" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </span>`;

  const detail = document.createElement('div');
  detail.className = 'row-detail';
  detail.setAttribute('role', 'region');

  root.append(main, detail);

  const nodes = {
    root, main, detail, detailBuilt: false, detailHeight: 0,
    rank: main.querySelector('.row-rank'),
    name: main.querySelector('.row-name'),
    lab: main.querySelector('.row-lab'),
    bar: main.querySelector('.row-bar'),
    score: main.querySelector('.row-score'),
    change: main.querySelector('.row-change'),
  };

  nodes.name.textContent = model.name;
  main.addEventListener('click', () => toggleRow(model.id));

  rowNodes.set(model.id, nodes);
  el.board.append(root);
  return nodes;
}

function changeFor(raw) {
  if (raw === 'NEW') return { isNew: true };
  if (!raw) return { label: '—', tone: 'neutral' };
  const n = parseInt(raw, 10);
  return n > 0
    ? { label: `↑${n}`, tone: 'up' }
    : { label: `↓${Math.abs(n)}`, tone: 'down' };
}

function renderBoard() {
  const category = state.category;
  const categoryMeta = categoryByKey(category);
  const h = rowHeight();
  const sorted = sortedFor(category);
  const floor = Math.min(...sorted.map((model) => model.scores[category])) - 3;
  const ceiling = sorted[0].scores[category];

  el.leaderboardTitle.textContent = category === 'overall'
    ? 'Overall leaderboard'
    : `Best AI models for ${categoryMeta.label.toLowerCase()}`;

  let offset = 0;
  sorted.forEach((model, index) => {
    const nodes = rowNodes.get(model.id) ?? buildRow(model);
    const score = model.scores[category];
    const open = state.expandedId === model.id;

    // An open row is refreshed for the current category before it's measured,
    // so its per-category ranks and score stay in sync with the board.
    if (open) fillDetail(nodes, model, category);
    const rowH = open ? h + nodes.detailHeight : h;

    nodes.main.style.height = `${h}px`;
    nodes.root.style.transform = `translateY(${offset}px)`;
    nodes.root.style.height = `${rowH}px`;
    nodes.root.style.setProperty('--row-delay', `${Math.min(index * 14, 110)}ms`);
    nodes.root.classList.toggle('is-leader', CONFIG.highlightLeader && index === 0);
    nodes.root.classList.toggle('is-open', open);
    nodes.main.setAttribute('aria-expanded', String(open));
    nodes.main.setAttribute('aria-label',
      `Rank ${index + 1}: ${model.name} by ${model.lab}, ${score.toFixed(1)}. ${open ? 'Hide' : 'Show'} details`);

    nodes.rank.textContent = index + 1;
    nodes.lab.textContent = `${model.lab} · ${model.tier}`;
    nodes.bar.style.width = `${Math.max(8, ((score - floor) / (ceiling - floor)) * 100).toFixed(1)}%`;
    nodes.score.textContent = score.toFixed(1);

    const change = changeFor(model.change[category]);
    nodes.change.className = `row-change is-${change.tone ?? 'new'}`;
    nodes.change.innerHTML = change.isNew
      ? '<span class="tag tag-accent">NEW</span>'
      : change.label;

    offset += rowH;
  });

  el.board.style.height = `${offset}px`;
}

/* ── expanding detail ───────────────────────────────────────────────── */

// The static shell — built once per row, then re-filled per category.
function buildDetail(nodes, model) {
  const fps = SCORE_CATEGORIES.map((category) => `
    <div class="rd-fp" data-key="${category.key}">
      <span class="rd-fp-label">${category.shortLabel ?? category.label}</span>
      <span class="rd-fp-rank"></span>
      <span class="rd-fp-track"><i class="rd-fp-bar"></i></span>
      <span class="rd-fp-val"></span>
    </div>`).join('');

  nodes.detail.innerHTML = `
    <div class="rd-inner">
      <p class="rd-note" data-f="note"></p>
      <div class="rd-grid">
        <section class="rd-block">
          <h4 class="rd-h">Capability profile</h4>
          <div class="rd-fps">${fps}</div>
          <p class="rd-hint text-muted">Hover a bar for the benchmarks behind each score.</p>
        </section>
        <section class="rd-block">
          <h4 class="rd-h">Specs &amp; pricing</h4>
          <dl class="rd-specs">
            <div><dt>Input / 1M</dt><dd data-f="inputPrice"></dd></div>
            <div><dt>Output / 1M</dt><dd data-f="outputPrice"></dd></div>
            <div><dt>Context</dt><dd data-f="context"></dd></div>
            <div><dt>Speed</dt><dd data-f="speed"></dd></div>
            <div><dt>Released</dt><dd data-f="released"></dd></div>
            <div><dt>Status</dt><dd data-f="status"></dd></div>
          </dl>
        </section>
        <section class="rd-block rd-guide">
          <h4 class="rd-h">When to choose it</h4>
          <div class="rd-guideitem"><span class="rd-lab">Excels at</span><p data-f="strengths"></p></div>
          <div class="rd-guideitem"><span class="rd-lab">Tradeoffs</span><p data-f="weaknesses"></p></div>
          <div class="rd-guideitem"><span class="rd-lab">Choose it for</span><p data-f="uses"></p></div>
          <button type="button" class="btn btn-primary rd-compare">Add to comparison</button>
        </section>
      </div>
    </div>`;

  nodes.fps = [...nodes.detail.querySelectorAll('.rd-fp')].map((row) => ({
    key: row.dataset.key,
    row,
    rank: row.querySelector('.rd-fp-rank'),
    bar: row.querySelector('.rd-fp-bar'),
    value: row.querySelector('.rd-fp-val'),
  }));
  nodes.fields = {};
  nodes.detail.querySelectorAll('[data-f]').forEach((node) => {
    nodes.fields[node.dataset.f] = node;
  });
  nodes.detail.querySelector('.rd-compare')
    .addEventListener('click', () => addToCompare(model.id));

  nodes.detailBuilt = true;
}

function fillDetail(nodes, model, category) {
  if (!nodes.detailBuilt) buildDetail(nodes, model);

  const text = {
    note: model.note,
    inputPrice: `${formatPrice(model.inputPrice)}`,
    outputPrice: `${formatPrice(model.outputPrice)}`,
    context: model.context,
    speed: `${model.speed} · ${model.speedScore}/100`,
    released: model.released,
    status: model.status,
    strengths: model.strengths.join(' · '),
    weaknesses: model.weaknesses.join(' · '),
    uses: model.uses.join(' · '),
  };
  Object.entries(text).forEach(([key, value]) => {
    if (nodes.fields[key]) nodes.fields[key].textContent = value;
  });

  nodes.fps.forEach((fp) => {
    const value = model.scores[fp.key];
    const rank = rankFor(model, fp.key);
    fp.rank.textContent = `#${rank}`;
    fp.rank.classList.toggle('is-top', rank === 1);
    fp.value.textContent = Math.round(value);
    fp.row.title = model.basis[fp.key];
    // The current category's bar is emphasized so the open row ties back to
    // the column being ranked.
    fp.row.classList.toggle('is-active', fp.key === category);
    fp.bar.style.width = `${value}%`;
  });

  // Re-measure: content (and wrapping) can change with category or viewport.
  nodes.detailHeight = nodes.detail.firstElementChild.offsetHeight;
}

function toggleRow(id) {
  state.expandedId = state.expandedId === id ? null : id;
  renderBoard();
  if (state.expandedId === id) {
    // Replay the capability bars from zero so opening always animates.
    const nodes = rowNodes.get(id);
    if (nodes && nodes.fps) {
      nodes.fps.forEach((fp) => { fp.bar.style.width = '0%'; });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const model = modelById(id);
        nodes.fps.forEach((fp) => { fp.bar.style.width = `${model.scores[fp.key]}%`; });
      }));
    }
  }
}

function addToCompare(id) {
  if (!state.compareIds.includes(id)) {
    if (state.compareIds.length === 3) state.compareIds.shift();
    state.compareIds.push(id);
  }
  showView('compare', { scroll: true });
}

// Keep an open row correctly sized when the viewport changes its wrapping.
let resizeTimer = null;
window.addEventListener('resize', () => {
  if (!state.expandedId) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderBoard, 120);
});

/* ── activity feed ──────────────────────────────────────────────────── */

const FEED_STYLE = {
  new: { glyph: 'NEW', tag: 'tag-accent' },
  price: { glyph: '$', tag: 'tag-outline' },
};

function renderFeed() {
  FEED.forEach((event) => {
    const style = FEED_STYLE[event.type] ?? FEED_STYLE.price;
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = `
      <span class="tag ${style.tag} feed-glyph">${style.glyph}</span>
      <p class="feed-text"></p>
      <span class="feed-time text-muted">${event.time}</span>`;
    item.querySelector('.feed-text').textContent = event.text;
    el.feed.append(item);
  });
}

/* ── pricing ────────────────────────────────────────────────────────── */

function valueScore(model) {
  const blendedPrice = model.inputPrice * 0.35 + model.outputPrice * 0.65;
  return model.scores.overall / Math.pow(blendedPrice + 1, 0.24);
}

function renderPricing() {
  let sorted;
  if (state.pricingMode === 'cheapest') sorted = MODELS.slice().sort((a, b) => a.outputPrice - b.outputPrice);
  else if (state.pricingMode === 'value') sorted = MODELS.slice().sort((a, b) => valueScore(b) - valueScore(a));
  else sorted = MODELS.slice().sort((a, b) => b.outputPrice - a.outputPrice);

  const visible = sorted.slice(0, 10);
  const maxPrice = Math.max(...visible.map((model) => model.outputPrice));
  el.pricingChart.innerHTML = '';

  visible.forEach((model, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'price-row';
    const displayValue = state.pricingMode === 'value'
      ? `${model.scores.overall.toFixed(1)} score · ${formatPrice(model.outputPrice)} out`
      : `${formatPrice(model.outputPrice)} / 1M`;
    const width = state.pricingMode === 'value'
      ? (valueScore(model) / valueScore(visible[0])) * 100
      : Math.max(2, (model.outputPrice / maxPrice) * 100);

    row.innerHTML = `
      <span class="price-rank">${index + 1}</span>
      <span class="price-model"><strong>${model.name}</strong><small>${model.lab}</small></span>
      <span class="price-track"><i style="width:${width.toFixed(1)}%"></i></span>
      <span class="price-value">${displayValue}</span>`;
    row.addEventListener('click', () => openModel(model.id));
    el.pricingChart.append(row);
  });
}

document.querySelectorAll('input[name="pricing"]').forEach((input) => {
  input.addEventListener('change', () => {
    state.pricingMode = input.value;
    renderPricing();
  });
});

/* ── model index and global search ──────────────────────────────────── */

function renderModelIndex(query = '') {
  const normalized = query.trim().toLowerCase();
  const models = MODELS
    .filter((model) => `${model.name} ${model.lab} ${model.tier}`.toLowerCase().includes(normalized))
    .sort((a, b) => b.scores.overall - a.scores.overall);

  el.modelIndex.innerHTML = '';
  models.forEach((model) => {
    const best = bestCategory(model);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'model-index-row';
    row.innerHTML = `
      <span class="index-model"><i class="lab-mark${markClass(model.lab)}">${labMark(model.lab, model.initials)}</i><span><strong>${model.name}</strong><small>${model.lab} · ${model.tier}</small></span></span>
      <span class="index-best"><small>#${rankFor(model, best.key)}</small>${best.label}</span>
      <span class="index-score">${model.scores.overall.toFixed(1)}</span>
      <span class="index-price">${formatPrice(model.inputPrice)} <small>/</small> ${formatPrice(model.outputPrice)}</span>`;
    row.addEventListener('click', () => openModel(model.id));
    el.modelIndex.append(row);
  });

  if (!models.length) {
    el.modelIndex.innerHTML = '<div class="empty-state">No models match that search.</div>';
  }
}

function openModel(id) {
  showView('leaderboard');
  if (state.expandedId !== id) toggleRow(id);
  else renderBoard();
  // Let the row settle into place, then bring it into view.
  requestAnimationFrame(() => {
    const nodes = rowNodes.get(id);
    if (nodes) nodes.root.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

el.modelFilter.addEventListener('input', () => renderModelIndex(el.modelFilter.value));

function renderSearchResults(query = '') {
  const normalized = query.trim().toLowerCase();
  const models = MODELS
    .filter((model) => !normalized || `${model.name} ${model.lab}`.toLowerCase().includes(normalized))
    .sort((a, b) => b.scores.overall - a.scores.overall)
    .slice(0, 7);

  el.searchResults.innerHTML = '';
  models.forEach((model) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result';
    button.innerHTML = `
      <span class="search-avatar${markClass(model.lab)}">${labMark(model.lab, model.initials)}</span>
      <span><strong>${model.name}</strong><small>${model.lab} · ${model.tier}</small></span>
      <span class="search-score"><small>Overall</small>${model.scores.overall.toFixed(1)}</span>`;
    button.addEventListener('click', () => {
      closeSearch();
      openModel(model.id);
    });
    el.searchResults.append(button);
  });
}

function openSearch() {
  el.searchOverlay.hidden = false;
  document.body.classList.add('no-scroll');
  el.globalSearch.value = '';
  renderSearchResults();
  requestAnimationFrame(() => el.globalSearch.focus());
}

function closeSearch() {
  el.searchOverlay.hidden = true;
  document.body.classList.remove('no-scroll');
}

document.getElementById('search').addEventListener('click', openSearch);
document.getElementById('search-close').addEventListener('click', closeSearch);
el.globalSearch.addEventListener('input', () => renderSearchResults(el.globalSearch.value));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !el.searchOverlay.hidden) closeSearch();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openSearch();
  }
});

/* ── lab race ───────────────────────────────────────────────────────── */

function labSnapshot(lab) {
  const models = MODELS.filter((model) => model.lab === lab);
  const categoryBest = Object.fromEntries(SCORE_CATEGORIES.map((category) => [
    category.key,
    models.slice().sort((a, b) => b.scores[category.key] - a.scores[category.key])[0],
  ]));
  const score = SCORE_CATEGORIES.reduce((total, category) =>
    total + categoryBest[category.key].scores[category.key] * category.weight, 0);
  const placements = SCORE_CATEGORIES.map((category) => {
    const model = categoryBest[category.key];
    return { category, model, rank: rankFor(model, category.key), score: model.scores[category.key] };
  }).sort((a, b) => a.rank - b.rank || b.score - a.score);

  return { lab, models, categoryBest, placements, score: Number(score.toFixed(1)) };
}

const LABS = Object.keys(LAB_META).map(labSnapshot).sort((a, b) => b.score - a.score);

function renderLabs() {
  if (!state.selectedLab) state.selectedLab = LABS[0].lab;
  el.labRace.innerHTML = '';

  LABS.forEach((snapshot, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'lab-row';
    row.classList.toggle('is-selected', snapshot.lab === state.selectedLab);
    const top = snapshot.placements.slice(0, 3);
    row.innerHTML = `
      <span class="lab-rank">${index + 1}</span>
      <span class="lab-monogram${markClass(snapshot.lab)}">${labMark(snapshot.lab, LAB_META[snapshot.lab].initials)}</span>
      <span class="lab-name"><strong>${snapshot.lab}</strong><small>${LAB_META[snapshot.lab].note}</small></span>
      <span class="lab-placements">${top.map((item) => `<i>#${item.rank} ${item.category.shortLabel ?? item.category.label}</i>`).join('')}</span>
      <span class="lab-score"><strong>${snapshot.score.toFixed(1)}</strong><small>lineup</small></span>`;
    row.addEventListener('click', () => {
      state.selectedLab = snapshot.lab;
      renderLabs();
    });
    el.labRace.append(row);
  });

  renderLabDetail(state.selectedLab);
}

function renderLabDetail(lab) {
  const snapshot = LABS.find((item) => item.lab === lab);
  const topModel = snapshot.models.slice().sort((a, b) => b.scores.overall - a.scores.overall)[0];
  const priceMin = Math.min(...snapshot.models.map((model) => model.inputPrice));
  const priceMax = Math.max(...snapshot.models.map((model) => model.outputPrice));

  el.labDetail.innerHTML = `
    <div class="lab-detail-head">
      <span class="lab-detail-mark${markClass(lab)}">${labMark(lab, LAB_META[lab].initials)}</span>
      <div><div class="section-kicker">Lab profile</div><h3>${lab}</h3><p class="text-muted">${LAB_META[lab].hq}</p></div>
    </div>
    <div class="lab-statline">
      <span><small>Top model</small><strong>${topModel.name}</strong></span>
      <span><small>Best category</small><strong>${snapshot.placements[0].category.label}</strong></span>
      <span><small>Models tracked</small><strong>${snapshot.models.length}</strong></span>
      <span><small>Price range</small><strong>${formatPrice(priceMin)}–${formatPrice(priceMax)}</strong></span>
    </div>
    <div class="lab-profile">
      ${SCORE_CATEGORIES.map((category) => {
        const model = snapshot.categoryBest[category.key];
        const score = model.scores[category.key];
        return `<div class="lab-profile-row">
          <span>${category.shortLabel ?? category.label}</span>
          <i><b style="width:${score}%"></b></i>
          <strong>${score.toFixed(1)}</strong>
        </div>`;
      }).join('')}
    </div>
    <div class="lab-lineup">
      <div class="section-kicker">Current lineup</div>
      ${snapshot.models.sort((a, b) => b.scores.overall - a.scores.overall).map((model) =>
        `<button type="button" data-open-model="${model.id}"><span>${model.name}</span><small>${model.tier}</small><strong>${model.scores.overall.toFixed(1)}</strong></button>`
      ).join('')}
    </div>`;

  el.labDetail.querySelectorAll('[data-open-model]').forEach((button) => {
    button.addEventListener('click', () => openModel(button.dataset.openModel));
  });
}

/* ── model comparison ───────────────────────────────────────────────── */

function renderCompare() {
  const selected = state.compareIds.map(modelById).filter(Boolean);
  el.compareSlots.innerHTML = '';

  selected.forEach((model) => {
    const slot = document.createElement('div');
    slot.className = 'compare-chip';
    slot.innerHTML = `<i class="lab-mark${markClass(model.lab)}">${labMark(model.lab, model.initials)}</i><span><strong>${model.name}</strong><small>${model.lab}</small></span><button type="button" aria-label="Remove ${model.name}">×</button>`;
    slot.querySelector('button').addEventListener('click', () => {
      if (state.compareIds.length <= 2) return;
      state.compareIds = state.compareIds.filter((id) => id !== model.id);
      renderCompare();
    });
    el.compareSlots.append(slot);
  });

  el.compareSelect.innerHTML = '<option value="">Choose model…</option>';
  MODELS.filter((model) => !state.compareIds.includes(model.id)).forEach((model) => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = `${model.name} — ${model.lab}`;
    el.compareSelect.append(option);
  });
  el.compareSelect.disabled = state.compareIds.length >= 3;

  const wins = Object.fromEntries(selected.map((model) => [model.id, 0]));
  CATEGORIES.forEach((category) => {
    const winner = selected.slice().sort((a, b) => b.scores[category.key] - a.scores[category.key])[0];
    wins[winner.id] += 1;
  });
  const overallWinner = selected.slice().sort((a, b) => b.scores.overall - a.scores.overall)[0];
  const budgetWinner = selected.slice().sort((a, b) => (a.inputPrice + a.outputPrice) - (b.inputPrice + b.outputPrice))[0];
  const speedWinner = selected.slice().sort((a, b) => b.speedScore - a.speedScore)[0];

  el.compareSummary.innerHTML = `
    <div><span class="section-kicker">Best all-rounder</span><strong>${overallWinner.name}</strong><p>${overallWinner.scores.overall.toFixed(1)} Overall with ${wins[overallWinner.id]} category wins.</p></div>
    <div><span class="section-kicker">Budget pick</span><strong>${budgetWinner.name}</strong><p>${formatPrice(budgetWinner.inputPrice)} in and ${formatPrice(budgetWinner.outputPrice)} out per 1M.</p></div>
    <div><span class="section-kicker">Speed pick</span><strong>${speedWinner.name}</strong><p>${speedWinner.speed} responses with a ${speedWinner.speedScore}/100 speed index.</p></div>`;

  el.compareGrid.innerHTML = `
    <div class="compare-grid-head"><span>Capability</span>${selected.map((model) => `<strong>${model.name}</strong>`).join('')}</div>
    ${CATEGORIES.map((category) => {
      const max = Math.max(...selected.map((model) => model.scores[category.key]));
      return `<div class="compare-capability">
        <span>${category.label}</span>
        ${selected.map((model) => {
          const score = model.scores[category.key];
          return `<div class="${score === max ? 'is-winner' : ''}"><i><b style="width:${score}%"></b></i><strong>${score.toFixed(1)}</strong></div>`;
        }).join('')}
      </div>`;
    }).join('')}`;

  const facts = [
    { label: 'Input / 1M', values: selected.map((model) => formatPrice(model.inputPrice)), numeric: selected.map((model) => model.inputPrice), lower: true },
    { label: 'Output / 1M', values: selected.map((model) => formatPrice(model.outputPrice)), numeric: selected.map((model) => model.outputPrice), lower: true },
    { label: 'Context', values: selected.map((model) => model.context), numeric: selected.map((model) => model.contextTokens), lower: false },
    { label: 'Speed', values: selected.map((model) => model.speed), numeric: selected.map((model) => model.speedScore), lower: false },
  ];

  el.compareFacts.innerHTML = `
    <div class="compare-grid-head"><span>Practical detail</span>${selected.map((model) => `<strong>${model.name}</strong>`).join('')}</div>
    ${facts.map((fact) => {
      const winningValue = fact.lower ? Math.min(...fact.numeric) : Math.max(...fact.numeric);
      return `<div class="compare-fact"><span>${fact.label}</span>${fact.values.map((value, index) =>
        `<strong class="${fact.numeric[index] === winningValue ? 'is-winner' : ''}">${value}</strong>`
      ).join('')}</div>`;
    }).join('')}`;
}

el.compareSelect.addEventListener('change', () => {
  if (!el.compareSelect.value || state.compareIds.length >= 3) return;
  state.compareIds.push(el.compareSelect.value);
  renderCompare();
});

/* ── methodology and theme ──────────────────────────────────────────── */

function renderMethodology() {
  el.weightList.innerHTML = SCORE_CATEGORIES.map((category) => `
    <div class="weight-row">
      <span><strong>${category.label}</strong><small>${category.description}</small></span>
      <i><b style="width:${category.weight * 100 * 4}%"></b></i>
      <strong>${Math.round(category.weight * 100)}%</strong>
    </div>`).join('');

  el.sourceList.innerHTML = SOURCES.map((group) => `
    <div class="source-group">
      <strong>${group.label}</strong>
      <span>${group.items.map((item) =>
        `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.name}</a>`
      ).join('')}</span>
    </div>`).join('');
}

function openMethodology() {
  if (typeof el.methodologyDialog.showModal === 'function') el.methodologyDialog.showModal();
}

document.getElementById('methodology-open').addEventListener('click', openMethodology);
document.getElementById('overall-explain').addEventListener('click', openMethodology);

function initTheme() {
  const sync = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    el.themeToggle.setAttribute('aria-pressed', String(dark));
  };
  el.themeToggle.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('benchsy-theme', dark ? 'dark' : 'light'); } catch (error) {}
    sync();
  });
  sync();
}

/* ── boot ───────────────────────────────────────────────────────────── */

document.getElementById('model-count').textContent = `${MODELS.length} models · ${LABS.length} labs`;
document.getElementById('research-date').textContent = `Researched ${RESEARCH_DATE}`;
document.getElementById('research-note').textContent = `Frontier snapshot · ${RESEARCH_DATE}`;
renderCategories();
renderBoard();
renderFeed();
renderModelIndex();
renderMethodology();
initTheme();
showView(location.hash.slice(1) || 'leaderboard', { fromHash: true });
