import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  searchMovie,
  searchSeries,
  getMovieDetails,
  getSeriesDetails,
  getSeasonDetails,
  getTrailerUrl,
  getContentRating,
} from "@/lib/tmdb";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) {
    return NextResponse.json({ error: "Média non trouvé" }, { status: 404 });
  }

  try {
    if (media.type === "MOVIE") {
      await matchMovie(media.id, media.title);
    } else {
      await matchSeries(media.id, media.title);
    }

    const updated = await prisma.media.findUnique({
      where: { id },
      include: { genres: { include: { genre: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("TMDB match error:", error);
    await prisma.media.update({
      where: { id },
      data: { status: "UNMATCHED" },
    });
    return NextResponse.json(
      { error: "Impossible de trouver les métadonnées" },
      { status: 404 }
    );
  }
}

/**
 * Clean IPTV provider titles for better TMDB matching.
 * Providers often include tags like [FR], (2023), |HD|, quality indicators, etc.
 */
function cleanTitle(raw: string): string {
  let t = raw;
  // Remove common IPTV prefixes like "FR - ", "4K-FR-HDR - ", "EN - ", "AR - "
  t = t.replace(/^[\w\d]+([-\s]+[\w\d]+)*\s*-\s+/i, (match) => {
    // Only strip if it looks like a language/quality prefix (short segments before " - ")
    const prefix = match.replace(/\s*-\s+$/, "");
    const parts = prefix.split(/[-\s]+/);
    const looksLikePrefix = parts.every((p) => p.length <= 10 && /^(FR|EN|AR|DE|ES|IT|PT|NL|RU|TR|4K|UHD|HD|FHD|SD|HDR|MULTI|VF|VOSTFR|FRENCH|TRUEFRENCH)$/i.test(p));
    return looksLikePrefix ? "" : match;
  });
  // Remove tags in brackets/pipes: [FR], [HD], |MULTI|, [VF], etc.
  t = t.replace(/\[.*?\]/g, "");
  t = t.replace(/\|.*?\|/g, "");
  // Remove trailing year in parentheses and extract it
  t = t.replace(/\(\d{4}\)\s*$/, "");
  // Remove quality tags
  t = t.replace(/\b(4K|UHD|HD|SD|FHD|720p|1080p|2160p|HEVC|x264|x265|HDR|WEB-?DL|BluRay|BRRip|DVDRip|HDTV|REMUX|MULTI|TRUEFRENCH|FRENCH|VOSTFR|VF|VFF|VFSTFR)\b/gi, "");
  // Remove leading/trailing separators and whitespace
  t = t.replace(/[|/\\:]+/g, " ");
  t = t.replace(/\s{2,}/g, " ").trim();
  // Remove trailing dash or dot
  t = t.replace(/[\s\-_.]+$/, "").trim();
  return t;
}

function extractYear(raw: string): number | undefined {
  const m = raw.match(/\((\d{4})\)/);
  return m ? parseInt(m[1]) : undefined;
}

async function matchMovie(mediaId: string, title: string) {
  const clean = cleanTitle(title);
  const year = extractYear(title);

  // Try cleaned title first, fall back to original
  let results = await searchMovie(clean, year?.toString());
  if (results.length === 0 && year) {
    results = await searchMovie(clean);
  }
  if (results.length === 0 && clean !== title) {
    results = await searchMovie(title);
  }
  if (results.length === 0) throw new Error("No TMDB results");

  const tmdbMovie = results[0];
  const details = await getMovieDetails(tmdbMovie.id);

  // Upsert genres
  for (const g of details.genres) {
    const genre = await prisma.genre.upsert({
      where: { tmdbId: g.id },
      update: { name: g.name },
      create: { name: g.name, tmdbId: g.id },
    });

    await prisma.mediaGenre.upsert({
      where: { mediaId_genreId: { mediaId, genreId: genre.id } },
      update: {},
      create: { mediaId, genreId: genre.id },
    });
  }

  // Upsert cast
  if (details.credits?.cast) {
    for (const c of details.credits.cast.slice(0, 15)) {
      const person = await prisma.person.upsert({
        where: { tmdbId: c.id },
        update: { name: c.name, profileUrl: c.profile_path },
        create: { name: c.name, tmdbId: c.id, profileUrl: c.profile_path },
      });

      await prisma.mediaCast.upsert({
        where: {
          mediaId_personId_character: {
            mediaId,
            personId: person.id,
            character: c.character || "",
          },
        },
        update: { order: c.order },
        create: {
          mediaId,
          personId: person.id,
          character: c.character || "",
          order: c.order,
        },
      });
    }
  }

  await prisma.media.update({
    where: { id: mediaId },
    data: {
      title: details.title,
      originalTitle: details.original_title,
      overview: details.overview,
      tagline: details.tagline,
      releaseDate: details.release_date ? new Date(details.release_date) : null,
      runtime: details.runtime,
      rating: details.vote_average,
      voteCount: details.vote_count,
      popularity: details.popularity,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      logoPath: details.images?.logos?.[0]?.file_path || null,
      trailerUrl: getTrailerUrl(details.videos),
      contentRating: getContentRating(details.content_ratings),
      tmdbId: details.id,
      imdbId: details.imdb_id,
      status: "MATCHED",
    },
  });
}

async function matchSeries(mediaId: string, title: string) {
  const clean = cleanTitle(title);

  let results = await searchSeries(clean);
  if (results.length === 0 && clean !== title) {
    results = await searchSeries(title);
  }
  if (results.length === 0) throw new Error("No TMDB results");

  const tmdbSeries = results[0];
  const details = await getSeriesDetails(tmdbSeries.id);

  // Genres
  for (const g of details.genres) {
    const genre = await prisma.genre.upsert({
      where: { tmdbId: g.id },
      update: { name: g.name },
      create: { name: g.name, tmdbId: g.id },
    });

    await prisma.mediaGenre.upsert({
      where: { mediaId_genreId: { mediaId, genreId: genre.id } },
      update: {},
      create: { mediaId, genreId: genre.id },
    });
  }

  // Cast
  if (details.credits?.cast) {
    for (const c of details.credits.cast.slice(0, 15)) {
      const person = await prisma.person.upsert({
        where: { tmdbId: c.id },
        update: { name: c.name, profileUrl: c.profile_path },
        create: { name: c.name, tmdbId: c.id, profileUrl: c.profile_path },
      });

      await prisma.mediaCast.upsert({
        where: {
          mediaId_personId_character: {
            mediaId,
            personId: person.id,
            character: c.character || "",
          },
        },
        update: { order: c.order },
        create: {
          mediaId,
          personId: person.id,
          character: c.character || "",
          order: c.order,
        },
      });
    }
  }

  await prisma.media.update({
    where: { id: mediaId },
    data: {
      title: details.name,
      originalTitle: details.original_name,
      overview: details.overview,
      tagline: details.tagline,
      releaseDate: details.first_air_date ? new Date(details.first_air_date) : null,
      endDate: details.last_air_date ? new Date(details.last_air_date) : null,
      runtime: details.episode_run_time?.[0] || null,
      rating: details.vote_average,
      voteCount: details.vote_count,
      popularity: details.popularity,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      logoPath: details.images?.logos?.[0]?.file_path || null,
      trailerUrl: getTrailerUrl(details.videos),
      contentRating: getContentRating(details.content_ratings),
      tmdbId: details.id,
      status: "MATCHED",
    },
  });

  // Fetch season & episode details
  for (const s of details.seasons) {
    if (s.season_number === 0) continue; // Skip specials

    const season = await prisma.season.upsert({
      where: {
        mediaId_seasonNumber: {
          mediaId,
          seasonNumber: s.season_number,
        },
      },
      update: {
        name: s.name,
        overview: s.overview,
        posterPath: s.poster_path,
        airDate: s.air_date ? new Date(s.air_date) : null,
      },
      create: {
        mediaId,
        seasonNumber: s.season_number,
        name: s.name,
        overview: s.overview,
        posterPath: s.poster_path,
        airDate: s.air_date ? new Date(s.air_date) : null,
      },
    });

    try {
      const seasonDetail = await getSeasonDetails(details.id, s.season_number);
      for (const ep of seasonDetail.episodes) {
        await prisma.episode.upsert({
          where: {
            seasonId_episodeNumber: {
              seasonId: season.id,
              episodeNumber: ep.episode_number,
            },
          },
          update: {
            title: ep.name,
            overview: ep.overview,
            stillPath: ep.still_path,
            airDate: ep.air_date ? new Date(ep.air_date) : null,
            runtime: ep.runtime,
          },
          create: {
            seasonId: season.id,
            episodeNumber: ep.episode_number,
            title: ep.name,
            overview: ep.overview,
            stillPath: ep.still_path,
            airDate: ep.air_date ? new Date(ep.air_date) : null,
            runtime: ep.runtime,
          },
        });
      }
    } catch (e) {
      console.error(`Failed to fetch season ${s.season_number}:`, e);
    }
  }
}
