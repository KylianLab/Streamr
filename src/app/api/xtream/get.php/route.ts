import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateXtream } from "@/lib/xtream";

function getHost(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const username = searchParams.get("username") || "";
  const password = searchParams.get("password") || "";
  const type = searchParams.get("type") || "m3u_plus";
  const output = searchParams.get("output") || "";

  const cred = await authenticateXtream(username, password);
  if (!cred) {
    return new NextResponse("Invalid credentials", { status: 401 });
  }

  const host = getHost(req);

  // Build M3U playlist
  const lines: string[] = ["#EXTM3U"];

  // Live TV channels
  const channels = await prisma.iptvChannel.findMany({
    where: { isActive: true },
    orderBy: [{ group: "asc" }, { order: "asc" }],
  });

  for (const ch of channels) {
    const attrs: string[] = [];
    attrs.push(`tvg-id="${ch.tvgId || ""}"`);
    attrs.push(`tvg-name="${ch.name}"`);
    if (ch.logoUrl) attrs.push(`tvg-logo="${ch.logoUrl}"`);
    if (ch.group) attrs.push(`group-title="${ch.group}"`);

    lines.push(`#EXTINF:-1 ${attrs.join(" ")},${ch.name}`);
    lines.push(`${host}/api/xtream/live/${username}/${password}/${ch.id}.m3u8`);
  }

  // VOD (Movies)
  const movies = await prisma.media.findMany({
    where: { type: "MOVIE", status: { not: "HIDDEN" } },
    include: {
      genres: { include: { genre: true } },
      mediaFiles: { select: { id: true }, take: 1 },
    },
    orderBy: { title: "asc" },
  });

  for (const movie of movies) {
    const mf = movie.mediaFiles[0];
    if (!mf) continue;

    const genre = movie.genres[0]?.genre.name || "Films";
    const attrs: string[] = [];
    attrs.push(`tvg-id=""`);
    attrs.push(`tvg-name="${movie.title}"`);
    if (movie.posterPath) attrs.push(`tvg-logo="${movie.posterPath}"`);
    attrs.push(`group-title="VOD - ${genre}"`);

    lines.push(`#EXTINF:-1 ${attrs.join(" ")},${movie.title}`);
    lines.push(`${host}/api/xtream/movie/${username}/${password}/${mf.id}.mp4`);
  }

  // Series episodes
  const series = await prisma.media.findMany({
    where: { type: "SERIES", status: { not: "HIDDEN" } },
    include: {
      seasons: {
        include: {
          episodes: {
            include: { mediaFiles: { select: { id: true }, take: 1 } },
            orderBy: { episodeNumber: "asc" },
          },
        },
        orderBy: { seasonNumber: "asc" },
      },
    },
    orderBy: { title: "asc" },
  });

  for (const s of series) {
    for (const season of s.seasons) {
      for (const ep of season.episodes) {
        const mf = ep.mediaFiles[0];
        if (!mf) continue;

        const epName = `${s.title} S${String(season.seasonNumber).padStart(2, "0")}E${String(ep.episodeNumber).padStart(2, "0")}`;
        const attrs: string[] = [];
        attrs.push(`tvg-id=""`);
        attrs.push(`tvg-name="${epName}"`);
        if (ep.stillPath) attrs.push(`tvg-logo="${ep.stillPath}"`);
        attrs.push(`group-title="Séries - ${s.title}"`);

        lines.push(`#EXTINF:-1 ${attrs.join(" ")},${epName}`);
        lines.push(`${host}/api/xtream/series/${username}/${password}/${mf.id}.mp4`);
      }
    }
  }

  const m3u = lines.join("\n") + "\n";

  return new NextResponse(m3u, {
    headers: {
      "Content-Type": "application/x-mpegurl; charset=utf-8",
      "Content-Disposition": 'attachment; filename="playlist.m3u"',
      "Access-Control-Allow-Origin": "*",
    },
  });
}
