import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scanLibrary } from "@/lib/scanner";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const libraryId = body.libraryId;

  try {
    if (libraryId) {
      const result = await scanLibrary(libraryId);
      return NextResponse.json(result);
    }

    // Scan all libraries
    const libraries = await prisma.libraryPath.findMany();
    const results = [];

    for (const lib of libraries) {
      const result = await scanLibrary(lib.id);
      results.push({ libraryId: lib.id, name: lib.name, ...result });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { error: "Erreur lors du scan" },
      { status: 500 }
    );
  }
}
