/* Shareable cards.
   Renders a model or a comparison as a 1200x630 PNG — the standard social
   ratio — drawn directly on a canvas. No libraries and no backend: the card
   is built from the same data the page renders, so it can never disagree
   with the board, and it works offline.

   Depends on data.js (MODELS, CATEGORIES, RESEARCH_DATE) and on app.js for
   LAB_LOGOS, rankFor, formatPrice, and CARD_SITE_URL. */

const CARD = {
  width: 1200,
  height: 630,
  scale: 2,          // drawn at 2x so text stays crisp when scaled up
  pad: 64,
  bg: '#171615',
  text: '#f2efec',
  muted: 'rgba(242, 239, 236, 0.58)',
  faint: 'rgba(242, 239, 236, 0.16)',
  accent: '#e1ad66',
  accentDeep: '#b68235',
  track: 'rgba(242, 239, 236, 0.13)',
  heading: '"Cormorant Garamond", Georgia, serif',
  body: '"Lora", Georgia, serif',
};

const SITE_URL = 'thegraxisreal.github.io/Benchsy';

/* Webfonts are loaded by CSS, but canvas will silently fall back to a system
   serif unless the exact weight/size combinations are resolved first. */
let fontsReady = null;
function ensureFonts() {
  if (fontsReady) return fontsReady;
  const faces = [
    `600 64px ${CARD.heading}`, `600 88px ${CARD.heading}`, `600 22px ${CARD.heading}`,
    `400 18px ${CARD.body}`, `600 18px ${CARD.body}`, `400 13px ${CARD.body}`,
  ];
  fontsReady = document.fonts
    ? Promise.all(faces.map((f) => document.fonts.load(f))).then(() => document.fonts.ready)
    : Promise.resolve();
  return fontsReady;
}

const imageCache = new Map();
function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);   // a missing logo must not fail the card
    img.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

/* Lab marks are SVG. On a dark card use the light-on-dark variant, and float
   the two black-only marks on a light plate exactly as the UI does. */
function labLogoSrc(lab) {
  const logo = LAB_LOGOS[lab];
  if (!logo) return null;
  return `assets/labs/${logo.file}${logo.dark ? '-dark' : ''}.svg`;
}

async function drawLabMark(ctx, lab, initials, cx, cy, r) {
  const logo = LAB_LOGOS[lab];
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (logo && logo.plate) {
    ctx.fillStyle = '#f4f2ef';
    ctx.fill();
  } else {
    ctx.strokeStyle = CARD.faint;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.clip();

  const src = labLogoSrc(lab);
  const img = src ? await loadImage(src) : null;
  if (img) {
    const size = r * 1.15;
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = CARD.text;
    ctx.font = `600 ${Math.round(r)}px ${CARD.heading}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials || lab.slice(0, 1), cx, cy + 1);
  }
  ctx.restore();
}

function kicker(ctx, text, x, y, color = CARD.muted) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `400 13px ${CARD.body}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.14em';
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.restore();
}

/* Greedy wrap that also hard-truncates, so an unexpectedly long model name
   can never push the layout off the card. */
function wrap(ctx, text, maxWidth, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function bar(ctx, x, y, width, height, fraction, color) {
  const r = height / 2;
  ctx.fillStyle = CARD.track;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
  ctx.fill();
  const filled = Math.max(height, width * Math.min(Math.max(fraction, 0), 1));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, filled, height, r);
  ctx.fill();
}

function newCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = CARD.width * CARD.scale;
  canvas.height = CARD.height * CARD.scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(CARD.scale, CARD.scale);
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

function drawChrome(ctx) {
  ctx.fillStyle = CARD.bg;
  ctx.fillRect(0, 0, CARD.width, CARD.height);

  const bloom = ctx.createRadialGradient(150, -60, 0, 150, -60, 780);
  bloom.addColorStop(0, 'rgba(182, 130, 53, 0.22)');
  bloom.addColorStop(1, 'rgba(182, 130, 53, 0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, CARD.width, CARD.height);

  // brand
  ctx.fillStyle = CARD.accentDeep;
  ctx.beginPath();
  ctx.arc(CARD.pad + 5, 66, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CARD.accent;
  ctx.font = `600 27px ${CARD.heading}`;
  ctx.textAlign = 'left';
  ctx.fillText('Benchsy', CARD.pad + 20, 75);

  // footer
  const footY = CARD.height - 52;
  ctx.strokeStyle = CARD.faint;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CARD.pad, footY);
  ctx.lineTo(CARD.width - CARD.pad, footY);
  ctx.stroke();

  ctx.fillStyle = CARD.muted;
  ctx.font = `400 14px ${CARD.body}`;
  ctx.textAlign = 'left';
  ctx.fillText(SITE_URL, CARD.pad, footY + 26);
  ctx.textAlign = 'right';
  ctx.fillText(`Researched ${RESEARCH_DATE}`, CARD.width - CARD.pad, footY + 26);
  ctx.textAlign = 'left';
}

/* ── model card ─────────────────────────────────────────────────────── */

async function drawModelCard(model) {
  await ensureFonts();
  const { canvas, ctx } = newCanvas();
  drawChrome(ctx);

  await drawLabMark(ctx, model.lab, model.initials, CARD.pad + 26, 152, 26);

  const nameX = CARD.pad + 68;
  ctx.fillStyle = CARD.text;
  ctx.font = `600 54px ${CARD.heading}`;
  const nameLines = wrap(ctx, model.name, 620, 2);
  nameLines.forEach((line, i) => ctx.fillText(line, nameX, 150 + i * 52));

  ctx.fillStyle = CARD.muted;
  ctx.font = `400 17px ${CARD.body}`;
  ctx.fillText(`${model.lab} · ${model.tier}`, nameX, 150 + nameLines.length * 52 - 12);

  // overall, right-aligned
  const rank = rankFor(model, 'overall');
  ctx.textAlign = 'right';
  kickerRight(ctx, `Overall · Rank ${rank} of ${MODELS.length}`, CARD.width - CARD.pad, 108);
  ctx.fillStyle = CARD.accent;
  ctx.font = `600 84px ${CARD.heading}`;
  ctx.fillText(model.scores.overall.toFixed(1), CARD.width - CARD.pad, 178);
  ctx.textAlign = 'left';

  // capability grid: two columns of three
  const colW = 500;
  const gap = 72;
  const startY = 262;
  const rowH = 62;
  const scores = SCORE_CATEGORIES.map((c) => model.scores[c.key]);
  const floor = Math.min(...scores) - 6;
  const ceiling = Math.max(...scores);

  SCORE_CATEGORIES.forEach((category, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = CARD.pad + col * (colW + gap);
    const y = startY + row * rowH;
    const score = model.scores[category.key];

    kicker(ctx, category.label, x, y);
    ctx.fillStyle = CARD.text;
    ctx.font = `600 20px ${CARD.heading}`;
    ctx.textAlign = 'right';
    ctx.fillText(score.toFixed(1), x + colW, y);
    ctx.textAlign = 'left';
    bar(ctx, x, y + 12, colW, 7, (score - floor) / (ceiling - floor), CARD.accent);
  });

  // practical facts
  const factY = 500;
  const facts = [
    ['Price / 1M', `${formatPrice(model.inputPrice)} in · ${formatPrice(model.outputPrice)} out`],
    ['Context', model.context],
    ['Speed', model.speed],
  ];
  facts.forEach(([label, value], index) => {
    const x = CARD.pad + index * 360;
    kicker(ctx, label, x, factY);
    ctx.fillStyle = CARD.text;
    ctx.font = `600 22px ${CARD.heading}`;
    ctx.fillText(value, x, factY + 28);
  });

  return canvas;
}

function kickerRight(ctx, text, x, y) {
  ctx.save();
  ctx.fillStyle = CARD.muted;
  ctx.font = `400 13px ${CARD.body}`;
  ctx.textAlign = 'right';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.14em';
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.restore();
}

/* ── comparison card ────────────────────────────────────────────────── */

async function drawCompareCard(models) {
  await ensureFonts();
  const { canvas, ctx } = newCanvas();
  drawChrome(ctx);

  ctx.fillStyle = CARD.text;
  ctx.font = `600 46px ${CARD.heading}`;
  const title = models.map((m) => m.name).join('  vs  ');
  const titleLines = wrap(ctx, title, CARD.width - CARD.pad * 2, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, CARD.pad, 148 + i * 46));

  const labelW = 250;
  const colGap = 26;
  const cols = models.length;
  const available = CARD.width - CARD.pad * 2 - labelW;
  const colW = (available - colGap * (cols - 1)) / cols;
  const colX = (i) => CARD.pad + labelW + i * (colW + colGap);

  /* Rows are measured into the space that's actually left rather than fixed,
     so a two-line title (three models, long names) can't push the price strip
     down into the footer. */
  const headY = 148 + (titleLines.length - 1) * 46 + 62;
  const priceY = CARD.height - 82;
  const rowsTop = headY + 48;
  const rowH = Math.min(42, (priceY - 46 - rowsTop) / CATEGORIES.length);
  models.forEach((model, i) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(colX(i), headY - 20, colW, 30);
    ctx.clip();
    kicker(ctx, model.name, colX(i), headY);
    ctx.restore();
  });
  ctx.strokeStyle = CARD.faint;
  ctx.beginPath();
  ctx.moveTo(CARD.pad, headY + 14);
  ctx.lineTo(CARD.width - CARD.pad, headY + 14);
  ctx.stroke();

  const all = models.flatMap((m) => CATEGORIES.map((c) => m.scores[c.key]));
  const floor = Math.min(...all) - 5;
  const ceiling = Math.max(...all);

  let y = rowsTop;
  CATEGORIES.forEach((category) => {
    const best = Math.max(...models.map((m) => m.scores[category.key]));
    const isOverall = category.key === 'overall';

    ctx.fillStyle = isOverall ? CARD.text : CARD.muted;
    ctx.font = `${isOverall ? 600 : 400} 17px ${CARD.body}`;
    ctx.fillText(category.label, CARD.pad, y + 4);

    models.forEach((model, i) => {
      const score = model.scores[category.key];
      const win = score === best;
      const x = colX(i);
      ctx.fillStyle = win ? CARD.accent : CARD.text;
      ctx.font = `600 ${isOverall ? 24 : 20}px ${CARD.heading}`;
      ctx.textAlign = 'right';
      ctx.fillText(score.toFixed(1), x + colW, y + 4);
      ctx.textAlign = 'left';
      bar(ctx, x, y + 14, colW, 6, (score - floor) / (ceiling - floor),
        win ? CARD.accent : 'rgba(242, 239, 236, 0.34)');
    });
    y += rowH;
  });

  // price strip, anchored above the footer
  ctx.strokeStyle = CARD.faint;
  ctx.beginPath();
  ctx.moveTo(CARD.pad, priceY - 24);
  ctx.lineTo(CARD.width - CARD.pad, priceY - 24);
  ctx.stroke();

  ctx.fillStyle = CARD.muted;
  ctx.font = `400 17px ${CARD.body}`;
  ctx.fillText('Price / 1M', CARD.pad, priceY);
  const cheapest = Math.min(...models.map((m) => m.inputPrice + m.outputPrice));
  models.forEach((model, i) => {
    const win = model.inputPrice + model.outputPrice === cheapest;
    ctx.fillStyle = win ? CARD.accent : CARD.text;
    ctx.font = `600 19px ${CARD.heading}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${formatPrice(model.inputPrice)} / ${formatPrice(model.outputPrice)}`,
      colX(i) + colW, priceY);
    ctx.textAlign = 'left';
  });

  return canvas;
}

/* ── export ─────────────────────────────────────────────────────────── */

function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* Copy to clipboard where the browser allows it, and always leave the user
   with the file. Clipboard image writes need a secure context and are absent
   in some browsers, so a download is the guaranteed path, never the fallback
   nobody gets. */
async function exportCard(canvas, filename, button) {
  const blob = await canvasBlob(canvas);
  if (!blob) return;

  let copied = false;
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      copied = true;
    }
  } catch {
    copied = false;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  if (button) {
    const original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = copied ? 'Copied & saved' : 'Card saved';
    button.disabled = true;
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 2200);
  }
}

async function shareModelCard(model, button) {
  const canvas = await drawModelCard(model);
  await exportCard(canvas, `benchsy-${slug(model.name)}.png`, button);
}

async function shareCompareCard(models, button) {
  const canvas = await drawCompareCard(models);
  await exportCard(canvas, `benchsy-${models.map((m) => slug(m.name)).join('-vs-')}.png`, button);
}

/* Wired here rather than in app.js so the card feature stays self-contained:
   remove this script and the product still works. */
document.getElementById('compare-card').addEventListener('click', (event) => {
  const models = state.compareIds.map(modelById).filter(Boolean);
  if (models.length) shareCompareCard(models, event.currentTarget);
});
