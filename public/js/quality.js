// On-device frame quality guard: a blind user cannot see that a photo is dark or
// blurry, so check before spending a network round-trip on a useless frame.

const SAMPLE_WIDTH = 160;
export const DARK_THRESHOLD = 40; // mean luminance 0-255
export const BLUR_THRESHOLD = 15; // variance of the Laplacian

/** Pure function so it can be unit-tested without a DOM. gray: luminance array (0-255). */
export function frameStats(gray, w, h) {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  const brightness = sum / gray.length;

  // 4-neighbour Laplacian; low variance = few edges = blur.
  let n = 0;
  let mean = 0;
  let m2 = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      n += 1;
      const d = lap - mean;
      mean += d / n;
      m2 += d * (lap - mean);
    }
  }
  const sharpness = n > 1 ? m2 / (n - 1) : 0;
  return { brightness: Math.round(brightness), sharpness: Math.round(sharpness) };
}

export function verdict({ brightness, sharpness }, { needSharp = false } = {}) {
  if (brightness < DARK_THRESHOLD) return 'tooDark';
  if (needSharp && sharpness < BLUR_THRESHOLD) return 'blurry';
  return 'ok';
}

/** Browser wrapper: analyse a canvas (e.g. the captured frame). */
export function checkCanvas(canvas, opts) {
  const h = Math.max(1, Math.round((canvas.height / canvas.width) * SAMPLE_WIDTH));
  const small = document.createElement('canvas');
  small.width = SAMPLE_WIDTH;
  small.height = h;
  const ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, SAMPLE_WIDTH, h);
  const { data } = ctx.getImageData(0, 0, SAMPLE_WIDTH, h);
  const gray = new Float32Array(SAMPLE_WIDTH * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const stats = frameStats(gray, SAMPLE_WIDTH, h);
  return { ...stats, result: verdict(stats, opts) };
}
