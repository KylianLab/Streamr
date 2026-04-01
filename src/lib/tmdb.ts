import { TMDB_IMAGE_BASE } from "@/config/constants";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  media_type?: string;
}

interface TMDBMovieDetail {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  tagline: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number;
  vote_average: number;
  vote_count: number;
  popularity: number;
  imdb_id: string | null;
  genres: { id: number; name: string }[];
  credits?: {
    cast: TMDBCastMember[];
  };
  content_ratings?: {
    results: { iso_3166_1: string; rating: string }[];
  };
  images?: {
    logos: { file_path: string; iso_639_1: string | null }[];
  };
  videos?: {
    results: { key: string; site: string; type: string }[];
  };
}

interface TMDBSeriesDetail {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  tagline: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date: string | null;
  number_of_seasons: number;
  episode_run_time: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  genres: { id: number; name: string }[];
  credits?: {
    cast: TMDBCastMember[];
  };
  content_ratings?: {
    results: { iso_3166_1: string; rating: string }[];
  };
  images?: {
    logos: { file_path: string; iso_639_1: string | null }[];
  };
  videos?: {
    results: { key: string; site: string; type: string }[];
  };
  seasons: {
    id: number;
    season_number: number;
    name: string;
    overview: string;
    poster_path: string | null;
    air_date: string | null;
    episode_count: number;
  }[];
}

interface TMDBSeasonDetail {
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episodes: {
    episode_number: number;
    name: string;
    overview: string;
    still_path: string | null;
    air_date: string | null;
    runtime: number | null;
  }[];
}

interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!TMDB_API_KEY) throw new Error("TMDB_API_KEY not configured");

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "fr-FR");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
  return res.json();
}

export async function searchMovie(title: string, year?: string) {
  const params: Record<string, string> = { query: title };
  if (year) params.year = year;

  const data = await tmdbFetch<{ results: TMDBSearchResult[] }>(
    "/search/movie",
    params
  );
  return data.results;
}

export async function searchSeries(title: string, year?: string) {
  const params: Record<string, string> = { query: title };
  if (year) params.first_air_date_year = year;

  const data = await tmdbFetch<{ results: TMDBSearchResult[] }>(
    "/search/tv",
    params
  );
  return data.results;
}

export async function getMovieDetails(tmdbId: number): Promise<TMDBMovieDetail> {
  return tmdbFetch<TMDBMovieDetail>(
    `/movie/${tmdbId}`,
    { append_to_response: "credits,content_ratings,images,videos" }
  );
}

export async function getSeriesDetails(tmdbId: number): Promise<TMDBSeriesDetail> {
  return tmdbFetch<TMDBSeriesDetail>(
    `/tv/${tmdbId}`,
    { append_to_response: "credits,content_ratings,images,videos" }
  );
}

export async function getSeasonDetails(
  seriesTmdbId: number,
  seasonNumber: number
): Promise<TMDBSeasonDetail> {
  return tmdbFetch<TMDBSeasonDetail>(
    `/tv/${seriesTmdbId}/season/${seasonNumber}`
  );
}

export async function getGenreList() {
  const [movies, tv] = await Promise.all([
    tmdbFetch<{ genres: { id: number; name: string }[] }>("/genre/movie/list"),
    tmdbFetch<{ genres: { id: number; name: string }[] }>("/genre/tv/list"),
  ]);

  const genreMap = new Map<number, string>();
  for (const g of [...movies.genres, ...tv.genres]) {
    genreMap.set(g.id, g.name);
  }

  return Array.from(genreMap.entries()).map(([id, name]) => ({ id, name }));
}

export function tmdbImageUrl(
  path: string | null,
  size: "w200" | "w300" | "w500" | "w780" | "w1280" | "original" = "w500"
): string | null {
  if (!path) return null;
  // Already a full URL (e.g. from IPTV provider) → use as-is
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getTrailerUrl(
  videos?: { results: { key: string; site: string; type: string }[] }
): string | null {
  if (!videos?.results) return null;
  const trailer = videos.results.find(
    (v) => v.site === "YouTube" && v.type === "Trailer"
  );
  if (!trailer) return null;
  return `https://www.youtube.com/watch?v=${trailer.key}`;
}

export function getContentRating(
  ratings?: { results: { iso_3166_1: string; rating: string }[] }
): string | null {
  if (!ratings?.results) return null;
  const fr = ratings.results.find((r) => r.iso_3166_1 === "FR");
  const us = ratings.results.find((r) => r.iso_3166_1 === "US");
  return fr?.rating || us?.rating || null;
}
