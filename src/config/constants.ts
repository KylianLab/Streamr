export const SITE_NAME = "Streamr";

export const QUALITY_PROFILES = {
  "1080p": { height: 1080, bitrate: 6000000, crf: 23, label: "1080p" },
  "720p": { height: 720, bitrate: 3500000, crf: 24, label: "720p" },
  "480p": { height: 480, bitrate: 1500000, crf: 26, label: "480p" },
} as const;

export type Quality = keyof typeof QUALITY_PROFILES;

export const SEGMENT_DURATION = 6; // seconds per HLS segment

export const VIDEO_EXTENSIONS = [
  ".mkv", ".mp4", ".avi", ".webm", ".mov", ".wmv", ".flv", ".m4v",
];

export const SUBTITLE_EXTENSIONS = [".srt", ".vtt", ".ass", ".ssa"];

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export const AVATAR_OPTIONS = [
  "/images/avatars/avatar-1.png",
  "/images/avatars/avatar-2.png",
  "/images/avatars/avatar-3.png",
  "/images/avatars/avatar-4.png",
  "/images/avatars/avatar-5.png",
  "/images/avatars/avatar-6.png",
];

export const AVATAR_COLORS = [
  "#e50914", "#b81d24", "#221f1f",
  "#f5f5f1", "#0078ff", "#00c853",
  "#ff6d00", "#aa00ff", "#ffab00",
];
