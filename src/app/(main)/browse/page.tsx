"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MediaHero } from "@/components/media/media-hero";
import { MediaRow } from "@/components/media/media-row";
import { Skeleton } from "@/components/ui/skeleton";

interface MediaItem {
  id: string;
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  logoPath: string | null;
  type: "MOVIE" | "SERIES";
  rating: number | null;
  releaseDate: string | null;
  genres: { genre: { id: string; name: string } }[];
  mediaFiles: { id: string; duration: number | null; resolution: string | null }[];
}

interface Genre {
  id: string;
  name: string;
  _count: { media: number };
}

interface WatchHistoryItem {
  id: string;
  percentage: number;
  mediaFile: {
    id: string;
    media?: MediaItem | null;
    episode?: {
      season: { media: MediaItem };
    } | null;
  };
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen"><Skeleton className="h-[80vh] w-full" /></div>}>
      <BrowseContent />
    </Suspense>
  );
}

function BrowseContent() {
  const searchParams = useSearchParams();
  const typeFilter = searchParams.get("type");

  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchHistoryItem[]>([]);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    params.set("limit", "100");
    params.set("sort", "popularity");

    Promise.all([
      fetch(`/api/media?${params}`).then((r) => r.json()),
      fetch("/api/genres").then((r) => r.json()),
      fetch("/api/watch-history").then((r) => r.json()).catch(() => []),
      fetch("/api/watchlist").then((r) => r.json()).catch(() => []),
    ]).then(([mediaRes, genresRes, historyRes, watchlistRes]) => {
      setAllMedia(mediaRes.data || []);
      setGenres(genresRes || []);
      setContinueWatching(Array.isArray(historyRes) ? historyRes : []);
      setWatchlistIds(
        new Set(
          Array.isArray(watchlistRes)
            ? watchlistRes.map((w: { media: { id: string } }) => w.media.id)
            : []
        )
      );
      setLoading(false);
    });
  }, [typeFilter]);

  const toggleWatchlist = useCallback(async (mediaId: string) => {
    const isInList = watchlistIds.has(mediaId);

    if (isInList) {
      await fetch(`/api/watchlist/${mediaId}`, { method: "DELETE" });
      setWatchlistIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    } else {
      await fetch(`/api/watchlist/${mediaId}`, { method: "POST" });
      setWatchlistIds((prev) => new Set(prev).add(mediaId));
    }
  }, [watchlistIds]);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-[80vh] w-full" />
        <div className="px-12 mt-8 space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="h-6 w-48 mb-3" />
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <Skeleton key={j} className="w-[200px] aspect-[2/3]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Pick a random featured item with a backdrop
  const featured = allMedia.filter((m) => m.backdropPath);
  const heroItem = featured.length > 0
    ? featured[Math.floor(Math.random() * Math.min(featured.length, 5))]
    : allMedia[0];

  // Organize by genre
  const mediaByGenre = new Map<string, MediaItem[]>();
  for (const item of allMedia) {
    for (const { genre } of item.genres) {
      if (!mediaByGenre.has(genre.name)) {
        mediaByGenre.set(genre.name, []);
      }
      mediaByGenre.get(genre.name)!.push(item);
    }
  }

  // Recently added
  const recentlyAdded = [...allMedia]
    .sort((a, b) => {
      const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return db - da;
    })
    .slice(0, 20);

  // Top rated
  const topRated = [...allMedia]
    .filter((m) => m.rating)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 20);

  // Continue watching items converted to media format
  const continueItems = continueWatching
    .map((h) => h.mediaFile.media || h.mediaFile.episode?.season?.media)
    .filter(Boolean) as MediaItem[];

  return (
    <div>
      {/* Hero */}
      {heroItem && (
        <MediaHero
          id={heroItem.id}
          title={heroItem.title}
          overview={heroItem.overview}
          backdropPath={heroItem.backdropPath}
          logoPath={heroItem.logoPath}
          type={heroItem.type}
          mediaFileId={heroItem.mediaFiles?.[0]?.id}
          inWatchlist={watchlistIds.has(heroItem.id)}
          onWatchlistToggle={() => toggleWatchlist(heroItem.id)}
        />
      )}

      <div className="-mt-20 relative z-10">
        {/* Continue Watching */}
        {continueItems.length > 0 && (
          <MediaRow
            title="Reprendre la lecture"
            items={continueItems}
            watchlistIds={watchlistIds}
            onWatchlistToggle={toggleWatchlist}
          />
        )}

        {/* Recently Added */}
        <MediaRow
          title="Ajoutés récemment"
          items={recentlyAdded}
          watchlistIds={watchlistIds}
          onWatchlistToggle={toggleWatchlist}
        />

        {/* Top Rated */}
        {topRated.length > 0 && (
          <MediaRow
            title="Les mieux notés"
            items={topRated}
            watchlistIds={watchlistIds}
            onWatchlistToggle={toggleWatchlist}
          />
        )}

        {/* Genre rows */}
        {genres.map((genre) => {
          const items = mediaByGenre.get(genre.name) || [];
          if (items.length === 0) return null;
          return (
            <MediaRow
              key={genre.id}
              title={genre.name}
              items={items}
              watchlistIds={watchlistIds}
              onWatchlistToggle={toggleWatchlist}
            />
          );
        })}
      </div>
    </div>
  );
}
