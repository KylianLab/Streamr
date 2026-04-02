import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { determinePlaybackStrategy } from "@/lib/playback-strategy";
import { generateStreamToken } from "@/lib/stream-token";

export async function GET(
  _req: NextRequest,
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

  // Remote stream (IPTV provider) → proxy, skip codec analysis
  if (mediaFile.filePath.startsWith("http://") || mediaFile.filePath.startsWith("https://")) {
    // Safari/iOS cannot play proxied streams without Range support → use HLS transcode
    const ua = _req.headers.get("user-agent") || "";
    const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS/i.test(ua);

    if (isSafari) {
      const token = generateStreamToken(mediaFile.id);
      return NextResponse.json({
        mode: "transcode",
        url: `/api/stream/${mediaFile.id}/master.m3u8?token=${token}`,
        mimeType: "application/vnd.apple.mpegurl",
        needsHlsJs: false,
        duration: mediaFile.duration,
        qualities: [
          { height: 1080, label: "1080p" },
          { height: 720, label: "720p" },
          { height: 480, label: "480p" },
        ],
      });
    }

    return NextResponse.json({
      mode: "direct",
      url: `/api/stream/${mediaFile.id}/direct`,
      mimeType: "video/mp4",
      needsHlsJs: false,
      duration: mediaFile.duration,
    });
  }

  const decision = determinePlaybackStrategy({
    id: mediaFile.id,
    videoCodec: mediaFile.videoCodec,
    audioCodec: mediaFile.audioCodec,
    containerFormat: mediaFile.containerFormat,
    resolution: mediaFile.resolution,
  });

  return NextResponse.json({
    ...decision,
    duration: mediaFile.duration,
  });
}
