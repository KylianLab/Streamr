import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseM3U } from "@/lib/m3u-parser";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const playlists = await prisma.iptvPlaylist.findMany({
    include: {
      _count: { select: { channels: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(playlists);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") || "";
  let name: string | null = null;
  let content: string;
  let fileName: string | null = null;
  let url: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    // File upload
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    name = formData.get("name") as string | null;
    url = formData.get("url") as string | null;

    if (url && url.trim()) {
      // URL provided via form
      url = url.trim();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) {
          return NextResponse.json(
            { error: `Impossible de télécharger la playlist (${res.status})` },
            { status: 400 }
          );
        }
        content = await res.text();
      } catch {
        return NextResponse.json(
          { error: "Impossible de télécharger la playlist. Vérifiez l'URL." },
          { status: 400 }
        );
      }
    } else if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "m3u" && ext !== "m3u8") {
        return NextResponse.json(
          { error: "Format invalide. Seuls les fichiers .m3u et .m3u8 sont acceptés" },
          { status: 400 }
        );
      }
      fileName = file.name;
      content = await file.text();
    } else {
      return NextResponse.json({ error: "Fichier ou URL requis" }, { status: 400 });
    }
  } else {
    // JSON body with URL
    const body = await req.json();
    name = body.name || null;
    url = body.url || null;

    if (!url || !url.trim()) {
      return NextResponse.json({ error: "URL requise" }, { status: 400 });
    }

    url = url.trim();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Impossible de télécharger la playlist (${res.status})` },
          { status: 400 }
        );
      }
      content = await res.text();
    } catch {
      return NextResponse.json(
        { error: "Impossible de télécharger la playlist. Vérifiez l'URL." },
        { status: 400 }
      );
    }
  }

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }

  let parsedChannels = parseM3U(content);

  // If no channels were parsed but we have a URL, treat it as a single direct stream
  if (parsedChannels.length === 0 && url) {
    parsedChannels = [{
      name: name!.trim(),
      logoUrl: null,
      group: null,
      tvgId: null,
      streamUrl: url,
      order: 0,
    }];
  }

  const playlist = await prisma.$transaction(async (tx) => {
    const created = await tx.iptvPlaylist.create({
      data: {
        name: name!.trim(),
        fileName,
        url,
        channelCount: parsedChannels.length,
      },
    });

    if (parsedChannels.length > 0) {
      await tx.iptvChannel.createMany({
        data: parsedChannels.map((ch) => ({
          playlistId: created.id,
          name: ch.name,
          logoUrl: ch.logoUrl,
          group: ch.group,
          tvgId: ch.tvgId,
          streamUrl: ch.streamUrl,
          order: ch.order,
        })),
      });
    }

    return tx.iptvPlaylist.findUnique({
      where: { id: created.id },
      include: { _count: { select: { channels: true } } },
    });
  });

  return NextResponse.json(playlist, { status: 201 });
}
