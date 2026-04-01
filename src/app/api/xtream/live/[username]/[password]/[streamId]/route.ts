import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateXtream } from "@/lib/xtream";

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

  // Strip extension from streamId (e.g. "abc123.m3u8" -> "abc123")
  const id = streamId.replace(/\.[^.]+$/, "");

  const cred = await authenticateXtream(username, password);
  if (!cred) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try as UUID first
  let channel = await prisma.iptvChannel.findUnique({
    where: { id, isActive: true },
  });

  // Try as numeric hash
  if (!channel) {
    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      const allChannels = await prisma.iptvChannel.findMany({
        where: { isActive: true },
        select: { id: true, streamUrl: true },
      });
      const matched = allChannels.find((ch) => numId(ch.id) === numericId);
      if (matched) {
        channel = await prisma.iptvChannel.findUnique({
          where: { id: matched.id, isActive: true },
        });
      }
    }
  }

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Proxy the stream through our server (hide provider URL from client)
  const upstreamRes = await fetch(channel.streamUrl, {
    headers: {
      "User-Agent": "IPTVSmartersPro",
      "Accept": "*/*",
      // Forward range requests for seeking
      ...(req.headers.get("range") ? { Range: req.headers.get("range")! } : {}),
    },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);

  if (!upstreamRes || !upstreamRes.ok) {
    return new Response("Stream unavailable", { status: 502 });
  }

  // Pass through the upstream response with appropriate headers
  const headers = new Headers();
  const contentType = upstreamRes.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const contentLength = upstreamRes.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = upstreamRes.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Access-Control-Allow-Origin", "*");
  // Prevent caching of live streams
  headers.set("Cache-Control", "no-cache, no-store");

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers,
  });
}
