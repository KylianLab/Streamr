"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Plus, Check } from "lucide-react";
import { tmdbImageUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface MediaCardProps {
  id: string;
  title: string;
  posterPath: string | null;
  type: "MOVIE" | "SERIES";
  rating?: number | null;
  year?: string;
  mediaFileId?: string;
  inWatchlist?: boolean;
  onWatchlistToggle?: (mediaId: string) => void;
}

export function MediaCard({
  id,
  title,
  posterPath,
  type,
  rating,
  year,
  mediaFileId,
  inWatchlist,
  onWatchlistToggle,
}: MediaCardProps) {
  const [imgError, setImgError] = useState(false);
  const href = type === "MOVIE" ? `/movie/${id}` : `/series/${id}`;
  const imageUrl = tmdbImageUrl(posterPath, "w300");

  return (
    <div className="media-card group relative flex-shrink-0 w-[160px] md:w-[200px] rounded-md overflow-hidden cursor-pointer">
      <Link href={href}>
        <div className="aspect-[2/3] bg-surface relative">
          {imageUrl && !imgError ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-cover"
              sizes="200px"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-dim text-sm text-center p-4">
              {title}
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
            <div className="bg-white rounded-full p-2">
              <Play size={20} className="text-black fill-black" />
            </div>
          </div>
        </div>
      </Link>

      {/* Bottom info - visible on hover */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-sm font-medium truncate">{title}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
          {year && <span>{year}</span>}
          {rating && (
            <span className="text-green-400 font-medium">
              {Math.round(rating * 10)}%
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-2">
          {mediaFileId && (
            <Link
              href={`/watch/${mediaFileId}`}
              className="bg-white text-black rounded-full p-1 hover:bg-white/80"
            >
              <Play size={14} className="fill-black" />
            </Link>
          )}
          {onWatchlistToggle && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onWatchlistToggle(id);
              }}
              className={cn(
                "border rounded-full p-1 transition-colors",
                inWatchlist
                  ? "border-white bg-white/20"
                  : "border-text-dim hover:border-white"
              )}
            >
              {inWatchlist ? <Check size={14} /> : <Plus size={14} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
