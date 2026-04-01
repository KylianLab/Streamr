import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stat, createReadStream } from "fs";
import { promisify } from "util";
import { Readable } from "stream";

const fsStat = promisify(stat);

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

  const filePath = mediaFile.filePath;

  // Remote stream (IPTV provider) → proxy
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    const headers: Record<string, string> = { "User-Agent": "IPTVSmartersPro" };
    const range = req.headers.get("range");
    if (range) headers["Range"] = range;

    const upstream = await fetch(filePath, { headers }).catch(() => null);
    if (!upstream || (!upstream.ok && upstream.status !== 206)) {
      return NextResponse.json({ error: "Stream indisponible" }, { status: 502 });
    }

    const respHeaders = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) respHeaders.set("Content-Type", ct);
    const cl = upstream.headers.get("content-length");
    if (cl) respHeaders.set("Content-Length", cl);
    const cr = upstream.headers.get("content-range");
    if (cr) respHeaders.set("Content-Range", cr);
    respHeaders.set("Accept-Ranges", "bytes");

    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  }

  let fileStats;
  try {
    fileStats = await fsStat(filePath);
  } catch {
    return NextResponse.json({ error: "Fichier inaccessible" }, { status: 404 });
  }

  const fileSize = fileStats.size;
  const range = req.headers.get("range");

  // Determine MIME type from container
  const container = (mediaFile.containerFormat || "").split(",")[0].trim().toLowerCase();
  const mimeType = container === "webm" ? "video/webm" : "video/mp4";

  if (!range) {
    // No range requested — stream entire file
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileSize.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Parse Range header: "bytes=START-END" or "bytes=START-"
  const match = range.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  const start = parseInt(match[1]);
  const end = match[2] ? parseInt(match[2]) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
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
      "Cache-Control": "public, max-age=3600",
    },
  });
}
