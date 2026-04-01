"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MediaCard } from "./media-card";

interface MediaItem {
  id: string;
  title: string;
  posterPath: string | null;
  type: "MOVIE" | "SERIES";
  rating?: number | null;
  releaseDate?: string | null;
  mediaFiles?: { id: string }[];
}

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  watchlistIds?: Set<string>;
  onWatchlistToggle?: (mediaId: string) => void;
}

export function MediaRow({ title, items, watchlistIds, onWatchlistToggle }: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <div className="mb-8 group/row">
      <h2 className="text-lg md:text-xl font-semibold mb-3 px-4 md:px-12">
        {title}
      </h2>

      <div className="relative">
        {/* Scroll buttons */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-10 w-12 bg-black/50 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/70"
        >
          <ChevronLeft size={24} />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto hide-scrollbar px-4 md:px-12 pb-4"
        >
          {items.filter((item, idx, arr) => arr.findIndex((a) => a.id === item.id) === idx).map((item) => (
            <MediaCard
              key={item.id}
              id={item.id}
              title={item.title}
              posterPath={item.posterPath}
              type={item.type}
              rating={item.rating}
              year={
                item.releaseDate
                  ? new Date(item.releaseDate).getFullYear().toString()
                  : undefined
              }
              mediaFileId={item.mediaFiles?.[0]?.id}
              inWatchlist={watchlistIds?.has(item.id)}
              onWatchlistToggle={onWatchlistToggle}
            />
          ))}
        </div>

        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-black/50 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/70"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}
