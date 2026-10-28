// Camera access and frame capture.

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

function sourceSize(src) {
  return src instanceof HTMLVideoElement
    ? { w: src.videoWidth, h: src.videoHeight }
    : { w: src.naturalWidth, h: src.naturalHeight };
}

/** Grab a JPEG frame, downscaled so uploads stay small and fast (~60-120 KB). */
export function grabFrame(src, maxSide = 768, quality = 0.72) {
  const { w, h } = sourceSize(src);
  if (!w || !h) return null;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL('image/jpeg', quality).split(',')[1];
  return { mimeType: 'image/jpeg', data, width: w, height: h, canvas };
}

export { sourceSize };
