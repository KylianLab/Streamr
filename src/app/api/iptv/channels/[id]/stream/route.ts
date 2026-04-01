import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FETCH_HEADERS = {
  "User-Agent": "IPTVSmartersPro",
  "Accept": "*/*",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  const channel = await prisma.iptvChannel.findUnique({
    where: { id, isActive: true },
  });

  if (!channel) {
    return NextResponse.json({ error: "Chaîne non trouvée" }, { status: 404 });
  }

  const streamUrl = channel.streamUrl;

  // For HLS streams (.m3u8), fetch and rewrite segment URLs to proxy through us
  if (streamUrl.includes(".m3u8")) {
    const upstream = await fetch(streamUrl, { headers: FETCH_HEADERS }).catch(() => null);
    if (!upstream || !upstream.ok) {
      return new Response("Stream unavailable", { status: 502 });
    }

    let body = await upstream.text();

    // Rewrite relative URLs in the M3U8 to absolute URLs proxied through us
    const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);
    body = body.replace(/^(?!#)((?!https?:\/\/).+)$/gm, (line) => {
      const absolute = line.startsWith("/")
        ? new URL(line, streamUrl).href
        : baseUrl + line;
      // Proxy segment/sub-playlist through our endpoint
      return `/api/iptv/channels/${id}/stream?url=${encodeURIComponent(absolute)}`;
    });

    return new Response(body, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Check if this is a proxied sub-request (segment or sub-playlist)
  const proxyUrl = req.nextUrl.searchParams.get("url");
  if (proxyUrl) {
    const upstream = await fetch(proxyUrl, { headers: FETCH_HEADERS }).catch(() => null);
    if (!upstream || !upstream.ok) {
      return new Response("Segment unavailable", { status: 502 });
    }

    const ct = upstream.headers.get("content-type") || "video/mp2t";
    const isM3U8 = proxyUrl.includes(".m3u8") || ct.includes("mpegurl");

    if (isM3U8) {
      // Sub-playlist: rewrite URLs too
      let body = await upstream.text();
      const subBase = proxyUrl.substring(0, proxyUrl.lastIndexOf("/") + 1);
      body = body.replace(/^(?!#)((?!https?:\/\/).+)$/gm, (line) => {
        const absolute = line.startsWith("/")
          ? new URL(line, proxyUrl).href
          : subBase + line;
        return `/api/iptv/channels/${id}/stream?url=${encodeURIComponent(absolute)}`;
      });
      return new Response(body, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Binary segment (TS, AAC, etc.)
    return new Response(upstream.body, {
      headers: {
        "Content-Type": ct,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Non-HLS stream: direct proxy
  const upstream = await fetch(streamUrl, {
    headers: {
      ...FETCH_HEADERS,
      ...(req.headers.get("range") ? { Range: req.headers.get("range")! } : {}),
    },
  }).catch(() => null);

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
