import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const genres = await prisma.genre.findMany({
    include: {
      _count: { select: { media: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    genres.filter((g) => g._count.media > 0)
  );
}
