"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MediaCard } from "@/components/media/media-card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface MediaItem {
  id: string;
  title: string;
  posterPath: string | null;
  type: "MOVIE" | "SERIES";
  rating: number | null;
  releaseDate: string | null;
  mediaFiles: { id: string }[];
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(data.data || []);
          setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="px-4 md:px-12 py-8">
      <div className="max-w-xl mx-auto mb-8">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher des films, séries..."
            className="pl-10 text-lg py-4"
            autoFocus
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map((item) => (
            <MediaCard
              key={item.id}
              id={item.id}
              title={item.title}
              posterPath={item.posterPath}
              type={item.type}
              rating={item.rating}
              year={item.releaseDate ? new Date(item.releaseDate).getFullYear().toString() : undefined}
              mediaFileId={item.mediaFiles?.[0]?.id}
            />
          ))}
        </div>
      ) : query.length >= 2 ? (
        <p className="text-center text-text-muted py-12">
          Aucun résultat pour &quot;{query}&quot;
        </p>
      ) : null}
    </div>
  );
}
