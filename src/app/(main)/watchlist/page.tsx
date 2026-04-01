"use client";

import { useEffect, useState } from "react";
import { MediaCard } from "@/components/media/media-card";

interface WatchlistItem {
  id: string;
  media: {
    id: string;
    title: string;
    posterPath: string | null;
    type: "MOVIE" | "SERIES";
    rating: number | null;
    releaseDate?: string | null;
    mediaFiles: { id: string }[];
  };
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWatchlist();
  }, []);

  async function loadWatchlist() {
    const res = await fetch("/api/watchlist");
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function removeFromWatchlist(mediaId: string) {
    await fetch(`/api/watchlist/${mediaId}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.media.id !== mediaId));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-12 py-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-8">Ma liste</h1>

      {items.length === 0 ? (
        <p className="text-text-muted text-center py-12">
          Votre liste est vide. Ajoutez des films et séries pour les retrouver ici.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              id={item.media.id}
              title={item.media.title}
              posterPath={item.media.posterPath}
              type={item.media.type}
              rating={item.media.rating}
              mediaFileId={item.media.mediaFiles?.[0]?.id}
              inWatchlist
              onWatchlistToggle={removeFromWatchlist}
            />
          ))}
        </div>
      )}
    </div>
  );
}
