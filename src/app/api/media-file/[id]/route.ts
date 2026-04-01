import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id },
    include: {
      media: {
        select: { id: true, title: true, type: true },
      },
      episode: {
        include: {
          season: {
            include: {
              media: { select: { id: true, title: true } },
              episodes: {
                orderBy: { episodeNumber: "asc" },
                include: {
                  mediaFiles: { select: { id: true }, take: 1 },
                },
              },
            },
          },
        },
      },
      subtitles: {
        select: {
          id: true,
          language: true,
          languageName: true,
          isDefault: true,
        },
      },
    },
  });

  if (!mediaFile) {
    return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
  }

  return NextResponse.json(jsonSafe(mediaFile));
}
