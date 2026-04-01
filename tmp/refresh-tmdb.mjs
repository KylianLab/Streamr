import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdbFetch(path, params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "fr-FR");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

function cleanTitle(raw) {
  let t = raw;
  t = t.replace(/^[\w\d]+([-\s]+[\w\d]+)*\s*-\s+/i, (match) => {
    const prefix = match.replace(/\s*-\s+$/, "");
    const parts = prefix.split(/[-\s]+/);
    const ok = parts.every(p => p.length <= 10 && /^(FR|EN|AR|DE|ES|IT|PT|NL|RU|TR|4K|UHD|HD|FHD|SD|HDR|MULTI|VF|VOSTFR|FRENCH|TRUEFRENCH)$/i.test(p));
    return ok ? "" : match;
  });
  t = t.replace(/\[.*?\]/g, "");
  t = t.replace(/\|.*?\|/g, "");
  t = t.replace(/\(\d{4}\)\s*$/, "");
  t = t.replace(/\b(4K|UHD|HD|SD|FHD|720p|1080p|2160p|HEVC|x264|x265|HDR|WEB-?DL|BluRay|BRRip|DVDRip|HDTV|REMUX|MULTI|TRUEFRENCH|FRENCH|VOSTFR|VF|VFF|VFSTFR)\b/gi, "");
  t = t.replace(/[|/\\:]+/g, " ");
  t = t.replace(/\s{2,}/g, " ").trim();
  t = t.replace(/[\s\-_.]+$/, "").trim();
  return t;
}

function extractYear(raw) {
  const m = raw.match(/\((\d{4})\)/);
  return m ? m[1] : undefined;
}

async function matchMovie(media) {
  const clean = cleanTitle(media.title);
  const year = extractYear(media.title);

  let data = await tmdbFetch("/search/movie", { query: clean, ...(year ? { year } : {}) });
  if (!data.results?.length && year) data = await tmdbFetch("/search/movie", { query: clean });
  if (!data.results?.length) return false;

  const tmdbId = data.results[0].id;
  const details = await tmdbFetch(`/movie/${tmdbId}`, { append_to_response: "credits,videos,images,release_dates" });

  // Get trailer
  let trailerUrl = null;
  const yt = details.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube");
  if (yt) trailerUrl = `https://www.youtube.com/watch?v=${yt.key}`;

  // Upsert genres
  for (const g of details.genres || []) {
    const genre = await prisma.genre.upsert({ where: { tmdbId: g.id }, update: { name: g.name }, create: { name: g.name, tmdbId: g.id } });
    await prisma.mediaGenre.upsert({ where: { mediaId_genreId: { mediaId: media.id, genreId: genre.id } }, update: {}, create: { mediaId: media.id, genreId: genre.id } });
  }

  // Upsert cast
  for (const c of (details.credits?.cast || []).slice(0, 15)) {
    const person = await prisma.person.upsert({ where: { tmdbId: c.id }, update: { name: c.name, profileUrl: c.profile_path }, create: { name: c.name, tmdbId: c.id, profileUrl: c.profile_path } });
    await prisma.mediaCast.upsert({
      where: { mediaId_personId_character: { mediaId: media.id, personId: person.id, character: c.character || "" } },
      update: { order: c.order },
      create: { mediaId: media.id, personId: person.id, character: c.character || "", order: c.order },
    }).catch(() => {});
  }

  await prisma.media.update({
    where: { id: media.id },
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
      trailerUrl,
      tmdbId: details.id,
      imdbId: details.imdb_id || null,
      status: "MATCHED",
    },
  });

  return true;
}

async function matchSeries(media) {
  const clean = cleanTitle(media.title);

  let data = await tmdbFetch("/search/tv", { query: clean });
  if (!data.results?.length) return false;

  const tmdbId = data.results[0].id;
  const details = await tmdbFetch(`/tv/${tmdbId}`, { append_to_response: "credits,videos,images,content_ratings" });

  let trailerUrl = null;
  const yt = details.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube");
  if (yt) trailerUrl = `https://www.youtube.com/watch?v=${yt.key}`;

  for (const g of details.genres || []) {
    const genre = await prisma.genre.upsert({ where: { tmdbId: g.id }, update: { name: g.name }, create: { name: g.name, tmdbId: g.id } });
    await prisma.mediaGenre.upsert({ where: { mediaId_genreId: { mediaId: media.id, genreId: genre.id } }, update: {}, create: { mediaId: media.id, genreId: genre.id } });
  }

  for (const c of (details.credits?.cast || []).slice(0, 15)) {
    const person = await prisma.person.upsert({ where: { tmdbId: c.id }, update: { name: c.name, profileUrl: c.profile_path }, create: { name: c.name, tmdbId: c.id, profileUrl: c.profile_path } });
    await prisma.mediaCast.upsert({
      where: { mediaId_personId_character: { mediaId: media.id, personId: person.id, character: c.character || "" } },
      update: { order: c.order },
      create: { mediaId: media.id, personId: person.id, character: c.character || "", order: c.order },
    }).catch(() => {});
  }

  await prisma.media.update({
    where: { id: media.id },
    data: {
      title: details.name,
      originalTitle: details.original_name,
      overview: details.overview,
      tagline: details.tagline,
      releaseDate: details.first_air_date ? new Date(details.first_air_date) : null,
      endDate: details.last_air_date ? new Date(details.last_air_date) : null,
      rating: details.vote_average,
      voteCount: details.vote_count,
      popularity: details.popularity,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      logoPath: details.images?.logos?.[0]?.file_path || null,
      trailerUrl,
      tmdbId: details.id,
      status: "MATCHED",
    },
  });

  return true;
}

async function run() {
  const pending = await prisma.media.findMany({ where: { status: "PENDING" }, select: { id: true, title: true, type: true } });
  console.log(`${pending.length} medias to process`);

  let matched = 0, failed = 0;
  for (let i = 0; i < pending.length; i++) {
    const m = pending[i];
    try {
      const ok = m.type === "MOVIE" ? await matchMovie(m) : await matchSeries(m);
      if (ok) { matched++; } else {
        await prisma.media.update({ where: { id: m.id }, data: { status: "UNMATCHED" } });
        failed++;
      }
    } catch (e) {
      await prisma.media.update({ where: { id: m.id }, data: { status: "UNMATCHED" } });
      failed++;
    }

    if ((i + 1) % 25 === 0) console.log(`[${i + 1}/${pending.length}] matched: ${matched} | failed: ${failed}`);

    // Rate limit: ~4 req/sec max for TMDB
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\nDone! Matched: ${matched} | Failed: ${failed} | Total: ${pending.length}`);
  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
