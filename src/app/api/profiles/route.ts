import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createProfileSchema = z.object({
  name: z.string().min(1).max(50),
  avatarUrl: z.string().optional(),
  isKid: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profiles = await prisma.profile.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const data = createProfileSchema.parse(body);

  // Max 5 profiles per user
  const count = await prisma.profile.count({
    where: { userId: session.user.id },
  });

  if (count >= 5) {
    return NextResponse.json(
      { error: "Maximum 5 profils par compte" },
      { status: 400 }
    );
  }

  const profile = await prisma.profile.create({
    data: {
      ...data,
      userId: session.user.id,
    },
  });

  return NextResponse.json(profile, { status: 201 });
}
