import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  const playlist = await prisma.iptvPlaylist.findUnique({
    where: { id },
    include: {
      channels: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!playlist) {
    return NextResponse.json(
      { error: "Playlist non trouvée" },
      { status: 404 }
    );
  }

  return NextResponse.json(playlist);
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

  const playlist = await prisma.iptvPlaylist.findUnique({
    where: { id },
  });

  if (!playlist) {
    return NextResponse.json(
      { error: "Playlist non trouvée" },
      { status: 404 }
    );
  }

  await prisma.iptvPlaylist.delete({ where: { id } });

  return NextResponse.json({ message: "Playlist supprimée" });
}
