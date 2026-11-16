import sharp from 'sharp';

// Fractional 8-bit sRGB difference, evaluated on the original/candidate overlap.
// The local score isolates small changes that a whole-object average hides.
export const visualThresholds = Object.freeze({
  meanColour: .025,
  silhouette: .015,
  localDetail: .045,
});

const patchSize = 24;
const patchStep = 4;

export async function measureVisualDifference(original, candidate) {
  const [source, delivery] = await Promise.all([original, candidate].map(input =>
    sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  const { width, height, channels } = source.info;
  if (channels !== 4 || width !== delivery.info.width || height !== delivery.info.height ||
      channels !== delivery.info.channels || width < patchSize || height < patchSize) {
    throw new Error('Matched renders must have the same RGBA dimensions');
  }

  const stride = width + 1;
  const detailSum = new Float64Array(stride * (height + 1));
  const detailCount = new Uint32Array(detailSum.length);
  const difference = Buffer.alloc(width * height * 4);
  const from = source.data;
  const to = delivery.data;
  const pixelInBoth = index => from[index + 3] >= 128 && to[index + 3] >= 128;
  let common = 0;
  let union = 0;
  let colourSum = 0;
  for (let y = 0; y < height; y += 1) {
    let rowDetail = 0;
    let rowCount = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (from[offset + 3] >= 128 || to[offset + 3] >= 128) union += 1;
      if (pixelInBoth(offset)) {
        common += 1;
        let colour = 0;
        for (let channel = 0; channel < 3; channel += 1) {
          colour += Math.abs(from[offset + channel] - to[offset + channel]);
        }
        colour /= 3 * 255;
        colourSum += colour;
        difference[offset] = Math.min(255, colour * 2040);
        difference[offset + 1] = Math.min(175, colour * 420);
        difference[offset + 3] = 255;

        // Compare edges after cancelling smoothly varying colour and lighting
        // changes. Requiring an object interior keeps antialiasing at the
        // silhouette from dominating this small-feature measurement.
        const radius = 2;
        const left = offset - radius * 4;
        const right = offset + radius * 4;
        const above = offset - radius * width * 4;
        const below = offset + radius * width * 4;
        if (x >= radius && x < width - radius && y >= radius && y < height - radius &&
            [left, right, above, below].every(pixelInBoth)) {
          let edge = 0;
          for (let channel = 0; channel < 3; channel += 1) {
            const residual = index => from[index + channel] - to[index + channel];
            edge += Math.abs(residual(offset) -
              (residual(left) + residual(right) + residual(above) + residual(below)) / 4);
          }
          rowDetail += edge / (3 * 255);
          rowCount += 1;
        }
      } else if (from[offset + 3] >= 128 || to[offset + 3] >= 128) {
        difference[offset + 2] = 255;
        difference[offset + 3] = 255;
      }
      const position = (y + 1) * stride + x + 1;
      detailSum[position] = detailSum[position - stride] + rowDetail;
      detailCount[position] = detailCount[position - stride] + rowCount;
    }
  }
  if (!common) throw new Error('Matched renders have no shared foreground');

  let localDetail = 0;
  let patch = null;
  const total = (integral, x, y) => {
    const top = y * stride;
    const bottom = (y + patchSize) * stride;
    return integral[bottom + x + patchSize] - integral[bottom + x] -
      integral[top + x + patchSize] + integral[top + x];
  };
  for (let y = 0; y <= height - patchSize; y += patchStep) {
    for (let x = 0; x <= width - patchSize; x += patchStep) {
      const count = total(detailCount, x, y);
      if (count < patchSize ** 2 * .7) continue;
      const detail = total(detailSum, x, y) / count;
      if (detail <= localDetail) continue;
      localDetail = detail;
      patch = { x, y, size: patchSize };
    }
  }
  const scores = { meanColour: colourSum / common, silhouette: 1 - common / union, localDetail };
  const exceeded = Object.keys(visualThresholds).filter(name => scores[name] > visualThresholds[name]);
  const heatmap = await sharp(difference, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { scores, exceeded, patch, heatmap };
}
