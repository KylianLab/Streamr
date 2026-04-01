import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().optional(),
  isKid: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const data = updateProfileSchema.parse(body);

  const profile = await prisma.profile.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
  }

  const updated = await prisma.profile.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  const profile = await prisma.profile.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
  }

  // Ensure at least one profile remains
  const count = await prisma.profile.count({
    where: { userId: session.user.id },
  });

  if (count <= 1) {
    return NextResponse.json(
      { error: "Vous devez conserver au moins un profil" },
      { status: 400 }
    );
  }

  await prisma.profile.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
