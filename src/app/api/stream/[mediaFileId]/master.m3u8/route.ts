import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateMasterPlaylist, getAvailableQualities } from "@/lib/ffmpeg";
import { verifyStreamToken } from "@/lib/stream-token";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mediaFileId: string }> }
) {
  const { mediaFileId } = await params;

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

  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id: mediaFileId },
  });

  if (!mediaFile) {
    return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
  }

  const qualities = getAvailableQualities(mediaFile.resolution || "1920x1080");
  const playlist = generateMasterPlaylist(mediaFileId, qualities);

  // Append token to segment URLs for Safari
  const tokenParam = token ? `?token=${token}` : "";
  const playlistWithToken = token
    ? playlist.replace(/(\/playlist\.m3u8)/g, `$1${tokenParam}`)
    : playlist;

  return new Response(playlistWithToken, {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "public, max-age=60",
    },
  });
}
