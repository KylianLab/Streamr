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

  const history = await prisma.watchHistory.findMany({
    where: {
      profileId,
      completed: false,
      percentage: { gt: 0 },
    },
    orderBy: { watchedAt: "desc" },
    take: 20,
    include: {
      mediaFile: {
        include: {
          media: {
            include: {
              genres: { include: { genre: true } },
            },
          },
          episode: {
            include: {
              season: {
                include: { media: true },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(jsonSafe(history));
}
