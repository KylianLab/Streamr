import { spawn } from "child_process";
import { QUALITY_PROFILES, SEGMENT_DURATION, type Quality } from "@/config/constants";

const FFPROBE_PATH = process.env.FFPROBE_PATH || "ffprobe";

export interface ProbeResult {
  duration: number;
  videoCodec: string;
  audioCodec: string;
  resolution: string;
  bitrate: number;
  channels: number;
  containerFormat: string;
  isHdr: boolean;
}

export async function probeFile(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFPROBE_PATH, [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath,
    ]);

    let output = "";
    proc.stdout.on("data", (data) => { output += data; });
    proc.stderr.on("data", () => {});

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
        return;
      }

      try {
        const info = JSON.parse(output);
        const videoStream = info.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
        const audioStream = info.streams?.find((s: { codec_type: string }) => s.codec_type === "audio");

        // Detect HDR via transfer characteristics or color primaries
        const HDR_TRANSFERS = new Set(["smpte2084", "arib-std-b67"]); // PQ, HLG
        const colorTransfer = (videoStream?.color_transfer || "").toLowerCase();
        const isHdr = HDR_TRANSFERS.has(colorTransfer);

        resolve({
          duration: Math.floor(parseFloat(info.format?.duration || "0")),
          videoCodec: videoStream?.codec_name || "unknown",
          audioCodec: audioStream?.codec_name || "unknown",
          resolution: videoStream
            ? `${videoStream.width}x${videoStream.height}`
            : "unknown",
          bitrate: Math.floor(parseInt(info.format?.bit_rate || "0") / 1000),
          channels: audioStream?.channels || 2,
          containerFormat: info.format?.format_name?.split(",")[0] || "unknown",
          isHdr,
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export function generateMasterPlaylist(
  mediaFileId: string,
  availableQualities: Quality[] = ["1080p", "720p", "480p"]
): string {
  let playlist = "#EXTM3U\n";

  for (const quality of availableQualities) {
    const profile = QUALITY_PROFILES[quality];
    const width = Math.round((profile.height * 16) / 9);
    playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${profile.bitrate},RESOLUTION=${width}x${profile.height},NAME="${profile.label}"\n`;
    playlist += `/api/stream/${mediaFileId}/${quality}/playlist.m3u8\n`;
  }

  return playlist;
}

export function generateQualityPlaylist(
  mediaFileId: string,
  quality: Quality,
  totalDuration: number
): string {
  const segmentCount = Math.ceil(totalDuration / SEGMENT_DURATION);

  let playlist = "#EXTM3U\n";
  playlist += `#EXT-X-VERSION:3\n`;
  playlist += `#EXT-X-TARGETDURATION:${SEGMENT_DURATION + 1}\n`;
  playlist += `#EXT-X-MEDIA-SEQUENCE:0\n`;

  for (let i = 0; i < segmentCount; i++) {
    const segDuration =
      i === segmentCount - 1
        ? totalDuration - i * SEGMENT_DURATION
        : SEGMENT_DURATION;
    playlist += `#EXTINF:${segDuration.toFixed(3)},\n`;
    playlist += `/api/stream/${mediaFileId}/${quality}/${i}.ts\n`;
  }

  playlist += "#EXT-X-ENDLIST\n";
  return playlist;
}

export function getAvailableQualities(resolution: string): Quality[] {
  const match = resolution.match(/(\d+)x(\d+)/);
  if (!match) return ["480p"];

  const height = parseInt(match[2]);
  const qualities: Quality[] = [];

  if (height >= 1080) qualities.push("1080p");
  if (height >= 720) qualities.push("720p");
  qualities.push("480p");

  return qualities;
}
