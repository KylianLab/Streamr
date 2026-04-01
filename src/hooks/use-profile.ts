"use client";

// Profile ID stored in cookie for server-side access

export function getActiveProfileId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )profileId=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setActiveProfileId(profileId: string) {
  document.cookie = `profileId=${encodeURIComponent(profileId)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function clearActiveProfileId() {
  document.cookie = "profileId=; path=/; max-age=0";
}

// Also export as a hook for reactivity
import { useState, useEffect } from "react";

export function useActiveProfile() {
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    setProfileId(getActiveProfileId());
  }, []);

  const selectProfile = (id: string) => {
    setActiveProfileId(id);
    setProfileId(id);
  };

  return { profileId, selectProfile };
}
