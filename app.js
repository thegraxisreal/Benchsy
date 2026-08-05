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
  // Seeded at boot from the live data rather than hardcoded ids, so the
  // default comparison stays meaningful as models come and go. Starts at two,
  // not three, so "Add a model" is usable on arrival instead of disabled.
  compareIds: [],
  // The search overlay serves two jobs: 'open' jumps to a model's profile,
  // 'compare' adds it to the comparison. Same panel, same keyboard handling.
  searchMode: 'open',
};

const COMPARE_MAX = 3;

const el = {
  categories: document.getElementById('categories'),
  board: document.getElementById('board'),
  feed: document.getElementById('feed'),
  themeToggle: document.getElementById('theme-toggle'),
  leaderboardTitle: document.getElementById('leaderboard-title'),
  boardMetaLegend: document.getElementById('board-meta-legend'),
  boardMetaHeading: document.getElementById('board-meta-heading'),
  boardHint: document.getElementById('board-hint'),
  pricingChart: document.getElementById('pricing-chart'),
  modelIndex: document.getElementById('model-index'),
  modelFilter: document.getElementById('model-filter'),
  labRace: document.getElementById('lab-race'),
  labDetail: document.getElementById('lab-detail'),
  compareSlots: document.getElementById('compare-slots'),
  compareSummary: document.getElementById('compare-summary'),
  compareGrid: document.getElementById('compare-grid'),
  compareFacts: document.getElementById('compare-facts'),
  compareAdd: document.getElementById('compare-add'),
  compareAddLabel: document.getElementById('compare-add-label'),
  compareVerdict: document.getElementById('compare-verdict'),
  compareBlank: document.getElementById('compare-blank'),
  compareStages: {
    verdict: document.getElementById('compare-stage-verdict'),
    capability: document.getElementById('compare-stage-capability'),
    cost: document.getElementById('compare-stage-cost'),
  },
  compareShare: document.getElementById('compare-share'),
  compareCard: document.getElementById('compare-card'),
  methodologyDialog: document.getElementById('methodology-dialog'),
  weightList: document.getElementById('weight-list'),
  sourceList: document.getElementById('source-list'),
  searchOverlay: document.getElementById('search-overlay'),
  globalSearch: document.getElementById('global-search'),
  searchResults: document.getElementById('search-results'),
  searchContext: document.getElementById('search-context'),
  searchContextNote: document.getElementById('search-context-note'),
};

const rowHeight = () => ROW_HEIGHT[CONFIG.rowDensity] ?? ROW_HEIGHT.comfortable;
const modelById = (id) => MODELS.find((model) => model.id === id);
const categoryByKey = (key) => CATEGORIES.find((category) => category.key === key);
// Always two decimals: prices sit in aligned columns next to sub-dollar rates.
const hasPublishedPrice = (model) => model.inputPrice != null && model.outputPrice != null;
const formatPrice = (value) => value == null ? '—' : `$${value.toFixed(2)}`;
const totalPrice = (model) => hasPublishedPrice(model)
  ? model.inputPrice + model.outputPrice
  : Number.POSITIVE_INFINITY;
const formatContext = (tokens) => tokens >= 1000000 ? `${tokens / 1000000}M` : `${tokens / 1000}K`;
const sortedFor = (key) => MODELS.slice().sort((a, b) => b.scores[key] - a.scores[key]);
const rankFor = (model, key) => sortedFor(key).findIndex((item) => item.id === model.id) + 1;
const supportsCommunityBuilds = (category) => category === 'overall' || category === 'coding';

/* Lab/model-family logos. Icon marks render inside the circular avatars;
   wordmark-only labs keep their letter monogram, which stays legible where a
   shrunk wordmark would not. Logos are used exactly as provided — never
   recolored — so OpenAI and Anthropic swap to their official dark variant by
   theme, while black-only marks sit on a light plate in dark mode instead.
   Alibaba currently has one tracked model, so its mark is the Qwen family
   symbol; Zhipu uses the GLM/Zhipu symbol. See assets/labs/sources.json. */
const LAB_LOGOS = {
  OpenAI: { file: 'openai', dark: true },
  Anthropic: { file: 'anthropic', dark: true },
  Google: { file: 'google' },
  xAI: { file: 'xai', plate: true },
  'Moonshot AI': { file: 'moonshot', plate: true },
  'Zhipu AI': { file: 'glm', plate: true },
  Alibaba: { file: 'qwen', plate: true },
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
  const classes = `lab-logo lab-logo-${logo.file}`;
  if (logo.dark) {
    return `<img class="${classes} lab-logo-lt" src="${base}" alt="" aria-hidden="true">` +
      `<img class="${classes} lab-logo-dk" src="assets/labs/${logo.file}-dark.svg" alt="" aria-hidden="true">`;
  }
  return `<img class="${classes}" src="${base}" alt="" aria-hidden="true">`;
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

  if (!options.fromHash) history.replaceState(null, '', hashFor(nextView));
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

/* ── hash routing ────────────────────────────────────────────────────
   Views are plain fragments (#pricing), except Compare, which carries its
   selection (#compare=claude-opus-5,grok-4-5) so a comparison can be linked
   and shared — the one thing on this page people actually want to send
   someone. Unknown ids are dropped rather than rendered as blanks. */

function hashFor(view) {
  if (view === 'compare' && state.compareIds.length) {
    return `#compare=${state.compareIds.join(',')}`;
  }
  return `#${view}`;
}

function applyHash() {
  const [view, params] = location.hash.slice(1).split('=');
  if (view === 'compare' && params) {
    const ids = params.split(',')
      .map((id) => decodeURIComponent(id.trim()))
      .filter((id, index, all) => modelById(id) && all.indexOf(id) === index)
      .slice(0, COMPARE_MAX);
    state.compareIds = ids;
  }
  showView(view || 'leaderboard', { fromHash: true });
}

window.addEventListener('hashchange', applyHash);

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

  const showcase = document.createElement('span');
  showcase.className = 'row-showcase';
  showcase.hidden = true;
  showcase.innerHTML = `
    <a class="row-showcase-link" target="_blank" rel="noopener noreferrer">View <span aria-hidden="true">↗</span></a>
    <span class="row-showcase-pending">Soon</span>`;

  root.append(main, showcase, detail);

  const nodes = {
    root, main, detail, detailBuilt: false, detailHeight: 0,
    rank: main.querySelector('.row-rank'),
    name: main.querySelector('.row-name'),
    lab: main.querySelector('.row-lab'),
    bar: main.querySelector('.row-bar'),
    score: main.querySelector('.row-score'),
    change: main.querySelector('.row-change'),
    showcase,
    showcaseLink: showcase.querySelector('.row-showcase-link'),
    showcasePending: showcase.querySelector('.row-showcase-pending'),
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
  const communityMode = supportsCommunityBuilds(category);
  const categoryMeta = categoryByKey(category);
  const h = rowHeight();
  const sorted = sortedFor(category);
  const floor = Math.min(...sorted.map((model) => model.scores[category])) - 3;
  const ceiling = sorted[0].scores[category];

  el.leaderboardTitle.textContent = category === 'overall'
    ? 'Overall leaderboard'
    : `Best AI models for ${categoryMeta.label.toLowerCase()}`;
  el.boardMetaLegend.textContent = communityMode ? 'Community examples' : 'New this month';
  el.boardMetaHeading.textContent = communityMode ? 'Build' : 'New';
  el.boardHint.textContent = communityMode
    ? 'Select a model for its full profile. Community builds are independent examples, not provider endorsements.'
    : 'Select any model to open its full profile.';

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
    nodes.root.style.setProperty('--row-line', `${h}px`);
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

    nodes.showcase.hidden = !communityMode;
    if (communityMode) {
      const build = model.communityBuild;
      nodes.change.className = 'row-change';
      nodes.change.textContent = '';
      nodes.showcaseLink.hidden = !build;
      nodes.showcasePending.hidden = Boolean(build);
      if (build) {
        nodes.showcaseLink.href = build.url;
        nodes.showcaseLink.title = build.name;
        nodes.showcaseLink.setAttribute('aria-label', `View ${build.name}, built with ${model.name}`);
      } else {
        nodes.showcaseLink.removeAttribute('href');
        nodes.showcaseLink.removeAttribute('title');
        nodes.showcaseLink.removeAttribute('aria-label');
      }
    } else {
      const change = changeFor(model.change[category]);
      nodes.change.className = `row-change is-${change.tone ?? 'new'}`;
      nodes.change.innerHTML = change.isNew
        ? '<span class="tag tag-accent">NEW</span>'
        : change.label;
    }

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
          <div class="rd-actions">
            <button type="button" class="btn btn-primary rd-compare">Add to comparison</button>
            <button type="button" class="btn btn-secondary rd-card">Share card</button>
          </div>
        </section>
      </div>
      <section class="rd-community" hidden>
        <div class="rd-community-media" hidden>
          <iframe class="rd-community-frame" title="" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>
          <a class="rd-community-watch" target="_blank" rel="noopener noreferrer">Watch on X <span aria-hidden="true">↗</span></a>
        </div>
        <div class="rd-community-copy">
            <span class="rd-lab">Community build</span>
            <div class="rd-community-head">
              <a class="rd-community-link" target="_blank" rel="noopener noreferrer"></a>
              <span class="rd-community-byline text-muted">
                by <a class="rd-community-creator" target="_blank" rel="noopener noreferrer"></a>
              </span>
            </div>
            <div class="rd-community-tags" aria-label="Project facts"></div>
            <p class="rd-community-summary"></p>
            <ul class="rd-community-highlights"></ul>
            <dl class="rd-community-tools"></dl>
        </div>
      </section>
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

  const cardButton = nodes.detail.querySelector('.rd-card');
  cardButton.addEventListener('click', () => shareModelCard(model, cardButton));

  nodes.community = nodes.detail.querySelector('.rd-community');
  nodes.communityMedia = nodes.detail.querySelector('.rd-community-media');
  nodes.communityFrame = nodes.detail.querySelector('.rd-community-frame');
  nodes.communityWatch = nodes.detail.querySelector('.rd-community-watch');
  nodes.communityLink = nodes.detail.querySelector('.rd-community-link');
  nodes.communityByline = nodes.detail.querySelector('.rd-community-byline');
  nodes.communityCreator = nodes.detail.querySelector('.rd-community-creator');
  nodes.communityTags = nodes.detail.querySelector('.rd-community-tags');
  nodes.communitySummary = nodes.detail.querySelector('.rd-community-summary');
  nodes.communityHighlights = nodes.detail.querySelector('.rd-community-highlights');
  nodes.communityTools = nodes.detail.querySelector('.rd-community-tools');

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

  const communityMode = supportsCommunityBuilds(category);
  const build = model.communityBuild;
  nodes.community.hidden = !communityMode || !build;
  if (build) {
    nodes.communityLink.href = build.url;
    nodes.communityLink.textContent = `${build.name} ↗`;
    nodes.communityLink.setAttribute('aria-label', `View ${build.name}, built with ${model.name}`);

    const media = build.media;
    nodes.community.classList.toggle('has-media', Boolean(media));
    nodes.communityMedia.hidden = !media;
    if (media) {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      const separator = media.embedUrl.includes('?') ? '&' : '?';
      const embedUrl = media.type === 'x-post'
        ? `${media.embedUrl}${separator}theme=${theme}`
        : media.embedUrl;
      if (nodes.communityFrame.dataset.src !== embedUrl) {
        nodes.communityFrame.src = embedUrl;
        nodes.communityFrame.dataset.src = embedUrl;
      }
      nodes.communityFrame.title = media.title;
      nodes.communityWatch.href = media.postUrl;
      nodes.communityWatch.setAttribute('aria-label', `Watch ${media.title} on X`);
    }

    nodes.communityByline.hidden = !build.creator;
    if (build.creator) {
      nodes.communityCreator.href = build.creator.url;
      nodes.communityCreator.textContent = `${build.creator.name} (${build.creator.handle}) ↗`;
      nodes.communityCreator.setAttribute('aria-label', `View ${build.creator.name} on X`);
    }

    nodes.communityTags.replaceChildren(...(build.tags ?? []).map((tag) => {
      const item = document.createElement('span');
      item.className = 'tag tag-accent';
      item.textContent = tag;
      return item;
    }));
    nodes.communitySummary.textContent = build.summary ?? '';
    nodes.communityHighlights.replaceChildren(...(build.highlights ?? []).map((highlight) => {
      const item = document.createElement('li');
      item.textContent = highlight;
      return item;
    }));
    nodes.communityTools.replaceChildren(...(build.tools ?? []).flatMap((tool) => {
      const term = document.createElement('dt');
      term.textContent = tool.name;
      const detail = document.createElement('dd');
      detail.textContent = tool.detail;
      return [term, detail];
    }));
  } else {
    nodes.community.classList.remove('has-media');
    nodes.communityMedia.hidden = true;
    nodes.communityFrame.src = 'about:blank';
    nodes.communityFrame.dataset.src = '';
    nodes.communityFrame.title = '';
    nodes.communityWatch.removeAttribute('href');
    nodes.communityWatch.removeAttribute('aria-label');
    nodes.communityLink.removeAttribute('href');
    nodes.communityLink.removeAttribute('aria-label');
    nodes.communityLink.textContent = '';
    nodes.communityByline.hidden = true;
    nodes.communityCreator.removeAttribute('href');
    nodes.communityCreator.removeAttribute('aria-label');
    nodes.communityCreator.textContent = '';
    nodes.communityTags.replaceChildren();
    nodes.communitySummary.textContent = '';
    nodes.communityHighlights.replaceChildren();
    nodes.communityTools.replaceChildren();
  }

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
  const previousId = state.expandedId;
  if (previousId) {
    const previousNodes = rowNodes.get(previousId);
    if (previousNodes?.communityFrame) {
      previousNodes.communityFrame.src = 'about:blank';
      previousNodes.communityFrame.dataset.src = '';
    }
  }
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
    if (state.compareIds.length === COMPARE_MAX) state.compareIds.shift();
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
  if (!hasPublishedPrice(model)) return Number.NEGATIVE_INFINITY;
  const blendedPrice = model.inputPrice * 0.35 + model.outputPrice * 0.65;
  return model.scores.overall / Math.pow(blendedPrice + 1, 0.24);
}

function renderPricing() {
  const pricedModels = MODELS.filter(hasPublishedPrice);
  let sorted;
  if (state.pricingMode === 'cheapest') sorted = pricedModels.sort((a, b) => a.outputPrice - b.outputPrice);
  else if (state.pricingMode === 'value') sorted = pricedModels.sort((a, b) => valueScore(b) - valueScore(a));
  else sorted = pricedModels.sort((a, b) => b.outputPrice - a.outputPrice);

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
  const adding = state.searchMode === 'compare';
  const normalized = query.trim().toLowerCase();
  // When adding, models already in the comparison are not candidates — showing
  // them would offer a choice that does nothing.
  const pool = adding
    ? MODELS.filter((model) => !state.compareIds.includes(model.id))
    : MODELS;
  const models = pool
    .filter((model) => !normalized || `${model.name} ${model.lab}`.toLowerCase().includes(normalized))
    .sort((a, b) => b.scores.overall - a.scores.overall)
    .slice(0, adding ? 8 : 7);

  el.searchResults.innerHTML = '';
  // Only reachable with a query: the unfiltered pool is never empty, since the
  // tracked set is far larger than a comparison can hold.
  if (!models.length) {
    const empty = document.createElement('p');
    empty.className = 'search-empty text-muted';
    empty.textContent = `No model matches “${query.trim()}”.`;
    el.searchResults.append(empty);
    return;
  }
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
      if (adding) {
        if (state.compareIds.length >= COMPARE_MAX) state.compareIds.shift();
        state.compareIds.push(model.id);
        syncCompare();
      } else {
        openModel(model.id);
      }
    });
    el.searchResults.append(button);
  });
}

function openSearch(mode = 'open') {
  state.searchMode = mode;
  const adding = mode === 'compare';
  el.searchOverlay.hidden = false;
  el.searchOverlay.classList.toggle('is-adding', adding);
  el.searchContext.hidden = !adding;
  if (adding) {
    const remaining = COMPARE_MAX - state.compareIds.length;
    el.searchContextNote.textContent = remaining > 0
      ? `Room for ${remaining} more`
      : `Replaces the first of ${COMPARE_MAX}`;
  }
  el.globalSearch.placeholder = adding
    ? 'Search a model to compare'
    : 'Search models or labs';
  document.body.classList.add('no-scroll');
  el.globalSearch.value = '';
  renderSearchResults();
  requestAnimationFrame(() => el.globalSearch.focus());
}

function closeSearch() {
  el.searchOverlay.hidden = true;
  document.body.classList.remove('no-scroll');
}

document.getElementById('search').addEventListener('click', () => openSearch('open'));
document.getElementById('search-close').addEventListener('click', closeSearch);
el.globalSearch.addEventListener('input', () => renderSearchResults(el.globalSearch.value));
// Type, hit Enter, done — the top hit is almost always the one meant, and
// reaching for the mouse to confirm it is the slow part of a search picker.
el.globalSearch.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  el.searchResults.querySelector('.search-result')?.click();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !el.searchOverlay.hidden) closeSearch();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openSearch('open');
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
  const pricedModels = snapshot.models.filter(hasPublishedPrice);
  const priceRange = pricedModels.length
    ? `${formatPrice(Math.min(...pricedModels.map((model) => model.inputPrice)))}–${formatPrice(Math.max(...pricedModels.map((model) => model.outputPrice)))}`
    : 'Not published';

  el.labDetail.innerHTML = `
    <div class="lab-detail-head">
      <span class="lab-detail-mark${markClass(lab)}">${labMark(lab, LAB_META[lab].initials)}</span>
      <div><div class="section-kicker">Lab profile</div><h3>${lab}</h3><p class="text-muted">${LAB_META[lab].hq}</p></div>
    </div>
    <div class="lab-statline">
      <span><small>Top model</small><strong>${topModel.name}</strong></span>
      <span><small>Best category</small><strong>${snapshot.placements[0].category.label}</strong></span>
      <span><small>Models tracked</small><strong>${snapshot.models.length}</strong></span>
      <span><small>Price range</small><strong>${priceRange}</strong></span>
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

  selected.forEach((model, index) => {
    const slot = document.createElement('div');
    slot.className = 'compare-chip';
    slot.dataset.col = String(index + 1);
    slot.innerHTML = `
      <i class="lab-mark${markClass(model.lab)}">${labMark(model.lab, model.initials)}</i>
      <span class="compare-chip-id"><strong>${model.name}</strong><small>${model.lab} · ${model.tier}</small></span>
      <span class="compare-chip-score"><b>${model.scores.overall.toFixed(1)}</b><small>Overall</small></span>
      <button type="button" class="compare-chip-x" aria-label="Remove ${model.name}">×</button>`;
    const remove = slot.querySelector('button');
    remove.title = `Remove ${model.name}`;
    remove.addEventListener('click', () => {
      state.compareIds = state.compareIds.filter((id) => id !== model.id);
      syncCompare();
    });
    el.compareSlots.append(slot);
  });

  const count = selected.length;
  const full = count >= COMPARE_MAX;
  // The empty slot is the primary "what do I do here" affordance, so it states
  // the remaining capacity rather than sitting as a bare frame.
  el.compareAdd.classList.toggle('is-full', full);
  el.compareAdd.querySelector('.compare-add-text').textContent = full
    ? `${COMPARE_MAX} of ${COMPARE_MAX} — remove one to swap in another`
    : `Add a model (${count} of ${COMPARE_MAX})`;
  el.compareAddLabel.textContent = count
    ? `${count} selected · up to ${COMPARE_MAX}`
    : 'Nothing selected';

  /* The page is built from an empty selection upward: nothing to show with no
     models, a single profile with one, and only then a comparison. Each stage
     appears when it has something true to say. */
  const comparing = count > 1;
  el.compareBlank.hidden = count > 0;
  el.compareStages.verdict.hidden = count === 0;
  el.compareStages.capability.hidden = count === 0;
  el.compareStages.cost.hidden = count === 0;
  el.compareSummary.hidden = !comparing;
  // A link to nothing and a "vs" card of one model are both broken shares.
  el.compareShare.disabled = count === 0;
  el.compareCard.disabled = !comparing;
  el.compareCard.title = comparing ? '' : 'Pick two models to make a comparison card';
  if (count === 0) return;

  /* Category wins count the six capabilities only. Overall is a weighted
     composite of those six, so counting it too would let one model bank the
     same advantage twice. Ties credit every model that tied. */
  const wins = Object.fromEntries(selected.map((model) => [model.id, 0]));
  SCORE_CATEGORIES.forEach((category) => {
    const best = Math.max(...selected.map((model) => model.scores[category.key]));
    selected.filter((model) => model.scores[category.key] === best)
      .forEach((model) => { wins[model.id] += 1; });
  });
  const overallWinner = selected.slice().sort((a, b) => b.scores.overall - a.scores.overall)[0];
  const budgetWinner = selected.filter(hasPublishedPrice).sort((a, b) => totalPrice(a) - totalPrice(b))[0];
  const speedWinner = selected.slice().sort((a, b) => b.speedScore - a.speedScore)[0];

  const winCount = (model) => `${wins[model.id]} of ${SCORE_CATEGORIES.length} capability wins`;

  /* One plain sentence before any table. The whole point of this view is a
     decision, and most of them come down to "the strongest one, unless the
     cheap one is close enough" — so state that gap in words first. */
  const byOverall = selected.slice().sort((a, b) => b.scores.overall - a.scores.overall);
  const margin = byOverall.length > 1
    ? byOverall[0].scores.overall - byOverall[1].scores.overall
    : 0;
  if (!comparing) {
    // A single model has no tradeoff to state, so the sentence describes it and
    // says plainly what the second pick would buy you.
    const only = selected[0];
    const strongest = bestCategory(only);
    el.compareVerdict.innerHTML =
      `<strong>${only.name}</strong> scores ${only.scores.overall.toFixed(1)} Overall, strongest in ${strongest.label} at ${only.scores[strongest.key].toFixed(1)}. Add a second model to turn this into a comparison.`;
  } else {

  const leadClause = `<strong>${overallWinner.name}</strong> leads on capability — ${overallWinner.scores.overall.toFixed(1)} Overall, ${margin < 0.05 ? 'level with' : `${margin.toFixed(1)} ahead of`} ${byOverall[1].name}, taking ${winCount(overallWinner)}.`;
  let costClause = '';
  if (budgetWinner && budgetWinner.id === overallWinner.id) {
    costClause = ' It is also the cheapest here, so this one is an easy call.';
  } else if (budgetWinner && hasPublishedPrice(overallWinner)) {
    const ratio = totalPrice(overallWinner) / totalPrice(budgetWinner);
    // The gap that matters here is the leader's lead over the *cheap* model,
    // which is rarely the runner-up used in the sentence above.
    const budgetGap = overallWinner.scores.overall - budgetWinner.scores.overall;
    costClause = ` But <strong>${budgetWinner.name}</strong> costs about ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× less per token, and gives up ${budgetGap.toFixed(1)} points of Overall to get there — the right trade at volume, the wrong one when quality is the job.`;
  } else if (budgetWinner) {
    costClause = ` <strong>${budgetWinner.name}</strong> is the cheapest of the set at ${formatPrice(budgetWinner.outputPrice)} per 1M out.`;
  }
  el.compareVerdict.innerHTML = leadClause + costClause;

  const summaryCard = (kicker, model, note) => `
    <div>
      <span class="section-kicker">${kicker}</span>
      ${model
        ? `<span class="compare-summary-name"><i class="lab-mark${markClass(model.lab)}">${labMark(model.lab, model.initials)}</i><strong>${model.name}</strong></span>`
        : '<strong>No public rate</strong>'}
      <p>${note}</p>
    </div>`;
  el.compareSummary.innerHTML =
    summaryCard('Pick for quality', overallWinner, `Highest composite score, with ${winCount(overallWinner)}.`) +
    summaryCard('Pick for budget', budgetWinner, budgetWinner
      ? `${formatPrice(budgetWinner.inputPrice)} in and ${formatPrice(budgetWinner.outputPrice)} out per 1M tokens.`
      : 'The selected models do not publish comparable per-token pricing.') +
    summaryCard('Pick for speed', speedWinner, `${speedWinner.speed} responses — a ${speedWinner.speedScore}/100 speed index.`);
  }

  /* Every score in the set sits between roughly 79 and 98, so bars drawn as a
     raw percentage all render nearly full and communicate nothing. Anchor the
     scale just below the weakest value on show — the same technique the
     leaderboard uses — so the gaps people came here to see are visible. */
  const shown = selected.flatMap((model) => CATEGORIES.map((c) => model.scores[c.key]));
  const floor = Math.min(...shown) - 4;
  const ceiling = Math.max(...shown);
  const barWidth = (score) => Math.max(8, ((score - floor) / (ceiling - floor)) * 100);

  // Column headers repeat the model identity in both tables: once you have
  // scrolled past the picker, "which column is which" is the question that
  // stops people reading, and initials alone did not answer it.
  const columnHead = (leadLabel) => `
    <div class="compare-grid-head">
      <span class="compare-grid-lead">${leadLabel}</span>
      ${selected.map((model, index) => `
        <span class="compare-col" data-col="${index + 1}">
          <i class="lab-mark${markClass(model.lab)}">${labMark(model.lab, model.initials)}</i>
          <span><strong>${model.name}</strong><small>${model.lab}</small></span>
        </span>`).join('')}
    </div>`;

  el.compareGrid.innerHTML = columnHead('Capability') +
    CATEGORIES.map((category) => {
      const max = Math.max(...selected.map((model) => model.scores[category.key]));
      return `<div class="compare-capability${category.key === 'overall' ? ' is-overall' : ''}">
        <span class="compare-row-label" title="${category.description}">${category.label}</span>
        ${selected.map((model) => {
          const score = model.scores[category.key];
          const winner = comparing && score === max;
          // Losing cells carry the gap, not just their own number: a bare 87.7
          // next to a 97.0 still leaves the reader doing the subtraction.
          const tag = !comparing ? '' : (winner ? 'Best' : `−${(max - score).toFixed(1)}`);
          return `<div class="${winner ? 'is-winner' : ''}">
            <i><b style="width:${barWidth(score).toFixed(1)}%"></b></i>
            <strong>${score.toFixed(1)}</strong>
            <em class="compare-delta">${tag}</em>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

  const times = (value) => value >= 10 ? `${Math.round(value)}×` : `${value.toFixed(1)}×`;
  const facts = [
    {
      label: 'Input / 1M', hint: 'lower is better', lower: true,
      values: selected.map((model) => formatPrice(model.inputPrice)),
      numeric: selected.map((model) => model.inputPrice),
      note: (value, best) => value > best ? `${times(value / best)} the cheapest` : '',
    },
    {
      label: 'Output / 1M', hint: 'lower is better', lower: true,
      values: selected.map((model) => formatPrice(model.outputPrice)),
      numeric: selected.map((model) => model.outputPrice),
      note: (value, best) => value > best ? `${times(value / best)} the cheapest` : '',
    },
    {
      label: 'Context window', hint: 'higher is better', lower: false,
      values: selected.map((model) => model.context),
      numeric: selected.map((model) => model.contextTokens),
      note: (value, best) => value < best ? `${Math.round((value / best) * 100)}% of the largest` : '',
    },
    {
      label: 'Speed', hint: 'higher is better', lower: false,
      values: selected.map((model) => model.speed),
      numeric: selected.map((model) => model.speedScore),
      note: (value) => `${value}/100 index`,
      winnerNote: (value) => `Best · ${value}/100`,
    },
  ];

  el.compareFacts.innerHTML = columnHead('Practical detail') +
    facts.map((fact) => {
      const comparable = fact.numeric.filter((value) => value != null && value > 0);
      const winningValue = comparable.length
        ? (fact.lower ? Math.min(...comparable) : Math.max(...comparable))
        : null;
      return `<div class="compare-fact">
        <span class="compare-row-label">${fact.label}<em>${fact.hint}</em></span>
        ${fact.values.map((value, index) => {
          const numeric = fact.numeric[index];
          const winner = comparing && numeric != null && numeric === winningValue;
          const note = numeric == null || winningValue == null ? ''
            : (winner
              ? (fact.winnerNote ? fact.winnerNote(numeric) : 'Best')
              : fact.note(numeric, winningValue));
          return `<div class="${winner ? 'is-winner' : ''}">
            <strong>${value}</strong>
            ${note ? `<em class="compare-delta">${note}</em>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

  // The grids were hardcoded to three columns, which left a phantom empty
  // column whenever two models were compared. Drive the track count instead.
  [el.compareGrid, el.compareFacts].forEach((node) => {
    node.style.setProperty('--compare-cols', String(selected.length));
  });
}

/* Render, then keep the address bar in step so the URL is always shareable. */
function syncCompare() {
  renderCompare();
  history.replaceState(null, '', hashFor('compare'));
}

// Picking from 17 models is a search problem, not a dropdown one — reuse the
// site's own search panel so the two feel like the same control.
el.compareAdd.addEventListener('click', () => openSearch('compare'));

el.compareShare.addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}${hashFor('compare')}`;
  const done = (text) => {
    el.compareShare.textContent = text;
    setTimeout(() => { el.compareShare.textContent = 'Copy link'; }, 1800);
  };
  try {
    await navigator.clipboard.writeText(url);
    done('Copied');
  } catch {
    // Clipboard access can be denied or unavailable over insecure origins;
    // selecting the URL still lets the user copy it by hand.
    window.prompt('Copy this comparison link', url);
    done('Copy link');
  }
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
    if (state.expandedId) renderBoard();
  });
  sync();
}

/* ── research age ────────────────────────────────────────────────────
   The board is a hand-researched snapshot, so it goes stale on its own.
   Rather than let it quietly misrepresent the field, the hero states how
   old it is and escalates tone as it ages. */

const AGE_TIERS = [
  { maxDays: 14, tone: 'fresh' },
  { maxDays: 45, tone: 'aging' },
  { maxDays: Infinity, tone: 'stale' },
];

function researchAge() {
  const researched = new Date(`${RESEARCH_ISO}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.round((today - researched) / 86400000));

  let label;
  if (days === 0) label = 'researched today';
  else if (days === 1) label = 'researched yesterday';
  else if (days < 14) label = `${days} days old`;
  else if (days < 60) label = `${Math.round(days / 7)} weeks old`;
  else label = `${Math.round(days / 30)} months old`;

  const tone = AGE_TIERS.find((tier) => days <= tier.maxDays).tone;
  return { days, label, tone };
}

/* ── boot ───────────────────────────────────────────────────────────── */

const age = researchAge();
document.getElementById('model-count').textContent = `${MODELS.length} models · ${LABS.length} labs`;
document.getElementById('research-date').textContent = `Researched ${RESEARCH_DATE}`;
document.getElementById('research-note').textContent = `Frontier snapshot · ${RESEARCH_DATE}`;

const ageEl = document.getElementById('research-age');
ageEl.textContent = age.label;
ageEl.dataset.tone = age.tone;
ageEl.title = age.tone === 'fresh'
  ? 'This snapshot is current.'
  : 'The model landscape moves fast — figures may no longer reflect the current field.';
/* Seed the default comparison with the strongest model against the best
   value pick: two models that actually disagree, so the page demonstrates a
   real tradeoff instead of opening on an arbitrary trio. */
const strongest = MODELS.slice().sort((a, b) => b.scores.overall - a.scores.overall)[0];
const bestValue = MODELS.slice()
  .sort((a, b) => valueScore(b) - valueScore(a))
  .find((model) => model.id !== strongest.id);
state.compareIds = [strongest.id, bestValue.id];

renderCategories();
renderBoard();
renderFeed();
renderModelIndex();
renderMethodology();
initTheme();
applyHash();
