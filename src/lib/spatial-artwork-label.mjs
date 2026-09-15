// Use the same five catalogue facts in the live screen label and saved photo.
// In particular, materialAppearance describes a rendering, not the artwork.
const fact = (value) => typeof value === 'string'
  && !/not yet recorded|unassigned|pending|^unknown(?: maker| artist| material| date| region)?$|^undated$|^n\/a$/i.test(value.trim())
  ? value.trim().replace(/\s+/g, ' ') : '';

export function artworkLabelFor(work = {}) {
  return {
    title: fact(work.title),
    period: fact(work.displayDate) || fact(work.era),
    region: fact(work.geography),
    maker: fact(work.maker),
    material: fact(work.medium),
  };
}

export const artworkLabelFacts = (label) => [label.period, label.region, label.material].filter(Boolean).join(' · ');
export const labelFont = '"Inter", "Helvetica Neue", Arial, sans-serif';

function wrapText(context, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= width) { line = candidate; continue; }
    if (line) { lines.push(line); line = ''; }
    // Long unbroken titles must fit too, without dropping factual text.
    for (const character of Array.from(word)) {
      if (line && context.measureText(line + character).width > width) {
        lines.push(line); line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function layoutArtworkLabel(context, label, width, scale = 1) {
  const padding = 16 * scale;
  const rows = [];
  let y = padding;
  const add = (text, size, weight, color) => {
    if (!text) return;
    const font = `${weight} ${size * scale}px ${labelFont}`;
    context.font = font;
    if (rows.length) y += 5 * scale;
    for (const textLine of wrapText(context, text, Math.max(1, width - padding * 2))) {
      rows.push({ text: textLine, x: padding, y, font, color });
      y += size * scale * 1.35;
    }
  };
  add(label.title, 18, 500, '#f7f5ef');
  add(label.maker, 12, 400, '#f7f5ef');
  add(artworkLabelFacts(label), 12, 400, '#c9c6bd');
  return { width, height: Math.ceil(y + padding), rows, scale };
}

export function paintArtworkLabel(context, layout, x = 0, y = 0) {
  context.save();
  context.translate(x, y);
  context.fillStyle = 'rgba(14,22,38,0.88)';
  context.fillRect(0, 0, layout.width, layout.height);
  context.strokeStyle = 'rgba(247,245,239,0.16)';
  context.lineWidth = layout.scale;
  context.strokeRect(layout.scale / 2, layout.scale / 2, layout.width - layout.scale, layout.height - layout.scale);
  context.fillStyle = '#eccf7a';
  context.fillRect(0, 0, 2 * layout.scale, layout.height);
  context.textBaseline = 'top';
  for (const row of layout.rows) {
    context.fillStyle = row.color; context.font = row.font;
    context.fillText(row.text, row.x, row.y);
  }
  context.restore();
}

export function createArtworkLabelCanvas(label, width = 340, scale = 2) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const layout = layoutArtworkLabel(context, label, width * scale, scale);
  canvas.width = layout.width; canvas.height = layout.height;
  paintArtworkLabel(context, layout);
  return canvas;
}

// Called on the composited camera + sculpture image, never the XR canvas alone.
export function stampArtworkPhoto(canvas, label) {
  const context = canvas.getContext('2d');
  const scale = Math.max(0.25, Math.min(canvas.width, canvas.height) / 390);
  const margin = 16 * scale;
  const width = Math.min(340 * scale, canvas.width - 2 * margin);
  let layout = layoutArtworkLabel(context, label, width, scale);
  // Preserve all text for unusually long records, keeping most of the photo clear.
  if (layout.height > canvas.height * 0.38) {
    layout = layoutArtworkLabel(context, label, width, scale * 0.8);
  }
  paintArtworkLabel(context, layout, margin, canvas.height - margin - layout.height);
  return canvas;
}

export const quickLookLabelHeight = (label = {}) => Object.values(label).join(' ').length > 190 ? 'large' : 'medium';

export function quickLookLabelFragment({ fixedScale, pageUrl }) {
  const params = new URLSearchParams({ allowsContentScaling: fixedScale ? '0' : '1', canonicalWebPageURL: pageUrl });
  // Quick Look is the sculpture-only fallback. Never request its bottom banner:
  // it occupies the native shutter area, even when its HTML ignores pointer events.
  return params.toString();
}
