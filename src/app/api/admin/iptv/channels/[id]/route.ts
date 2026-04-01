import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  const channel = await prisma.iptvChannel.findUnique({ where: { id } });
  if (!channel) {
    return NextResponse.json(
      { error: "Chaîne non trouvée" },
      { status: 404 }
    );
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.group !== undefined) data.group = body.group;
  if (body.streamUrl !== undefined) data.streamUrl = body.streamUrl;
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const updated = await prisma.iptvChannel.update({
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
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  const channel = await prisma.iptvChannel.findUnique({ where: { id } });
  if (!channel) {
    return NextResponse.json(
      { error: "Chaîne non trouvée" },
      { status: 404 }
    );
  }

  await prisma.iptvChannel.delete({ where: { id } });

  return NextResponse.json({ message: "Chaîne supprimée" });
}
