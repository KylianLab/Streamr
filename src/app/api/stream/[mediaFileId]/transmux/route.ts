import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { spawn, ChildProcess } from "child_process";

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";

// Track active transmux processes per media file to kill on new seek
const activeProcesses = new Map<string, ChildProcess>();

export const maxDuration = 300; // 5 minutes max for long videos

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mediaFileId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { mediaFileId } = await params;

  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id: mediaFileId },
  });

  if (!mediaFile) {
    return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
  }

  // Kill any existing transmux process for this file
  const existing = activeProcesses.get(mediaFileId);
  if (existing) {
    try { existing.kill("SIGTERM"); } catch {}
    activeProcesses.delete(mediaFileId);
  }

  // Optional seek time and audio transcode flag
  const seekTime = parseFloat(req.nextUrl.searchParams.get("t") || "0");
  const transcodeAudio = req.nextUrl.searchParams.get("transcode_audio") === "1";

  const args = [
    // Seek before input for fast keyframe seek
    ...(seekTime > 0 ? ["-ss", seekTime.toString()] : []),
    "-i", mediaFile.filePath,
    // Copy video — never re-encode
    "-c:v", "copy",
    // Audio: copy if compatible, re-encode to AAC if not
    ...(transcodeAudio
      ? ["-c:a", "aac", "-b:a", "192k", "-ac", "2"]
      : ["-c:a", "copy"]),
    // Fragmented MP4 — delay_moov writes moov after first fragment,
    // so the edit list includes AAC encoder priming compensation
    "-movflags", "frag_keyframe+delay_moov+default_base_moof",
    "-f", "mp4",
    "-v", "warning",
    "pipe:1",
  ];

  const proc = spawn(FFMPEG_PATH, args);
  activeProcesses.set(mediaFileId, proc);

  proc.stderr.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.warn(`[transmux ${mediaFileId}]`, msg);
  });

  proc.on("close", () => {
    // Clean up reference if it's still this process
    if (activeProcesses.get(mediaFileId) === proc) {
      activeProcesses.delete(mediaFileId);
    }
  });

  // Convert Node Readable to Web ReadableStream with safe close handling
  const webStream = new ReadableStream({
    start(controller) {
      proc.stdout.on("data", (chunk: Buffer) => {
        try { controller.enqueue(new Uint8Array(chunk)); } catch {}
      });
      proc.stdout.on("end", () => {
        try { controller.close(); } catch {}
      });
      proc.stdout.on("error", () => {
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      try { proc.kill("SIGTERM"); } catch {}
    },
  });

  // Kill FFmpeg if the client disconnects
  req.signal.addEventListener("abort", () => {
    try { proc.kill("SIGTERM"); } catch {}
  });

  return new Response(webStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "no-cache",
    },
  });
}
