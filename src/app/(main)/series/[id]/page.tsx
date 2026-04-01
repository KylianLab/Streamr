"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Plus, Check, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { tmdbImageUrl } from "@/lib/tmdb";
import { getYear } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SeriesDetail {
  id: string;
  title: string;
  overview: string | null;
  tagline: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  endDate: string | null;
  rating: number | null;
  contentRating: string | null;
  genres: { genre: { id: string; name: string } }[];
  cast: { person: { id: string; name: string; profileUrl: string | null }; character: string | null }[];
  seasons: {
    id: string;
    seasonNumber: number;
    name: string | null;
    overview: string | null;
    posterPath: string | null;
    episodes: {
      id: string;
      episodeNumber: number;
      title: string | null;
      overview: string | null;
      stillPath: string | null;
      runtime: number | null;
      mediaFiles: { id: string }[];
    }[];
  }[];
}

export default function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(0);
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    fetch(`/api/media/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setSeries(data);
        if (data.seasons?.length > 0) setSelectedSeason(0);
      });

    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list)) {
          setInWatchlist(list.some((w: { media: { id: string } }) => w.media.id === id));
        }
      })
      .catch(() => {});
  }, [id]);

  async function toggleWatchlist() {
    if (inWatchlist) {
      await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    } else {
      await fetch(`/api/watchlist/${id}`, { method: "POST" });
    }
    setInWatchlist(!inWatchlist);
  }

  if (!series) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
      </div>
    );
  }

  const backdropUrl = tmdbImageUrl(series.backdropPath, "w1280");
  const currentSeason = series.seasons[selectedSeason];

  // Find first playable episode
  const firstPlayable = series.seasons
    .flatMap((s) => s.episodes)
    .find((e) => e.mediaFiles.length > 0);

  return (
    <div>
      {/* Backdrop */}
      <div className="relative h-[50vh] md:h-[60vh]">
        {backdropUrl && (
          <Image src={backdropUrl} alt={series.title} fill className="object-cover object-top" priority />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <button
          onClick={() => router.back()}
          className="absolute top-20 left-4 md:left-12 z-10 bg-black/50 rounded-full p-2 hover:bg-black/70"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="relative -mt-32 z-10 px-4 md:px-12 max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-bold mb-2">{series.title}</h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted mb-4">
          {series.rating && (
            <span className="text-green-400 font-semibold">
              {Math.round(series.rating * 10)}%
            </span>
          )}
          {series.releaseDate && (
            <span>
              {getYear(series.releaseDate)}
              {series.endDate ? ` - ${getYear(series.endDate)}` : " - En cours"}
            </span>
          )}
          {series.contentRating && (
            <span className="border border-text-dim px-1.5 py-0.5 text-xs">
              {series.contentRating}
            </span>
          )}
          <span>{series.seasons.length} saison{series.seasons.length > 1 ? "s" : ""}</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {series.genres.map(({ genre }) => (
            <span key={genre.id} className="bg-surface border border-border px-3 py-1 rounded-full text-sm">
              {genre.name}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-6">
          {firstPlayable && (
            <Link href={`/watch/${firstPlayable.mediaFiles[0].id}`}>
              <Button size="lg" className="gap-2">
                <Play size={20} className="fill-white" />
                Lecture
              </Button>
            </Link>
          )}
          <Button variant="secondary" size="lg" className="gap-2" onClick={toggleWatchlist}>
            {inWatchlist ? <Check size={20} /> : <Plus size={20} />}
            {inWatchlist ? "Dans ma liste" : "Ma liste"}
          </Button>
        </div>

        {series.overview && (
          <p className="text-text-muted leading-relaxed mb-8 max-w-3xl">{series.overview}</p>
        )}

        {/* Season selector */}
        {series.seasons.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2">
              {series.seasons.map((season, idx) => (
                <button
                  key={season.id}
                  onClick={() => setSelectedSeason(idx)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors",
                    idx === selectedSeason
                      ? "bg-white text-black font-medium"
                      : "bg-surface hover:bg-surface-hover text-text-muted"
                  )}
                >
                  {season.name || `Saison ${season.seasonNumber}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Episodes */}
        {currentSeason && (
          <div className="space-y-3 pb-12">
            {currentSeason.episodes.map((episode) => {
              const stillUrl = tmdbImageUrl(episode.stillPath, "w300");
              const playable = episode.mediaFiles.length > 0;

              return (
                <div
                  key={episode.id}
                  className="flex gap-4 bg-surface/50 rounded-lg p-3 hover:bg-surface transition-colors group"
                >
                  {/* Episode thumbnail */}
                  <div className="relative w-40 aspect-video flex-shrink-0 rounded overflow-hidden bg-surface">
                    {stillUrl ? (
                      <Image src={stillUrl} alt={episode.title || ""} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-dim text-sm">
                        E{episode.episodeNumber}
                      </div>
                    )}
                    {playable && (
                      <Link
                        href={`/watch/${episode.mediaFiles[0].id}`}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Play size={28} className="text-white fill-white" />
                      </Link>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-text-dim text-sm">{episode.episodeNumber}.</span>
                      <h4 className="font-medium truncate">
                        {episode.title || `Épisode ${episode.episodeNumber}`}
                      </h4>
                      {episode.runtime && (
                        <span className="text-text-dim text-sm ml-auto flex-shrink-0">
                          {episode.runtime} min
                        </span>
                      )}
                    </div>
                    {episode.overview && (
                      <p className="text-sm text-text-muted line-clamp-2">{episode.overview}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
