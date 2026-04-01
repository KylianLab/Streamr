import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateXtream } from "@/lib/xtream";
import { stat, createReadStream } from "fs";
import { promisify } from "util";
import { Readable } from "stream";

const fsStat = promisify(stat);

// Same hash used in player_api.php to generate numeric IDs
function numId(uuid: string): number {
  let h = 0;
  const s = uuid.replace(/-/g, "");
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h & 0x7fffffff) || 1;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string; password: string; streamId: string }> }
) {
  const { username, password, streamId } = await params;
  const id = streamId.replace(/\.[^.]+$/, "");

  const cred = await authenticateXtream(username, password);
  if (!cred) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try as UUID (mediaFile ID, then media ID)
  let mediaFile = await prisma.mediaFile.findUnique({ where: { id } });

  if (!mediaFile) {
    mediaFile = await prisma.mediaFile.findFirst({ where: { mediaId: id } });
  }

  // Try as numeric hash → resolve to media UUID, then get its first mediaFile
  if (!mediaFile) {
    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      // Check if it's a hashed media ID
      const allMedia = await prisma.media.findMany({ select: { id: true } });
      const matchedMedia = allMedia.find((m) => numId(m.id) === numericId);
      if (matchedMedia) {
        mediaFile = await prisma.mediaFile.findFirst({ where: { mediaId: matchedMedia.id } });
      }
      // Check if it's a hashed mediaFile ID
      if (!mediaFile) {
        const allFiles = await prisma.mediaFile.findMany({ select: { id: true, filePath: true, containerFormat: true, mediaId: true } });
        const matchedFile = allFiles.find((f) => numId(f.id) === numericId);
        if (matchedFile) {
          mediaFile = await prisma.mediaFile.findUnique({ where: { id: matchedFile.id } });
        }
      }
    }
  }

  if (!mediaFile) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const filePath = mediaFile.filePath;

  // ── Remote stream (IPTV provider) → proxy ─────
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    const headers: Record<string, string> = { "User-Agent": "IPTVSmartersPro" };
    const range = req.headers.get("range");
    if (range) headers["Range"] = range;

    const upstream = await fetch(filePath, { headers }).catch(() => null);
    if (!upstream || (!upstream.ok && upstream.status !== 206)) {
      return new Response("Stream unavailable", { status: 502 });
    }

    const respHeaders = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) respHeaders.set("Content-Type", ct);
    const cl = upstream.headers.get("content-length");
    if (cl) respHeaders.set("Content-Length", cl);
    const cr = upstream.headers.get("content-range");
    if (cr) respHeaders.set("Content-Range", cr);
    respHeaders.set("Accept-Ranges", "bytes");
    respHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  }

  // ── Local file → stream from disk ─────────────
  let fileStats;
  try {
    fileStats = await fsStat(filePath);
  } catch {
    return NextResponse.json({ error: "File inaccessible" }, { status: 404 });
  }

  const fileSize = fileStats.size;
  const range = req.headers.get("range");
  const container = (mediaFile.containerFormat || "").split(",")[0].trim().toLowerCase();
  const mimeType = container === "webm" ? "video/webm" : "video/mp4";

  if (!range) {
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileSize.toString(),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const match = range.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${fileSize}` } });
  }

  const start = parseInt(match[1]);
  const end = match[2] ? parseInt(match[2]) : fileSize - 1;
  if (start >= fileSize || end >= fileSize || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${fileSize}` } });
  }

  const chunkSize = end - start + 1;
  const nodeStream = createReadStream(filePath, { start, end });
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    status: 206,
    headers: {
      "Content-Type": mimeType,
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Content-Length": chunkSize.toString(),
      "Accept-Ranges": "bytes",
    },
  });
}
