"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { RefreshCw, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { tmdbImageUrl } from "@/lib/tmdb";

interface MediaItem {
  id: string;
  title: string;
  type: "MOVIE" | "SERIES";
  posterPath: string | null;
  status: string;
  tmdbId: number | null;
  releaseDate: string | null;
  _count: { seasons: number };
  mediaFiles: { id: string }[];
}

export default function AdminMediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadMedia();
  }, []);

  async function loadMedia() {
    const res = await fetch("/api/media?limit=200");
    const data = await res.json();
    setMedia(data.data || []);
    setLoading(false);
  }

  async function refreshMetadata(id: string) {
    toast("Recherche TMDB...", "info");
    const res = await fetch(`/api/media/${id}/metadata`, { method: "POST" });
    if (res.ok) {
      toast("Métadonnées mises à jour", "success");
      loadMedia();
    } else {
      toast("Métadonnées introuvables", "error");
    }
  }

  async function deleteMedia(id: string) {
    await fetch(`/api/media/${id}`, { method: "DELETE" });
    toast("Média supprimé", "success");
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }

  async function refreshAll() {
    const pending = media.filter((m) => m.status === "PENDING");
    toast(`Recherche TMDB pour ${pending.length} médias...`, "info");

    for (const m of pending) {
      try {
        await fetch(`/api/media/${m.id}/metadata`, { method: "POST" });
      } catch {
        // Continue
      }
    }

    toast("Toutes les métadonnées ont été mises à jour", "success");
    loadMedia();
  }

  const filtered = media.filter((m) => {
    if (searchQuery && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filter === "movies") return m.type === "MOVIE";
    if (filter === "series") return m.type === "SERIES";
    if (filter === "pending") return m.status === "PENDING";
    if (filter === "unmatched") return m.status === "UNMATCHED";
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Médias</h1>
        <Button variant="secondary" onClick={refreshAll} className="gap-2">
          <RefreshCw size={16} />
          Rafraîchir tout (TMDB)
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="pl-9"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-surface border border-border rounded px-3 text-sm text-white"
        >
          <option value="all">Tous</option>
          <option value="movies">Films</option>
          <option value="series">Séries</option>
          <option value="pending">En attente</option>
          <option value="unmatched">Non trouvés</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const posterUrl = tmdbImageUrl(item.posterPath, "w200");
            return (
              <div key={item.id} className="flex items-center gap-4 bg-surface border border-border rounded-lg p-3">
                <div className="w-12 h-16 rounded overflow-hidden bg-surface-hover flex-shrink-0">
                  {posterUrl ? (
                    <Image src={posterUrl} alt="" width={48} height={64} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-dim text-xs">
                      ?
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{item.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-text-dim mt-0.5">
                    <span>{item.type === "MOVIE" ? "Film" : "Série"}</span>
                    <span className={`px-1.5 py-0.5 rounded ${
                      item.status === "MATCHED" ? "bg-green-900 text-green-300" :
                      item.status === "PENDING" ? "bg-yellow-900 text-yellow-300" :
                      "bg-red-900 text-red-300"
                    }`}>
                      {item.status === "MATCHED" ? "OK" : item.status === "PENDING" ? "En attente" : "Non trouvé"}
                    </span>
                    {item.tmdbId && <span>TMDB: {item.tmdbId}</span>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => refreshMetadata(item.id)} title="Rafraîchir métadonnées">
                  <RefreshCw size={16} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteMedia(item.id)}>
                  <Trash2 size={16} className="text-red-400" />
                </Button>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-text-muted text-center py-12">Aucun média trouvé.</p>
          )}
        </div>
      )}
    </div>
  );
}
