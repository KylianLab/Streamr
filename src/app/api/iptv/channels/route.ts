import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const group = searchParams.get("group");

  const where: Record<string, unknown> = { isActive: true };
  if (group) {
    where.group = group;
  }

  const channels = await prisma.iptvChannel.findMany({
    where,
    orderBy: [{ group: "asc" }, { order: "asc" }],
  });

  // Extract unique groups
  const groups = [
    ...new Set(
      channels
        .map((ch) => ch.group)
        .filter((g): g is string => g !== null)
    ),
  ].sort();

  return NextResponse.json({ groups, channels });
}
