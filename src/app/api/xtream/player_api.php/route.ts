import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateXtream, xtreamServerInfo, xtreamUserInfo } from "@/lib/xtream";

function getHost(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost";
  return `${proto}://${host}`;
}

function jsonResponse(data: unknown) {
  return NextResponse.json(data, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

// ── UUID ↔ Numeric ID helpers ──────────────────────
// Xtream players (Smarters, TiviMate…) expect numeric IDs.
// We convert UUIDs to stable 31-bit positive integers via hash.

function numId(uuid: string): number {
  let h = 0;
  const s = uuid.replace(/-/g, "");
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h & 0x7fffffff) || 1;
}

async function resolveGenreId(numericId: string): Promise<string | null> {
  const n = parseInt(numericId, 10);
  if (isNaN(n)) return numericId; // already a UUID, pass through
  const genres = await prisma.genre.findMany({ select: { id: true } });
  return genres.find((g) => numId(g.id) === n)?.id || null;
}

async function resolveMediaId(numericId: string, type?: "MOVIE" | "SERIES"): Promise<string | null> {
  const n = parseInt(numericId, 10);
  if (isNaN(n)) return numericId; // already a UUID
  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  const media = await prisma.media.findMany({ select: { id: true }, where });
  return media.find((m) => numId(m.id) === n)?.id || null;
}

// ── Main handler ────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const username = searchParams.get("username") || "";
  const password = searchParams.get("password") || "";
  const action = searchParams.get("action") || "";

  const cred = await authenticateXtream(username, password);
  if (!cred) {
    return jsonResponse({ user_info: { auth: 0, status: "Disabled", message: "Invalid credentials" } });
  }

  const host = getHost(req);

  // No action = auth check (returns server info + user info)
  if (!action) {
    return jsonResponse({
      user_info: xtreamUserInfo(username, password),
      server_info: xtreamServerInfo(host),
    });
  }

  switch (action) {
    case "get_live_categories":
      return jsonResponse(await getLiveCategories());
    case "get_live_streams": {
      const catId = searchParams.get("category_id");
      return jsonResponse(await getLiveStreams(host, username, password, catId));
    }
    case "get_vod_categories":
      return jsonResponse(await getVodCategories());
    case "get_vod_streams": {
      const catId = searchParams.get("category_id");
      return jsonResponse(await getVodStreams(host, username, password, catId));
    }
    case "get_vod_info": {
      const vodId = searchParams.get("vod_id");
      if (!vodId) return jsonResponse({});
      return jsonResponse(await getVodInfo(host, username, password, vodId));
    }
    case "get_series_categories":
      return jsonResponse(await getSeriesCategories());
    case "get_series": {
      const catId = searchParams.get("category_id");
      return jsonResponse(await getSeriesStreams(catId));
    }
    case "get_series_info": {
      const seriesId = searchParams.get("series_id");
      if (!seriesId) return jsonResponse({});
      return jsonResponse(await getSeriesInfo(host, username, password, seriesId));
    }
    default:
      return jsonResponse({
        user_info: xtreamUserInfo(username, password),
        server_info: xtreamServerInfo(host),
      });
  }
}

// ── Live TV ──────────────────────────────────────

async function getLiveCategories() {
  const groups = await prisma.iptvChannel.findMany({
    where: { isActive: true, group: { not: null } },
    select: { group: true },
    distinct: ["group"],
    orderBy: { group: "asc" },
  });

  return groups.map((g, i) => ({
    category_id: String(i + 1),
    category_name: g.group,
    parent_id: 0,
  }));
}

async function getLiveStreams(host: string, username: string, password: string, categoryId: string | null) {
  const categories = await getLiveCategories();
  const catMap = new Map(categories.map((c) => [c.category_name, c.category_id]));

  const channels = await prisma.iptvChannel.findMany({
    where: { isActive: true },
    orderBy: [{ group: "asc" }, { order: "asc" }],
  });

  let filtered = channels;
  if (categoryId) {
    const catName = categories.find((c) => c.category_id === categoryId)?.category_name;
    if (catName) filtered = channels.filter((ch) => ch.group === catName);
  }

  return filtered.map((ch, i) => ({
    num: i + 1,
    name: ch.name,
    stream_type: "live",
    stream_id: numId(ch.id),
    stream_icon: ch.logoUrl || "",
    epg_channel_id: ch.tvgId || "",
    added: Math.floor(ch.createdAt.getTime() / 1000).toString(),
    category_id: catMap.get(ch.group || "") || "0",
    category_name: ch.group || "",
    custom_sid: "",
    tv_archive: 0,
    direct_source: "",
    tv_archive_duration: 0,
  }));
}

// ── VOD (Films) ──────────────────────────────────

async function getVodCategories() {
  const genres = await prisma.genre.findMany({
    where: { media: { some: { media: { type: "MOVIE", status: { not: "HIDDEN" } } } } },
    include: { _count: { select: { media: true } } },
    orderBy: { name: "asc" },
  });

  return genres.map((g) => ({
    category_id: String(numId(g.id)),
    category_name: g.name,
    parent_id: 0,
  }));
}

async function getVodStreams(host: string, username: string, password: string, categoryId: string | null) {
  const where: Record<string, unknown> = { type: "MOVIE", status: { not: "HIDDEN" } };
  if (categoryId) {
    const genreUuid = await resolveGenreId(categoryId);
    if (genreUuid) {
      where.genres = { some: { genreId: genreUuid } };
    }
  }

  const movies = await prisma.media.findMany({
    where,
    include: {
      genres: { include: { genre: true } },
      mediaFiles: { select: { id: true, duration: true }, take: 1 },
    },
    orderBy: { title: "asc" },
  });

  return movies.map((m, i) => ({
    num: i + 1,
    name: m.title,
    stream_type: "movie",
    stream_id: numId(m.id),
    stream_icon: m.posterPath || "",
    rating: m.rating?.toString() || "",
    added: Math.floor(m.createdAt.getTime() / 1000).toString(),
    category_id: m.genres[0] ? String(numId(m.genres[0].genreId)) : "",
    category_ids: m.genres.map((g) => String(numId(g.genreId))),
    container_extension: "mp4",
    custom_sid: "",
    direct_source: "",
  }));
}

async function getVodInfo(host: string, username: string, password: string, vodId: string) {
  const mediaUuid = await resolveMediaId(vodId, "MOVIE");
  if (!mediaUuid) return {};

  const movie = await prisma.media.findUnique({
    where: { id: mediaUuid },
    include: {
      genres: { include: { genre: true } },
      cast: { include: { person: true }, take: 10 },
      mediaFiles: { select: { id: true, duration: true, resolution: true }, take: 1 },
    },
  });

  if (!movie) return {};

  const mediaFile = movie.mediaFiles[0];

  return {
    info: {
      movie_image: movie.posterPath || "",
      backdrop_path: [movie.backdropPath].filter(Boolean),
      tmdb_id: movie.tmdbId,
      name: movie.title,
      o_name: movie.originalTitle || movie.title,
      plot: movie.overview || "",
      cast: movie.cast.map((c) => c.person.name).join(", "),
      director: "",
      genre: movie.genres.map((g) => g.genre.name).join(", "),
      release_date: movie.releaseDate?.toISOString().substring(0, 10) || "",
      rating: movie.rating || 0,
      duration_secs: mediaFile?.duration || 0,
      duration: mediaFile?.duration ? `${Math.floor(mediaFile.duration / 60)} min` : "",
    },
    movie_data: mediaFile
      ? {
          stream_id: numId(movie.id),
          name: movie.title,
          added: Math.floor(movie.createdAt.getTime() / 1000).toString(),
          category_id: movie.genres[0] ? String(numId(movie.genres[0].genreId)) : "",
          container_extension: "mp4",
          custom_sid: "",
          direct_source: `${host}/movie/${username}/${password}/${numId(movie.id)}.mp4`,
        }
      : null,
  };
}

// ── Séries ───────────────────────────────────────

async function getSeriesCategories() {
  const genres = await prisma.genre.findMany({
    where: { media: { some: { media: { type: "SERIES", status: { not: "HIDDEN" } } } } },
    include: { _count: { select: { media: true } } },
    orderBy: { name: "asc" },
  });

  return genres.map((g) => ({
    category_id: String(numId(g.id)),
    category_name: g.name,
    parent_id: 0,
  }));
}

async function getSeriesStreams(categoryId: string | null) {
  const where: Record<string, unknown> = { type: "SERIES", status: { not: "HIDDEN" } };
  if (categoryId) {
    const genreUuid = await resolveGenreId(categoryId);
    if (genreUuid) {
      where.genres = { some: { genreId: genreUuid } };
    }
  }

  const series = await prisma.media.findMany({
    where,
    include: {
      genres: { include: { genre: true } },
      seasons: { select: { id: true } },
    },
    orderBy: { title: "asc" },
  });

  return series.map((s, i) => ({
    num: i + 1,
    name: s.title,
    series_id: numId(s.id),
    cover: s.posterPath || "",
    plot: s.overview || "",
    cast: "",
    director: "",
    genre: s.genres.map((g) => g.genre.name).join(", "),
    release_date: s.releaseDate?.toISOString().substring(0, 10) || "",
    last_modified: Math.floor(s.updatedAt.getTime() / 1000).toString(),
    rating: s.rating?.toString() || "",
    category_id: s.genres[0] ? String(numId(s.genres[0].genreId)) : "",
    category_ids: s.genres.map((g) => String(numId(g.genreId))),
    backdrop_path: [s.backdropPath].filter(Boolean),
  }));
}

async function getSeriesInfo(host: string, username: string, password: string, seriesId: string) {
  const mediaUuid = await resolveMediaId(seriesId, "SERIES");
  if (!mediaUuid) return {};

  const series = await prisma.media.findUnique({
    where: { id: mediaUuid },
    include: {
      genres: { include: { genre: true } },
      cast: { include: { person: true }, take: 10 },
      seasons: {
        include: {
          episodes: {
            include: {
              mediaFiles: { select: { id: true, duration: true }, take: 1 },
            },
            orderBy: { episodeNumber: "asc" },
          },
        },
        orderBy: { seasonNumber: "asc" },
      },
    },
  });

  if (!series) return {};

  const episodesMap: Record<string, unknown[]> = {};

  for (const season of series.seasons) {
    const seasonKey = String(season.seasonNumber);

    episodesMap[seasonKey] = season.episodes
      .filter((ep) => ep.mediaFiles[0])
      .map((ep) => {
        const mf = ep.mediaFiles[0];
        return {
          id: numId(mf.id),
          episode_num: ep.episodeNumber,
          title: ep.title || `Episode ${ep.episodeNumber}`,
          container_extension: "mp4",
          info: {
            plot: ep.overview || "",
            duration_secs: mf?.duration || 0,
            duration: mf?.duration ? `${Math.floor(mf.duration / 60)} min` : "",
            movie_image: ep.stillPath || "",
            release_date: ep.airDate?.toISOString().substring(0, 10) || "",
          },
          custom_sid: "",
          added: Math.floor(ep.createdAt.getTime() / 1000).toString(),
          season: season.seasonNumber,
          direct_source: `${host}/series/${username}/${password}/${numId(mf.id)}.mp4`,
        };
      });
  }

  return {
    seasons: series.seasons.map((s) => ({
      air_date: s.airDate?.toISOString().substring(0, 10) || "",
      episode_count: s.episodes.length,
      id: numId(s.id),
      name: s.name || `Saison ${s.seasonNumber}`,
      overview: s.overview || "",
      season_number: s.seasonNumber,
      cover: s.posterPath || series.posterPath || "",
    })),
    info: {
      name: series.title,
      cover: series.posterPath || "",
      plot: series.overview || "",
      cast: series.cast.map((c) => c.person.name).join(", "),
      director: "",
      genre: series.genres.map((g) => g.genre.name).join(", "),
      release_date: series.releaseDate?.toISOString().substring(0, 10) || "",
      rating: series.rating?.toString() || "",
      backdrop_path: [series.backdropPath].filter(Boolean),
      tmdb_id: series.tmdbId,
    },
    episodes: episodesMap,
  };
}
