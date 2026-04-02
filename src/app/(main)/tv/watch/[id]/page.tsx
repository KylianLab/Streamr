"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { TvPlayer } from "@/components/player/tv-player";

interface IptvChannel {
  id: string;
  name: string;
  logoUrl: string | null;
  streamUrl: string;
}

export default function TvWatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [channel, setChannel] = useState<IptvChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/iptv/channels/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setChannel)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white gap-4">
        <p className="text-lg text-text-muted">
          Impossible de charger cette cha&icirc;ne.
        </p>
        <button
          onClick={() => router.push("/tv")}
          className="px-4 py-2 bg-primary rounded text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          Retour aux cha&icirc;nes
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <TvPlayer
        streamUrl={`/api/iptv/channels/${id}/stream`}
        channelName={channel.name}
        channelLogo={channel.logoUrl || undefined}
        onBack={() => router.push("/tv")}
      />
    </div>
  );
}
