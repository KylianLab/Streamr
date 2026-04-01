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

  const media = await prisma.media.findUnique({
    where: { id },
    include: {
      genres: { include: { genre: true } },
      cast: {
        include: { person: true },
        orderBy: { order: "asc" },
        take: 20,
      },
      seasons: {
        orderBy: { seasonNumber: "asc" },
        include: {
          episodes: {
            orderBy: { episodeNumber: "asc" },
            include: {
              mediaFiles: {
                select: { id: true, duration: true, resolution: true },
              },
            },
          },
        },
      },
      mediaFiles: {
        select: {
          id: true,
          duration: true,
          resolution: true,
          subtitles: {
            select: { id: true, language: true, languageName: true, isDefault: true },
          },
        },
      },
    },
  });

  if (!media) {
    return NextResponse.json({ error: "Média non trouvé" }, { status: 404 });
  }

  return NextResponse.json(jsonSafe(media));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const updated = await prisma.media.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.media.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
