import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQualityPlaylist } from "@/lib/ffmpeg";
import { Quality, QUALITY_PROFILES } from "@/config/constants";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mediaFileId: string; quality: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { mediaFileId, quality } = await params;

  if (!(quality in QUALITY_PROFILES)) {
    return NextResponse.json({ error: "Qualité invalide" }, { status: 400 });
  }

  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id: mediaFileId },
  });

  if (!mediaFile || !mediaFile.duration) {
    return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
  }

  const playlist = generateQualityPlaylist(
    mediaFileId,
    quality as Quality,
    mediaFile.duration
  );

  return new Response(playlist, {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "public, max-age=60",
    },
  });
}
