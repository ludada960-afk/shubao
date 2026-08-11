function waitFor(target, event, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`等待 ${event} 超时`)), timeoutMs);
    const done = () => { clearTimeout(timer); target.removeEventListener('error', failed); resolve(); };
    const failed = () => { clearTimeout(timer); target.removeEventListener(event, done); reject(new Error('素材无法读取')); };
    target.addEventListener(event, done, { once: true });
    target.addEventListener('error', failed, { once: true });
  });
}

async function imageMetadata(file) {
  if (typeof globalThis.createImageBitmap === 'function') {
    const bitmap = await globalThis.createImageBitmap(file);
    const result = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return result;
  }
  const source = URL.createObjectURL(file);
  const image = new Image();
  image.src = source;
  try {
    await waitFor(image, 'load');
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(source);
  }
}

async function videoMetadata(file) {
  const source = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.src = source;
  try {
    await waitFor(video, 'loadedmetadata');
    const duration = Number(video.duration) || 0;
    const frameTimes = [0.12, 0.5, 0.88].map(ratio => Math.max(0, Math.min(duration - 0.05, duration * ratio)));
    const frames = [];
    for (const [index, time] of frameTimes.entries()) {
      video.currentTime = time;
      await waitFor(video, 'seeked');
      const scale = Math.min(1, 960 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((video.videoWidth || 1) * scale));
      canvas.height = Math.max(1, Math.round((video.videoHeight || 1) * scale));
      canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (blob) frames.push({
        file: new File([blob], `${file.name || 'video'}-frame-${index + 1}.jpg`, { type: 'image/jpeg' }),
        frameAt: Number(time.toFixed(2)),
      });
    }
    return { duration, width: video.videoWidth, height: video.videoHeight, frames };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(source);
  }
}

async function audioMetadata(file) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return { duration: 0, audioEnergy: [], dynamics: 'unknown' };
  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const bucketCount = 12;
    const size = Math.max(1, Math.floor(channel.length / bucketCount));
    const energy = Array.from({ length: bucketCount }, (_, index) => {
      const start = index * size;
      const end = Math.min(channel.length, start + size);
      let sum = 0;
      for (let offset = start; offset < end; offset += 32) sum += Math.abs(channel[offset]);
      return Number((sum / Math.max(1, Math.ceil((end - start) / 32))).toFixed(3));
    });
    const spread = Math.max(...energy) - Math.min(...energy);
    return {
      duration: Number(buffer.duration.toFixed(2)),
      audioEnergy: energy,
      dynamics: spread > 0.18 ? 'dynamic' : spread > 0.07 ? 'moderate' : 'steady',
    };
  } finally {
    await context.close().catch(() => {});
  }
}

export async function inspectVideoPlanningFiles(groups = {}) {
  const manifest = [];
  const frames = [];
  for (const [group, files] of Object.entries(groups)) {
    for (const file of files || []) {
      const type = String(file.type || '').toLowerCase();
      if (type.startsWith('image/')) {
        manifest.push({ name: file.name, kind: 'image', role: group, ...(await imageMetadata(file)) });
      } else if (type.startsWith('video/')) {
        const metadata = await videoMetadata(file);
        manifest.push({ name: file.name, kind: 'video', role: group, duration: metadata.duration, width: metadata.width, height: metadata.height });
        for (const frame of metadata.frames) {
          frames.push(frame.file);
          manifest.push({ name: frame.file.name, kind: 'video_frame', role: `${group}_keyframe`, frameAt: frame.frameAt, width: metadata.width, height: metadata.height });
        }
      } else if (type.startsWith('audio/')) {
        manifest.push({ name: file.name, kind: 'audio', role: group, ...(await audioMetadata(file)) });
      }
    }
  }
  return { manifest, frames };
}
