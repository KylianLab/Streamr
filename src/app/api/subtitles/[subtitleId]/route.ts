import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { srtToVtt, assToVtt } from "@/lib/subtitle-parser";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ subtitleId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { subtitleId } = await params;

  const subtitle = await prisma.subtitle.findUnique({
    where: { id: subtitleId },
  });

  if (!subtitle) {
    return NextResponse.json({ error: "Sous-titre non trouvé" }, { status: 404 });
  }

  const content = await readFile(subtitle.filePath, "utf-8");
  let vttContent: string;

  switch (subtitle.format) {
    case "VTT":
      vttContent = content;
      break;
    case "SRT":
      vttContent = srtToVtt(content);
      break;
    case "ASS":
    case "SSA":
      vttContent = assToVtt(content);
      break;
    default:
      vttContent = srtToVtt(content);
  }

  return new Response(vttContent, {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
