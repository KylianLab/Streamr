import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profileId = req.cookies.get("profileId")?.value;
  if (!profileId) {
    return NextResponse.json({ error: "Profil non sélectionné" }, { status: 400 });
  }

  const { mediaId } = await params;

  const existing = await prisma.watchlist.findUnique({
    where: { profileId_mediaId: { profileId, mediaId } },
  });

  if (existing) {
    return NextResponse.json({ error: "Déjà dans la liste" }, { status: 400 });
  }

  const entry = await prisma.watchlist.create({
    data: { profileId, mediaId },
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profileId = req.cookies.get("profileId")?.value;
  if (!profileId) {
    return NextResponse.json({ error: "Profil non sélectionné" }, { status: 400 });
  }

  const { mediaId } = await params;

  await prisma.watchlist.deleteMany({
    where: { profileId, mediaId },
  });

  return NextResponse.json({ success: true });
}
