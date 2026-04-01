"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tv } from "lucide-react";

interface IptvChannel {
  id: string;
  name: string;
  logoUrl: string | null;
  group: string | null;
  streamUrl: string;
}

export default function TvBrowsePage() {
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/iptv/channels")
      .then((r) => r.json())
      .then((data) => {
        setChannels(data.channels || []);
      })
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, []);

  const groups = Array.from(
    new Set(channels.map((c) => c.group).filter(Boolean))
  ) as string[];

  const filtered = activeGroup
    ? channels.filter((c) => c.group === activeGroup)
    : channels;

  if (loading) {
    return (
      <div className="min-h-screen px-6 md:px-12 pt-24 pb-12">
        <div className="h-8 w-48 bg-surface rounded animate-pulse mb-6" />
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-8 w-24 bg-surface rounded-full animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-lg p-4 animate-pulse"
            >
              <div className="aspect-square bg-surface-hover rounded mb-3" />
              <div className="h-4 w-3/4 bg-surface-hover rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 md:px-12 pt-24 pb-12">
      <h1 className="text-3xl font-bold text-white mb-6">TV en direct</h1>

      {/* Group filter pills */}
      {groups.length > 0 && (
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setActiveGroup(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeGroup === null
                ? "bg-primary text-white"
                : "bg-surface-hover text-text-muted hover:text-white"
            }`}
          >
            Toutes
          </button>
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => setActiveGroup(group)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeGroup === group
                  ? "bg-primary text-white"
                  : "bg-surface-hover text-text-muted hover:text-white"
              }`}
            >
              {group}
            </button>
          ))}
        </div>
      )}

      {/* Channel grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-text-muted">
          <Tv className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg">Aucune cha&icirc;ne TV disponible.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((channel) => (
            <Link
              key={channel.id}
              href={`/tv/watch/${channel.id}`}
              className="bg-surface border border-border rounded-lg p-4 hover:border-primary/50 transition-all cursor-pointer group"
            >
              <div className="aspect-square flex items-center justify-center mb-3 overflow-hidden rounded">
                {channel.logoUrl ? (
                  <img
                    src={channel.logoUrl}
                    alt={channel.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-hover rounded flex items-center justify-center">
                    <Tv className="w-10 h-10 text-text-dim" />
                  </div>
                )}
              </div>
              <p className="text-sm text-white font-medium truncate group-hover:text-primary transition-colors">
                {channel.name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
