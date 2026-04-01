import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type") as "MOVIE" | "SERIES" | null;
  const genre = searchParams.get("genre");

  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const where: Record<string, unknown> = {
    status: { not: "HIDDEN" },
    OR: [
      { title: { contains: q } },
      { originalTitle: { contains: q } },
      { overview: { contains: q } },
    ],
  };

  if (type) where.type = type;
  if (genre) {
    where.genres = { some: { genre: { name: genre } } };
  }

  const results = await prisma.media.findMany({
    where,
    include: {
      genres: { include: { genre: true } },
      mediaFiles: { select: { id: true } },
      _count: { select: { seasons: true } },
    },
    take: 20,
    orderBy: { popularity: "desc" },
  });

  return NextResponse.json({ data: results });
}
