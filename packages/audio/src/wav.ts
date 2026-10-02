/** Planar float audio: one Float32Array per channel, nominal range −1…1. */
export interface PcmAudio {
  sampleRate: number;
  channels: Float32Array[];
}

export const SAMPLE_RATE = 48_000;

export function createAudio(seconds: number, sampleRate = SAMPLE_RATE, channelCount = 2): PcmAudio {
  const length = Math.max(0, Math.round(seconds * sampleRate));
  return { sampleRate, channels: Array.from({ length: channelCount }, () => new Float32Array(length)) };
}

export function frameCount(audio: PcmAudio): number {
  return audio.channels[0]?.length ?? 0;
}

export function audioDuration(audio: PcmAudio): number {
  return frameCount(audio) / audio.sampleRate;
}

export const dbToGain = (db: number): number => 10 ** (db / 20);
export const gainToDb = (gain: number): number => (gain > 0 ? 20 * Math.log10(gain) : Number.NEGATIVE_INFINITY);

/** Sample peak across channels, in dBFS. */
export function peakDb(audio: PcmAudio): number {
  let peak = 0;
  for (const ch of audio.channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]!));
  return gainToDb(peak);
}

export function scale(audio: PcmAudio, gain: number): void {
  for (const ch of audio.channels) for (let i = 0; i < ch.length; i++) ch[i]! *= gain;
}

export type WavEncoding = "pcm16" | "float32";

/** RIFF/WAVE with a canonical 44-byte header. pcm16 clamps to −1…1; float32 keeps overs (used for pre-mixes). */
export function encodeWav(audio: PcmAudio, encoding: WavEncoding = "pcm16"): Buffer {
  const channels = audio.channels.length;
  const frames = frameCount(audio);
  const bytes = encoding === "pcm16" ? 2 : 4;
  const dataSize = frames * channels * bytes;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(encoding === "pcm16" ? 1 : 3, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(audio.sampleRate, 24);
  buf.writeUInt32LE(audio.sampleRate * channels * bytes, 28);
  buf.writeUInt16LE(channels * bytes, 32);
  buf.writeUInt16LE(bytes * 8, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  if (encoding === "pcm16") {
    const out = new Int16Array(buf.buffer, buf.byteOffset + 44, frames * channels);
    for (let c = 0; c < channels; c++) {
      const ch = audio.channels[c]!;
      for (let i = 0; i < frames; i++) {
        const x = ch[i]!;
        out[i * channels + c] = Math.round((x > 1 ? 1 : x < -1 ? -1 : x) * 32767);
      }
    }
  } else {
    const out = new Float32Array(buf.buffer, buf.byteOffset + 44, frames * channels);
    for (let c = 0; c < channels; c++) {
      const ch = audio.channels[c]!;
      for (let i = 0; i < frames; i++) out[i * channels + c] = ch[i]!;
    }
  }
  return buf;
}

/** Decode PCM (8/16/24/32-bit) or IEEE float WAV, including WAVE_FORMAT_EXTENSIBLE and streamed (unsized) data chunks. */
export function decodeWav(input: Uint8Array): PcmAudio {
  const buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE")
    throw new Error("not a RIFF/WAVE file");
  let offset = 12;
  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    let size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
      if (format === 0xfffe && size >= 26) format = buf.readUInt16LE(body + 24);
    } else if (id === "data") {
      if (!channels || !sampleRate) throw new Error("WAV data chunk before fmt chunk");
      if (size === 0 || size === 0xffffffff || body + size > buf.length) size = buf.length - body;
      const bytes = bits / 8;
      const frames = Math.floor(size / (bytes * channels));
      const out: PcmAudio = { sampleRate, channels: Array.from({ length: channels }, () => new Float32Array(frames)) };
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channels; c++) {
          const p = body + (i * channels + c) * bytes;
          let x: number;
          if (format === 3) x = bits === 64 ? buf.readDoubleLE(p) : buf.readFloatLE(p);
          else if (bits === 8) x = (buf[p]! - 128) / 128;
          else if (bits === 16) x = buf.readInt16LE(p) / 32768;
          else if (bits === 24) x = buf.readIntLE(p, 3) / 8388608;
          else x = buf.readInt32LE(p) / 2147483648;
          out.channels[c]![i] = x;
        }
      }
      return out;
    }
    offset = body + size + (size % 2);
  }
  throw new Error("WAV file has no data chunk");
}
