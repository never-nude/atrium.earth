const gap = 24;
const area = rect => Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
const intersection = (a, b) => area({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Screen-space rectangles only. Never apply artwork rotations to label text.
export function artworkLabelPlacements(view, size, artwork) {
  const rect = (side, x, y, space = 0) => ({ side, left: x, top: y, right: x + size.width, bottom: y + size.height, space });
  const bottom = view.bottom - size.height;
  const fallbacks = [rect('bottom-left', view.left, bottom), rect('bottom-right', view.right - size.width, bottom)];
  if (!artwork) return fallbacks;
  // A side label may straddle the sculpture's vertical center. Requiring its
  // first line to be below the sculpture's top wastes usable landscape space.
  const sideTop = Math.max(view.top, artwork.top - size.height + Math.min(gap, artwork.bottom - artwork.top));
  const spaces = [
    { side: 'below', left: view.left, right: view.right, top: Math.max(view.top, artwork.bottom + gap), bottom: view.bottom },
    { side: 'left', left: view.left, right: Math.min(view.right, artwork.left - gap), top: sideTop, bottom: view.bottom },
    { side: 'right', left: Math.max(view.left, artwork.right + gap), right: view.right, top: sideTop, bottom: view.bottom },
  ];
  const choices = spaces.filter(space => space.right - space.left >= size.width && space.bottom - space.top >= size.height)
    .map(space => rect(space.side,
      space.side === 'left' ? space.left : space.side === 'right' ? space.right - size.width
        : clamp((artwork.left + artwork.right - size.width) / 2, space.left, space.right - size.width),
      space.side === 'below' ? bottom : clamp((artwork.top + artwork.bottom - size.height) / 2, space.top, bottom),
      area(space)))
    .sort((a, b) => b.space - a.space);
  if (choices.length) return choices;
  // If the work fills the view, use the bottom corner with least overlap. Keep
  // all five facts and leave the entire shutter/control row free.
  return fallbacks.sort((a, b) => intersection(a, artwork) - intersection(b, artwork));
}

export function labelPlacementIsClear(rect, view, artwork) {
  if (rect.left < view.left || rect.right > view.right || rect.top < view.top || rect.bottom > view.bottom) return false;
  if (!artwork) return true;
  return rect.top >= artwork.bottom + gap
    || ((rect.right <= artwork.left - gap || rect.left >= artwork.right + gap)
      && rect.bottom >= artwork.top + Math.min(gap, artwork.bottom - artwork.top));
}
