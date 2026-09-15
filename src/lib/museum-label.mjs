// Catalogue facts only: rendering materials and display-size defaults are not
// historical artwork metadata. Unknown placeholders are left out of the label.
const fact = value => typeof value === 'string'
  && !/not yet recorded|unassigned|pending|^unknown(?: maker| artist| material| date| region)?$|^undated$|^n\/a$/i.test(value.trim())
  ? value.trim().replace(/\s+/g, ' ') : '';

export function museumLabelFor(work = {}) {
  return { title: fact(work.title), maker: fact(work.maker),
    period: fact(work.displayDate) || fact(work.era), region: fact(work.geography), material: fact(work.medium) };
}

export const museumLabelLines = label => [
  label.title, label.maker, [label.period, label.region].filter(Boolean).join(' · '), label.material,
].filter(Boolean);
export const museumLabelFont = '"Inter", "Helvetica Neue", Arial, sans-serif';

export function wrapMuseumLabelText(context, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= width) { line = next; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const character of Array.from(word)) {
      if (line && context.measureText(line + character).width > width) { lines.push(line); line = ''; }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function layoutMuseumPhotoLabel(context, label, width, height, corner = 'left') {
  const scale = Math.min(width, height) / 390;
  const margin = 20 * scale;
  const available = Math.min(320 * scale, width * (width > height ? .43 : .86), width - margin * 2);
  const groups = [[label.title, 16, 500], [label.maker, 11, 400],
    [[label.period, label.region].filter(Boolean).join(' · '), 10.5, 400], [label.material, 10.5, 400]];
  let rows, y, factor = 1;
  do {
    rows = []; y = 0;
    for (const [text, size, weight] of groups) {
      if (!text) continue;
      const font = `${weight} ${size * scale * factor}px ${museumLabelFont}`;
      context.font = font;
      if (rows.length) y += 3 * scale * factor;
      for (const line of wrapMuseumLabelText(context, text, available)) {
        rows.push({ text: line, y, font, size: size * scale * factor });
        y += size * scale * factor * 1.4;
      }
    }
    if (y <= height * .34 || factor <= .5) break;
    factor *= .9;
  } while (true);
  const textWidth = rows.reduce((maximum, row) => {
    context.font = row.font;
    return Math.max(maximum, context.measureText(row.text).width);
  }, 0);
  return { rows, width: textWidth, height: y, scale, factor,
    x: corner === 'right' ? width - margin - textWidth : margin, y: height - margin - y };
}

// No rectangle, rule or watermark. A close dark halo keeps white lettering
// readable on light photographs without placing a panel over the sculpture.
export function paintMuseumPhotoLabel(context, layout) {
  context.save();
  context.textBaseline = 'top';
  context.fillStyle = '#fff';
  context.strokeStyle = 'rgba(0,0,0,.58)';
  context.lineJoin = 'round';
  context.shadowColor = 'rgba(0,0,0,.7)';
  context.shadowBlur = 2.5 * layout.scale;
  context.shadowOffsetY = .5 * layout.scale;
  for (const row of layout.rows) {
    context.font = row.font;
    context.lineWidth = Math.max(.6 * layout.scale, row.size * .075);
    context.strokeText(row.text, layout.x, layout.y + row.y);
    context.fillText(row.text, layout.x, layout.y + row.y);
  }
  context.restore();
}

export function captionMuseumPhoto(source, label, corner = 'left') {
  const canvas = document.createElement('canvas');
  canvas.width = source.width; canvas.height = source.height;
  const context = canvas.getContext('2d');
  context.drawImage(source, 0, 0);
  const layout = layoutMuseumPhotoLabel(context, label, canvas.width, canvas.height, corner);
  paintMuseumPhotoLabel(context, layout);
  return canvas;
}
