/**
 * Parse media filenames to extract title, year, season, episode info.
 *
 * Supports patterns like:
 * - "Movie Name (2023).mkv"
 * - "Movie.Name.2023.1080p.BluRay.mkv"
 * - "Movie Name [2023].mkv"
 * - "S01E05 - Episode Title.mkv"
 * - "Series.S01E05.Episode.Title.mkv"
 */

export interface ParsedMovie {
  title: string;
  year?: string;
}

export interface ParsedEpisode {
  seriesTitle?: string;
  season: number;
  episode: number;
  episodeTitle?: string;
}

export function parseMediaFilename(fileName: string): ParsedMovie | null {
  // Remove extension
  const name = fileName.replace(/\.[^.]+$/, "");

  // Try: "Movie Name (2023)" or "Movie Name [2023]"
  let match = name.match(/^(.+?)[\s._]*[(\[](\d{4})[)\]]/);
  if (match) {
    return {
      title: cleanTitle(match[1]),
      year: match[2],
    };
  }

  // Try: "Movie.Name.2023.1080p..."
  match = name.match(/^(.+?)[\s._]+((?:19|20)\d{2})[\s._]/);
  if (match) {
    return {
      title: cleanTitle(match[1]),
      year: match[2],
    };
  }

  // Fallback: use the whole name as title
  return {
    title: cleanTitle(name),
  };
}

export function parseEpisodeFilename(fileName: string): ParsedEpisode | null {
  const name = fileName.replace(/\.[^.]+$/, "");

  // Pattern: S01E05 or s01e05
  let match = name.match(/^(.*?)[.\s_-]*[Ss](\d{1,2})[Ee](\d{1,3})[.\s_-]*(.*)?$/);
  if (match) {
    return {
      seriesTitle: match[1] ? cleanTitle(match[1]) : undefined,
      season: parseInt(match[2]),
      episode: parseInt(match[3]),
      episodeTitle: match[4] ? cleanTitle(match[4]) : undefined,
    };
  }

  // Pattern: 1x05 or 01x05
  match = name.match(/^(.*?)[.\s_-]*(\d{1,2})x(\d{1,3})[.\s_-]*(.*)?$/);
  if (match) {
    return {
      seriesTitle: match[1] ? cleanTitle(match[1]) : undefined,
      season: parseInt(match[2]),
      episode: parseInt(match[3]),
      episodeTitle: match[4] ? cleanTitle(match[4]) : undefined,
    };
  }

  return null;
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/[._]/g, " ") // Replace dots/underscores with spaces
    .replace(
      /\b(720p|1080p|2160p|4k|bluray|brrip|dvdrip|webrip|web-dl|hdtv|x264|x265|hevc|aac|ac3|dts|5\.1|7\.1|remux|proper|repack)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}
