import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { determinePlaybackStrategy } from "@/lib/playback-strategy";

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

  // Remote stream (IPTV provider) → direct proxy, skip codec analysis
  if (mediaFile.filePath.startsWith("http://") || mediaFile.filePath.startsWith("https://")) {
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
