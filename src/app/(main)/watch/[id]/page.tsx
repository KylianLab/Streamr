"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/player/video-player";

interface MediaFileDetail {
  id: string;
  duration: number | null;
  media?: {
    id: string;
    title: string;
    type: string;
  } | null;
  episode?: {
    id: string;
    episodeNumber: number;
    title: string | null;
    season: {
      id: string;
      seasonNumber: number;
      media: {
        id: string;
        title: string;
      };
      episodes: {
        id: string;
        episodeNumber: number;
        mediaFiles: { id: string }[];
      }[];
    };
  } | null;
  subtitles: {
    id: string;
    language: string;
    languageName: string | null;
    isDefault: boolean;
  }[];
}

interface WatchHistoryEntry {
  progress: number;
  mediaFileId?: string;
  mediaFile?: { id: string };
}

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: mediaFileId } = use(params);
  const router = useRouter();
  const [mediaFile, setMediaFile] = useState<MediaFileDetail | null>(null);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    // Fetch media file details
    fetch(`/api/media-file/${mediaFileId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setMediaFile)
      .catch(() => {
        // Fallback: try to use it directly
        setMediaFile({
          id: mediaFileId,
          duration: null,
          subtitles: [],
        });
      });

    // Fetch watch progress
    fetch(`/api/watch-history`)
      .then((r) => r.json())
      .then((history: WatchHistoryEntry[]) => {
        if (Array.isArray(history)) {
          const entry = history.find(
            (h) => h.mediaFileId === mediaFileId || h.mediaFile?.id === mediaFileId
          );
          if (entry) {
            setStartTime(entry.progress);
          }
        }
      })
      .catch(() => {});
  }, [mediaFileId]);

  function getTitle(): string {
    if (!mediaFile) return "Chargement...";
    if (mediaFile.episode) {
      return mediaFile.episode.season.media.title;
    }
    return mediaFile.media?.title || "Lecture en cours";
  }

  function getSubtitle(): string | undefined {
    if (!mediaFile?.episode) return undefined;
    const ep = mediaFile.episode;
    return `S${ep.season.seasonNumber.toString().padStart(2, "0")}E${ep.episodeNumber.toString().padStart(2, "0")} - ${ep.title || ""}`;
  }

  function handleEnded() {
    // Auto-play next episode
    if (mediaFile?.episode) {
      const season = mediaFile.episode.season;
      const currentEpNum = mediaFile.episode.episodeNumber;
      const nextEp = season.episodes.find(
        (e) => e.episodeNumber === currentEpNum + 1 && e.mediaFiles.length > 0
      );

      if (nextEp) {
        router.push(`/watch/${nextEp.mediaFiles[0].id}`);
        return;
      }
    }

    router.back();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <VideoPlayer
        mediaFileId={mediaFileId}
        title={getTitle()}
        subtitle={getSubtitle()}
        startTime={startTime}
        subtitles={mediaFile?.subtitles || []}
        onEnded={handleEnded}
        onBack={() => router.back()}
      />
    </div>
  );
}
