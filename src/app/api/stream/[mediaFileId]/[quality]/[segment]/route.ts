import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSegment } from "@/lib/transcode-manager";
import { Quality, QUALITY_PROFILES } from "@/config/constants";
import { verifyStreamToken } from "@/lib/stream-token";

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mediaFileId: string; quality: string; segment: string }> }
) {
  const { mediaFileId, quality, segment } = await params;

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

  const segmentIndex = parseInt(segment.replace(".ts", ""));
  if (isNaN(segmentIndex)) {
    return NextResponse.json({ error: "Segment invalide" }, { status: 400 });
  }

  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id: mediaFileId },
  });

  if (!mediaFile) {
    return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
  }

  const stream = await getSegment(
    mediaFile.filePath,
    mediaFileId,
    quality as Quality,
    segmentIndex,
    mediaFile.isHdr,
  );

  if (!stream) {
    return new Response(null, { status: 404 });
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "video/mp2t",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
