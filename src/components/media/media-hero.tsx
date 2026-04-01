"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Info, Plus, Check } from "lucide-react";
import { tmdbImageUrl } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface MediaHeroProps {
  id: string;
  title: string;
  overview: string | null;
  backdropPath: string | null;
  logoPath?: string | null | undefined;
  type: "MOVIE" | "SERIES";
  mediaFileId?: string;
  inWatchlist?: boolean;
  onWatchlistToggle?: () => void;
}

export function MediaHero({
  id,
  title,
  overview,
  backdropPath,
  logoPath,
  type,
  mediaFileId,
  inWatchlist,
  onWatchlistToggle,
}: MediaHeroProps) {
  const [imgError, setImgError] = useState(false);
  const backdropUrl = tmdbImageUrl(backdropPath, "w1280");
  const logoUrl = tmdbImageUrl(logoPath ?? null, "w500");
  const detailHref = type === "MOVIE" ? `/movie/${id}` : `/series/${id}`;

  return (
    <div className="relative h-[60vh] md:h-[80vh] w-full">
      {/* Backdrop image */}
      {backdropUrl && !imgError ? (
        <Image
          src={backdropUrl}
          alt={title}
          fill
          className="object-cover object-top"
          priority
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface to-background" />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute bottom-[15%] left-4 md:left-12 max-w-xl z-10">
        {logoUrl ? (
          <div className="relative w-64 md:w-80 h-20 md:h-28 mb-4">
            <Image
              src={logoUrl}
              alt={title}
              fill
              className="object-contain object-left"
            />
          </div>
        ) : (
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{title}</h1>
        )}

        {overview && (
          <p className="text-sm md:text-base text-text-muted line-clamp-3 mb-6">
            {overview}
          </p>
        )}

        <div className="flex items-center gap-3">
          {mediaFileId ? (
            <Link href={`/watch/${mediaFileId}`}>
              <Button size="lg" className="gap-2">
                <Play size={20} className="fill-white" />
                Lecture
              </Button>
            </Link>
          ) : (
            <Link href={detailHref}>
              <Button size="lg" className="gap-2">
                <Play size={20} className="fill-white" />
                Lecture
              </Button>
            </Link>
          )}

          <Link href={detailHref}>
            <Button variant="secondary" size="lg" className="gap-2">
              <Info size={20} />
              Plus d&apos;infos
            </Button>
          </Link>

          {onWatchlistToggle && (
            <button
              onClick={onWatchlistToggle}
              className="border border-text-dim hover:border-white rounded-full p-2 transition-colors"
            >
              {inWatchlist ? <Check size={20} /> : <Plus size={20} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
