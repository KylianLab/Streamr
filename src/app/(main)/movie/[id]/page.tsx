"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Plus, Check, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { tmdbImageUrl } from "@/lib/tmdb";
import { formatDuration, getYear } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MovieDetail {
  id: string;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  tagline: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  runtime: number | null;
  rating: number | null;
  contentRating: string | null;
  genres: { genre: { id: string; name: string } }[];
  cast: { person: { id: string; name: string; profileUrl: string | null }; character: string | null; order: number }[];
  mediaFiles: { id: string; duration: number | null; resolution: string | null; subtitles: { id: string; language: string; languageName: string | null }[] }[];
}

export default function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    fetch(`/api/media/${id}`)
      .then((r) => r.json())
      .then(setMovie);

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

  if (!movie) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
      </div>
    );
  }

  const backdropUrl = tmdbImageUrl(movie.backdropPath, "w1280");
  const posterUrl = tmdbImageUrl(movie.posterPath, "w500");
  const mainFile = movie.mediaFiles[0];

  return (
    <div>
      {/* Backdrop */}
      <div className="relative h-[50vh] md:h-[70vh]">
        {backdropUrl && (
          <Image src={backdropUrl} alt={movie.title} fill className="object-cover object-top" priority />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        <button
          onClick={() => router.back()}
          className="absolute top-20 left-4 md:left-12 z-10 bg-black/50 rounded-full p-2 hover:bg-black/70"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="relative -mt-48 z-10 px-4 md:px-12 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          {posterUrl && (
            <div className="hidden md:block flex-shrink-0 w-64">
              <div className="aspect-[2/3] relative rounded-lg overflow-hidden shadow-2xl">
                <Image src={posterUrl} alt={movie.title} fill className="object-cover" />
              </div>
            </div>
          )}

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-3xl md:text-5xl font-bold mb-2">{movie.title}</h1>

            {movie.tagline && (
              <p className="text-text-muted italic mb-4">{movie.tagline}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted mb-4">
              {movie.rating && (
                <span className="text-green-400 font-semibold text-base">
                  {Math.round(movie.rating * 10)}%
                </span>
              )}
              {movie.releaseDate && <span>{getYear(movie.releaseDate)}</span>}
              {movie.runtime && <span>{formatDuration(movie.runtime * 60)}</span>}
              {movie.contentRating && (
                <span className="border border-text-dim px-1.5 py-0.5 text-xs">
                  {movie.contentRating}
                </span>
              )}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2 mb-6">
              {movie.genres.map(({ genre }) => (
                <span key={genre.id} className="bg-surface border border-border px-3 py-1 rounded-full text-sm">
                  {genre.name}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mb-6">
              {mainFile && (
                <Link href={`/watch/${mainFile.id}`}>
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

            {/* Overview */}
            {movie.overview && (
              <p className="text-text-muted leading-relaxed mb-8">{movie.overview}</p>
            )}

            {/* Cast */}
            {movie.cast.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Distribution</h3>
                <div className="flex flex-wrap gap-4">
                  {movie.cast.slice(0, 10).map((c) => (
                    <div key={c.person.id} className="text-center w-20">
                      <div className="w-16 h-16 mx-auto rounded-full bg-surface overflow-hidden mb-1">
                        {c.person.profileUrl ? (
                          <Image
                            src={tmdbImageUrl(c.person.profileUrl, "w200")!}
                            alt={c.person.name}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-dim text-lg">
                            {c.person.name[0]}
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-medium truncate">{c.person.name}</p>
                      <p className="text-xs text-text-dim truncate">{c.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
