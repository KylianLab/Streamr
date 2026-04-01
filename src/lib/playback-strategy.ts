import type { Quality } from "@/config/constants";

export type PlaybackMode = "direct" | "transmux" | "transcode";

export interface PlaybackDecision {
  mode: PlaybackMode;
  url: string;
  mimeType: string;
  needsHlsJs: boolean;
  /** true when video is copied but audio needs re-encoding to AAC */
  transcodeAudio?: boolean;
  qualities?: Quality[];
}

// Containers the browser can play natively
const DIRECT_PLAY_CONTAINERS = new Set(["mp4", "webm", "ogg", "m4v"]);

// Containers that can be remuxed to fMP4 without re-encoding
const TRANSMUXABLE_CONTAINERS = new Set(["mkv", "avi", "flv", "wmv"]);

// Video codecs browsers can decode natively
const COMPATIBLE_VIDEO_CODECS = new Set(["h264", "vp8", "vp9", "av1"]);

// Audio codecs browsers can decode natively
const COMPATIBLE_AUDIO_CODECS = new Set(["aac", "mp3", "opus", "vorbis", "flac"]);

// ffprobe format_name → canonical container name
const FORMAT_MAP: Record<string, string> = {
  mov: "mp4",
  matroska: "mkv",
  webm: "webm",
  ogg: "ogg",
  avi: "avi",
  flv: "flv",
  asf: "wmv",
  mp4: "mp4",
  m4v: "m4v",
};

function normalizeContainer(ffprobeFormat: string): string {
  const first = ffprobeFormat.split(",")[0].trim().toLowerCase();
  return FORMAT_MAP[first] || first;
}

function normalizeCodec(codec: string): string {
  return codec.trim().toLowerCase();
}

function getAvailableQualities(resolution: string): Quality[] {
  const match = resolution.match(/(\d+)x(\d+)/);
  if (!match) return ["480p"];

  const height = parseInt(match[2]);
  const qualities: Quality[] = [];
  if (height >= 1080) qualities.push("1080p");
  if (height >= 720) qualities.push("720p");
  qualities.push("480p");
  return qualities;
}

interface MediaFileInfo {
  id: string;
  videoCodec: string | null;
  audioCodec: string | null;
  containerFormat: string | null;
  resolution: string | null;
}

export function determinePlaybackStrategy(media: MediaFileInfo): PlaybackDecision {
  const baseUrl = `/api/stream/${media.id}`;

  // Missing metadata → safe fallback
  if (!media.videoCodec || !media.audioCodec || !media.containerFormat) {
    return {
      mode: "transcode",
      url: `${baseUrl}/master.m3u8`,
      mimeType: "application/vnd.apple.mpegurl",
      needsHlsJs: true,
      qualities: getAvailableQualities(media.resolution || ""),
    };
  }

  const container = normalizeContainer(media.containerFormat);
  const videoCodec = normalizeCodec(media.videoCodec);
  const audioCodec = normalizeCodec(media.audioCodec);

  const videoOk = COMPATIBLE_VIDEO_CODECS.has(videoCodec);
  const audioOk = COMPATIBLE_AUDIO_CODECS.has(audioCodec);

  if (videoOk && audioOk) {
    // Both codecs compatible
    if (DIRECT_PLAY_CONTAINERS.has(container)) {
      return {
        mode: "direct",
        url: `${baseUrl}/direct`,
        mimeType: container === "webm" ? "video/webm" : "video/mp4",
        needsHlsJs: false,
      };
    }

    if (TRANSMUXABLE_CONTAINERS.has(container)) {
      return {
        mode: "transmux",
        url: `${baseUrl}/transmux`,
        mimeType: "video/mp4",
        needsHlsJs: false,
      };
    }
  }

  if (videoOk && !audioOk) {
    // Video OK but audio incompatible (AC3, DTS, EAC3, TrueHD, etc.)
    // Transmux with audio re-encode — copy video, transcode audio to AAC
    return {
      mode: "transmux",
      url: `${baseUrl}/transmux?transcode_audio=1`,
      mimeType: "video/mp4",
      needsHlsJs: false,
      transcodeAudio: true,
    };
  }

  // Fallback: full HLS transcode
  return {
    mode: "transcode",
    url: `${baseUrl}/master.m3u8`,
    mimeType: "application/vnd.apple.mpegurl",
    needsHlsJs: true,
    qualities: getAvailableQualities(media.resolution || ""),
  };
}
