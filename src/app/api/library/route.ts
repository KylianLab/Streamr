import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createLibrarySchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  mediaType: z.enum(["MOVIE", "SERIES"]),
  autoScan: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const libraries = await prisma.libraryPath.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { mediaFiles: true } },
    },
  });

  return NextResponse.json(libraries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const data = createLibrarySchema.parse(body);

  const existing = await prisma.libraryPath.findUnique({
    where: { path: data.path },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Ce chemin est déjà configuré" },
      { status: 400 }
    );
  }

  const library = await prisma.libraryPath.create({ data });
  return NextResponse.json(library, { status: 201 });
}
