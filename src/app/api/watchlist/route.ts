import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profileId = req.cookies.get("profileId")?.value;
  if (!profileId) {
    return NextResponse.json({ error: "Profil non sélectionné" }, { status: 400 });
  }

  const watchlist = await prisma.watchlist.findMany({
    where: { profileId },
    orderBy: { addedAt: "desc" },
    include: {
      media: {
        include: {
          genres: { include: { genre: true } },
          mediaFiles: { select: { id: true, duration: true } },
          _count: { select: { seasons: true } },
        },
      },
    },
  });

  return NextResponse.json(jsonSafe(watchlist));
}
