import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") as "MOVIE" | "SERIES" | null;
  const genre = searchParams.get("genre");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const sort = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") || "desc";

  const where: Record<string, unknown> = {
    status: status || { not: "HIDDEN" },
  };

  if (type) where.type = type;
  if (genre) {
    where.genres = {
      some: { genre: { name: genre } },
    };
  }

  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where,
      include: {
        genres: { include: { genre: true } },
        mediaFiles: { select: { id: true, duration: true, resolution: true } },
        _count: { select: { seasons: true } },
      },
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.media.count({ where }),
  ]);

  return NextResponse.json({
    data: jsonSafe(media),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
