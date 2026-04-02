import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQualityPlaylist } from "@/lib/ffmpeg";
import { Quality, QUALITY_PROFILES } from "@/config/constants";
import { verifyStreamToken } from "@/lib/stream-token";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mediaFileId: string; quality: string }> }
) {
  const { mediaFileId, quality } = await params;

  // Auth via session cookie OR stream token (for Safari native HLS)
  const token = req.nextUrl.searchParams.get("token");
  if (token) {
    if (!verifyStreamToken(token, mediaFileId)) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }
  } else {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  }

  if (!(quality in QUALITY_PROFILES)) {
    return NextResponse.json({ error: "Qualité invalide" }, { status: 400 });
  }

  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id: mediaFileId },
  });

  if (!mediaFile) {
    return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
  }

  if (!mediaFile.duration) {
    return NextResponse.json({ error: "Durée inconnue" }, { status: 400 });
  }

  const playlist = generateQualityPlaylist(
    mediaFileId,
    quality as Quality,
    mediaFile.duration
  );

  // Append token to segment URLs for Safari
  const playlistWithToken = token
    ? playlist.replace(/(\/\d+\.ts)/g, `$1?token=${token}`)
    : playlist;

  return new Response(playlistWithToken, {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "public, max-age=60",
    },
  });
}
