import { ChildProcess, spawn, spawnSync } from "child_process";
import { existsSync, mkdirSync, rmSync } from "fs";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { QUALITY_PROFILES, SEGMENT_DURATION, type Quality } from "@/config/constants";

/** Normalize paths to forward slashes for FFmpeg on Windows */
function ffmpegPath(p: string): string {
  return p.replace(/\\/g, "/");
}

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
const SESSIONS_DIR = "./tmp/sessions";
const MAX_FORWARD_SEEK = 20;

if (!existsSync(SESSIONS_DIR)) {
  mkdirSync(SESSIONS_DIR, { recursive: true });
}

const IS_WINDOWS = process.platform === "win32";

interface TranscodeSession {
  proc: ChildProcess;
  dir: string;
  startSegment: number;
  quality: Quality;
  createdAt: number;
  lastAccess: number;
  error: string | null;
}

/** Force-kill a process and its entire tree — blocks until dead */
function forceKill(proc: ChildProcess) {
  try {
    if (IS_WINDOWS && proc.pid) {
      // spawnSync blocks until taskkill finishes — process is dead before we return
      spawnSync("taskkill", ["/F", "/T", "/PID", proc.pid.toString()], {
        stdio: "ignore",
        timeout: 5000,
      });
    } else {
      proc.kill("SIGKILL");
    }
  } catch {}
}

// ONE session per media file (not per quality)
const sessions = new Map<string, TranscodeSession>();
const SESSION_TIMEOUT = 5 * 60 * 1000;

// ONE lock per media file
const locks = new Map<string, Promise<void>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  while (locks.has(key)) {
    await locks.get(key);
  }
  let resolve: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  locks.set(key, promise);
  try {
    return await fn();
  } finally {
    locks.delete(key);
    resolve!();
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.lastAccess > SESSION_TIMEOUT) {
      killSession(key);
    }
  }
}, 2 * 60 * 1000);

function killSession(mediaFileId: string) {
  const session = sessions.get(mediaFileId);
  if (!session) return;
  forceKill(session.proc);
  try { rmSync(session.dir, { recursive: true, force: true }); } catch {}
  sessions.delete(mediaFileId);
}

/**
 * Build the -vf filter string.
 */
function buildVideoFilter(height: number, isHdr: boolean): string {
  if (isHdr) {
    return [
      "zscale=t=linear:npl=100",
      "format=gbrpf32le",
      "zscale=p=bt709",
      "tonemap=hable:desat=0",
      "zscale=t=bt709:m=bt709:r=tv",
      `scale=-2:${height}`,
      "format=yuv420p",
    ].join(",");
  }
  return `scale=-2:${height},format=yuv420p`;
}

function startSession(
  filePath: string,
  mediaFileId: string,
  quality: Quality,
  startSegment: number,
  isHdr: boolean,
): TranscodeSession {
  // Kill existing session for this file (whatever quality it was)
  killSession(mediaFileId);

  const dir = join(SESSIONS_DIR, `${mediaFileId}_${quality}`);
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
  mkdirSync(dir, { recursive: true });

  const profile = QUALITY_PROFILES[quality];
  const startTime = startSegment * SEGMENT_DURATION;
  const vf = buildVideoFilter(profile.height, isHdr);

  const args = [
    ...(startTime > 0 ? ["-ss", startTime.toString()] : []),
    "-fflags", "+genpts+discardcorrupt",
    "-i", filePath,
    "-map", "0:v:0",
    "-map", "0:a:0",

    "-c:v", "libx264",
    "-preset", "veryfast",
    "-bf", "0",
    "-crf", profile.crf.toString(),
    "-maxrate", `${profile.bitrate / 1000}k`,
    "-bufsize", `${(profile.bitrate / 1000) * 2}k`,
    "-vf", vf,
    "-colorspace", "bt709",
    "-color_trc", "bt709",
    "-color_primaries", "bt709",

    "-c:a", "aac",
    "-b:a", "192k",
    "-ac", "2",

    "-output_ts_offset", startTime > 0 ? startTime.toString() : "0",

    "-f", "hls",
    "-hls_time", SEGMENT_DURATION.toString(),
    "-hls_segment_type", "mpegts",
    "-hls_segment_filename", ffmpegPath(join(dir, "%d.ts")),
    "-start_number", startSegment.toString(),
    "-hls_flags", "independent_segments",
    "-hls_list_size", "0",
    "-force_key_frames", `expr:gte(t,n_forced*${SEGMENT_DURATION})`,

    "-v", "warning",
    ffmpegPath(join(dir, "playlist.m3u8")),
  ];

  console.log(`[transcode] Starting FFmpeg session: ${quality} from segment ${startSegment}`);

  const proc = spawn(FFMPEG_PATH, args);

  const now = Date.now();
  const session: TranscodeSession = {
    proc, dir, startSegment, quality,
    createdAt: now,
    lastAccess: now,
    error: null,
  };

  proc.stderr.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) {
      console.error(`[ffmpeg ${quality}]`, msg);
      if (msg.includes("Error") || msg.includes("Invalid")) {
        session.error = msg;
      }
    }
  });

  proc.on("error", (err) => {
    console.error(`[ffmpeg spawn error]`, err.message);
    session.error = err.message;
  });

  proc.on("close", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[ffmpeg] exited with code ${code}`);
    }
  });

  sessions.set(mediaFileId, session);
  return session;
}

async function waitForSegmentReady(
  segmentPath: string,
  nextSegmentPath: string,
  proc: ChildProcess,
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now();
  let lastSize = -1;
  let stableCount = 0;

  while (Date.now() - start < timeoutMs) {
    try {
      if (existsSync(segmentPath)) {
        const s = await stat(segmentPath);
        if (s.size > 0) {
          if (existsSync(nextSegmentPath)) return true;
          if (proc.exitCode !== null) return true;
          if (s.size === lastSize) {
            stableCount++;
            if (stableCount >= 2) return true;
          } else {
            stableCount = 0;
          }
          lastSize = s.size;
        }
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

export async function getSegment(
  filePath: string,
  mediaFileId: string,
  quality: Quality,
  segmentIndex: number,
  isHdr: boolean,
): Promise<ReadableStream<Uint8Array> | null> {
  // Fast path: segment on disk from current session (same quality)
  const existing = sessions.get(mediaFileId);
  if (existing && existing.quality === quality) {
    const segPath = join(existing.dir, `${segmentIndex}.ts`);
    const nextSegPath = join(existing.dir, `${segmentIndex + 1}.ts`);
    if (existsSync(segPath)) {
      try {
        const s = await stat(segPath);
        const isComplete =
          existsSync(nextSegPath) ||
          existing.proc.exitCode !== null;
        if (s.size > 0 && isComplete) {
          existing.lastAccess = Date.now();
          const data = await readFile(segPath);
          return toStream(data);
        }
      } catch {}
    }
  }

  // Lock per media file — one session decision at a time
  const sess = await withLock(mediaFileId, async () => {
    const s = sessions.get(mediaFileId);

    // If a session exists for a DIFFERENT quality:
    // - Don't switch if session is fresh (< 10s) — HLS.js ABR is still settling
    // - Otherwise switch to the requested quality
    if (s && s.quality !== quality) {
      if (Date.now() - s.createdAt < 10_000) {
        return null; // Reject — let HLS.js settle on current quality
      }
      return startSession(filePath, mediaFileId, quality, segmentIndex, isHdr);
    }

    // Same quality — check if restart needed
    let needRestart = false;
    if (!s) {
      needRestart = true;
    } else if (segmentIndex < s.startSegment) {
      needRestart = true;
    } else if (s.proc.exitCode !== null) {
      needRestart = true;
    } else if (segmentIndex - s.startSegment > MAX_FORWARD_SEEK) {
      needRestart = true;
    }

    if (needRestart) {
      return startSession(filePath, mediaFileId, quality, segmentIndex, isHdr);
    }

    s!.lastAccess = Date.now();
    return s!;
  });

  // Quality switch rejected — another quality is active
  if (!sess) return null;

  // Wait outside lock — concurrent segment requests can poll in parallel
  const segmentPath = join(sess.dir, `${segmentIndex}.ts`);
  const nextSegmentPath = join(sess.dir, `${segmentIndex + 1}.ts`);
  const found = await waitForSegmentReady(segmentPath, nextSegmentPath, sess.proc, 30000);

  if (!found) {
    // Session might have been replaced — don't log stale errors
    if (sessions.get(mediaFileId) !== sess) return null;
    console.error(`[transcode] Segment ${segmentIndex} timeout. Error: ${sess.error}`);
    return null;
  }

  // Verify session is still the active one before serving
  if (sessions.get(mediaFileId) !== sess) return null;

  const data = await readFile(segmentPath);
  return toStream(data);
}

function toStream(data: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(data));
      controller.close();
    },
  });
}
