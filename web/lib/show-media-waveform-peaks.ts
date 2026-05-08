/** Client decode cap for waveform strip — files over this skip peak generation (see portal / producer copy). */
export const SHOW_MEDIA_WAVEFORM_DECODE_MAX_BYTES = 35 * 1024 * 1024;

/** Down-sample absolute amplitude peaks for canvas strip (deterministic tests; runs in AudioContext.decode callback as well). */
export function peaksFromChannelData(samples: Float32Array, bucketCount: number): number[] {
  const n = samples.length;
  if (n === 0 || bucketCount <= 0) return [];
  const peaks: number[] = [];
  const samplesPerBucket = n / bucketCount;
  for (let b = 0; b < bucketCount; b++) {
    const start = Math.floor(b * samplesPerBucket);
    const end = Math.min(n, Math.floor((b + 1) * samplesPerBucket));
    let max = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(samples[i] ?? 0);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  return peaks;
}

export function peaksFromAudioBuffer(buffer: AudioBuffer, bucketCount = 180): number[] {
  return peaksFromChannelData(buffer.getChannelData(0), bucketCount);
}
