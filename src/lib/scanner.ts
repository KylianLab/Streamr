import { readdir, stat } from "fs/promises";
import { join, extname, basename, dirname } from "path";
import { prisma } from "./prisma";
import { probeFile } from "./ffmpeg";
import { VIDEO_EXTENSIONS, SUBTITLE_EXTENSIONS } from "@/config/constants";
import { MediaType, SubtitleFormat } from "@prisma/client";
import { parseMediaFilename, parseEpisodeFilename } from "./media-matcher";

export async function scanLibrary(libraryPathId: string) {
  const library = await prisma.libraryPath.findUnique({
    where: { id: libraryPathId },
  });

  if (!library) throw new Error("Library path not found");

  await prisma.libraryPath.update({
    where: { id: libraryPathId },
    data: { scanStatus: "SCANNING" },
  });

  try {
    const files = await walkDirectory(library.path);

    const videoFiles = files.filter((f) =>
      VIDEO_EXTENSIONS.includes(extname(f).toLowerCase())
    );

    const subtitleFiles = files.filter((f) =>
      SUBTITLE_EXTENSIONS.includes(extname(f).toLowerCase())
    );

    let scanned = 0;
    for (const filePath of videoFiles) {
      try {
        await processVideoFile(filePath, library.id, library.mediaType);
        scanned++;
      } catch (e) {
        console.error(`Error processing ${filePath}:`, e);
      }
    }

    // Process subtitles
    for (const subPath of subtitleFiles) {
      try {
        await processSubtitleFile(subPath);
      } catch (e) {
        console.error(`Error processing subtitle ${subPath}:`, e);
      }
    }

    await prisma.libraryPath.update({
      where: { id: libraryPathId },
      data: { scanStatus: "IDLE", lastScanAt: new Date() },
    });

    return { scanned, total: videoFiles.length };
  } catch (error) {
    await prisma.libraryPath.update({
      where: { id: libraryPathId },
      data: { scanStatus: "ERROR" },
    });
    throw error;
  }
}

async function walkDirectory(dir: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await walkDirectory(fullPath);
        results.push(...sub);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  } catch (e) {
    console.error(`Cannot read directory ${dir}:`, e);
  }

  return results;
}

async function processVideoFile(
  filePath: string,
  libraryPathId: string,
  mediaType: MediaType
) {
  // Check if already in DB — update HDR flag if missing
  const existing = await prisma.mediaFile.findUnique({
    where: { filePath },
  });
  if (existing) {
    if (!existing.isHdr) {
      try {
        const probe = await probeFile(filePath);
        if (probe.isHdr) {
          await prisma.mediaFile.update({
            where: { id: existing.id },
            data: { isHdr: true },
          });
        }
      } catch {}
    }
    return;
  }

  // Get file info
  const fileInfo = await stat(filePath);
  const fileName = basename(filePath);

  // Probe with FFmpeg
  let probe;
  try {
    probe = await probeFile(filePath);
  } catch {
    console.error(`Cannot probe ${filePath}`);
    return;
  }

  // Create the media file record
  const mediaFile = await prisma.mediaFile.create({
    data: {
      filePath,
      fileName,
      fileSize: BigInt(fileInfo.size),
      containerFormat: probe.containerFormat,
      videoCodec: probe.videoCodec,
      audioCodec: probe.audioCodec,
      resolution: probe.resolution,
      duration: probe.duration,
      bitrate: probe.bitrate,
      channels: probe.channels,
      isHdr: probe.isHdr,
      libraryPathId,
    },
  });

  // Try to match to a media entry
  if (mediaType === "MOVIE") {
    const parsed = parseMediaFilename(fileName);
    if (parsed) {
      let media = await prisma.media.findFirst({
        where: {
          title: { contains: parsed.title },
          type: "MOVIE",
        },
      });

      if (!media) {
        media = await prisma.media.create({
          data: {
            type: "MOVIE",
            title: parsed.title,
            status: "PENDING",
          },
        });
      }

      await prisma.mediaFile.update({
        where: { id: mediaFile.id },
        data: { mediaId: media.id },
      });
    }
  } else {
    // Series
    const parentDir = basename(dirname(filePath));
    const grandParentDir = basename(dirname(dirname(filePath)));
    const parsed = parseEpisodeFilename(fileName);

    if (parsed) {
      const seriesTitle = grandParentDir || parsed.seriesTitle || parentDir;

      let media = await prisma.media.findFirst({
        where: {
          title: { contains: seriesTitle },
          type: "SERIES",
        },
      });

      if (!media) {
        media = await prisma.media.create({
          data: {
            type: "SERIES",
            title: seriesTitle,
            status: "PENDING",
          },
        });
      }

      let season = await prisma.season.findFirst({
        where: {
          mediaId: media.id,
          seasonNumber: parsed.season,
        },
      });

      if (!season) {
        season = await prisma.season.create({
          data: {
            mediaId: media.id,
            seasonNumber: parsed.season,
            name: `Saison ${parsed.season}`,
          },
        });
      }

      let episode = await prisma.episode.findFirst({
        where: {
          seasonId: season.id,
          episodeNumber: parsed.episode,
        },
      });

      if (!episode) {
        episode = await prisma.episode.create({
          data: {
            seasonId: season.id,
            episodeNumber: parsed.episode,
            title: parsed.episodeTitle,
          },
        });
      }

      await prisma.mediaFile.update({
        where: { id: mediaFile.id },
        data: { episodeId: episode.id },
      });
    }
  }
}

async function processSubtitleFile(filePath: string) {
  const existing = await prisma.subtitle.findUnique({
    where: { filePath },
  });
  if (existing) return;

  const fileName = basename(filePath);
  const ext = extname(fileName).toLowerCase().slice(1) as string;

  // Parse language from filename: movie.en.srt, movie.fr.srt
  const parts = fileName.replace(extname(fileName), "").split(".");
  const langCode = parts.length > 1 ? parts[parts.length - 1] : "und";

  const langNames: Record<string, string> = {
    en: "English",
    fr: "Français",
    es: "Español",
    de: "Deutsch",
    it: "Italiano",
    pt: "Português",
    ja: "日本語",
    ko: "한국어",
    zh: "中文",
    ar: "العربية",
    und: "Unknown",
  };

  // Find matching video file (same directory, same base name)
  const videoBaseName = parts[0];
  const dir = dirname(filePath);

  const matchingFile = await prisma.mediaFile.findFirst({
    where: {
      filePath: { startsWith: dir },
      fileName: { startsWith: videoBaseName },
    },
  });

  if (!matchingFile) return;

  const formatMap: Record<string, SubtitleFormat> = {
    srt: "SRT",
    vtt: "VTT",
    ass: "ASS",
    ssa: "SSA",
  };

  await prisma.subtitle.create({
    data: {
      mediaFileId: matchingFile.id,
      filePath,
      language: langCode.length <= 3 ? langCode : "und",
      languageName: langNames[langCode] || langCode,
      format: formatMap[ext] || "SRT",
      isForced: fileName.toLowerCase().includes("forced"),
    },
  });
}
