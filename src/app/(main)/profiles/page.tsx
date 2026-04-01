"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import Link from "next/link";
import { setActiveProfileId } from "@/hooks/use-profile";
import { AVATAR_COLORS } from "@/config/constants";

interface Profile {
  id: string;
  name: string;
  avatarUrl: string | null;
  isKid: boolean;
}

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profiles")
      .then((res) => res.json())
      .then((data) => {
        setProfiles(data);
        setLoading(false);
      });
  }, []);

  function selectProfile(profile: Profile) {
    setActiveProfileId(profile.id);
    router.push("/browse");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-3xl md:text-5xl font-medium mb-10">Qui regarde ?</h1>

      <div className="flex flex-wrap justify-center gap-6">
        {profiles.map((profile, i) => (
          <button
            key={profile.id}
            onClick={() => selectProfile(profile)}
            className="group flex flex-col items-center gap-3"
          >
            <div
              className="w-24 h-24 md:w-32 md:h-32 rounded-lg flex items-center justify-center text-3xl md:text-4xl font-bold border-2 border-transparent group-hover:border-white transition-colors"
              style={{
                backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
              }}
            >
              {profile.name[0].toUpperCase()}
            </div>
            <span className="text-text-muted group-hover:text-white transition-colors">
              {profile.name}
            </span>
          </button>
        ))}

        {profiles.length < 5 && (
          <Link
            href="/profiles/manage"
            className="group flex flex-col items-center gap-3"
          >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg flex items-center justify-center border-2 border-border group-hover:border-white transition-colors bg-surface">
              <Plus size={48} className="text-text-dim group-hover:text-white transition-colors" />
            </div>
            <span className="text-text-muted group-hover:text-white transition-colors">
              Ajouter
            </span>
          </Link>
        )}
      </div>

      <Link
        href="/profiles/manage"
        className="mt-10 flex items-center gap-2 text-text-muted hover:text-white transition-colors border border-text-muted hover:border-white px-6 py-2 rounded"
      >
        <Pencil size={16} />
        Gérer les profils
      </Link>
    </div>
  );
}
