import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const progressSchema = z.object({
  progress: z.number().min(0),
  duration: z.number().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mediaFileId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profileId = req.cookies.get("profileId")?.value;
  if (!profileId) {
    return NextResponse.json({ error: "Profil non sélectionné" }, { status: 400 });
  }

  const { mediaFileId } = await params;
  const body = await req.json();
  const { progress, duration } = progressSchema.parse(body);

  const percentage = (progress / duration) * 100;
  const completed = percentage >= 90;

  try {
    const history = await prisma.watchHistory.upsert({
      where: {
        profileId_mediaFileId: { profileId, mediaFileId },
      },
      update: {
        progress: Math.floor(progress),
        duration,
        percentage,
        completed,
        watchedAt: new Date(),
      },
      create: {
        profileId,
        mediaFileId,
        progress: Math.floor(progress),
        duration,
        percentage,
        completed,
      },
    });
    return NextResponse.json(history);
  } catch (e: unknown) {
    // Concurrent upserts can race on unique constraint — retry once
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      const history = await prisma.watchHistory.update({
        where: { profileId_mediaFileId: { profileId, mediaFileId } },
        data: {
          progress: Math.floor(progress),
          duration,
          percentage,
          completed,
          watchedAt: new Date(),
        },
      });
      return NextResponse.json(history);
    }
    throw e;
  }
}
