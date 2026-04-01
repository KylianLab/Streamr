"use client";

import { useEffect, useState } from "react";
import { Film, Tv, Users, HardDrive, FolderOpen } from "lucide-react";

interface Stats {
  movies: number;
  series: number;
  episodes: number;
  users: number;
  mediaFiles: number;
  libraries: number;
  totalSize: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const cards = stats
    ? [
        { label: "Films", value: stats.movies, icon: Film, color: "text-blue-400" },
        { label: "Séries", value: stats.series, icon: Tv, color: "text-purple-400" },
        { label: "Épisodes", value: stats.episodes, icon: Film, color: "text-indigo-400" },
        { label: "Utilisateurs", value: stats.users, icon: Users, color: "text-green-400" },
        { label: "Fichiers", value: stats.mediaFiles, icon: HardDrive, color: "text-orange-400" },
        { label: "Bibliothèques", value: stats.libraries, icon: FolderOpen, color: "text-yellow-400" },
      ]
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Tableau de bord</h1>

      {!stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-6 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-surface border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text-muted text-sm">{card.label}</p>
                      <p className="text-3xl font-bold mt-1">{card.value}</p>
                    </div>
                    <Icon size={32} className={card.color} />
                  </div>
                </div>
              );
            })}
          </div>

          {stats.totalSize && (
            <div className="bg-surface border border-border rounded-lg p-6">
              <p className="text-text-muted text-sm">Espace total des médias</p>
              <p className="text-2xl font-bold mt-1">{stats.totalSize}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
