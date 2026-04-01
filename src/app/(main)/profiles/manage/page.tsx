"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AVATAR_COLORS } from "@/config/constants";

interface Profile {
  id: string;
  name: string;
  avatarUrl: string | null;
  isKid: boolean;
}

export default function ManageProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newName, setNewName] = useState("");
  const [isKid, setIsKid] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    const res = await fetch("/api/profiles");
    setProfiles(await res.json());
  }

  async function createProfile() {
    if (!newName.trim()) return;
    await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, isKid }),
    });
    setNewName("");
    setIsKid(false);
    setShowCreate(false);
    loadProfiles();
  }

  async function updateProfile(id: string) {
    if (!editName.trim()) return;
    await fetch(`/api/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setEditingId(null);
    loadProfiles();
  }

  async function deleteProfile(id: string) {
    await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    loadProfiles();
  }

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <button
        onClick={() => router.push("/profiles")}
        className="flex items-center gap-2 text-text-muted hover:text-white mb-8"
      >
        <ArrowLeft size={20} />
        Retour
      </button>

      <h1 className="text-3xl font-bold mb-8">Gérer les profils</h1>

      <div className="space-y-4">
        {profiles.map((profile, i) => (
          <div
            key={profile.id}
            className="flex items-center gap-4 bg-surface border border-border rounded-lg p-4"
          >
            <div
              className="w-12 h-12 rounded flex items-center justify-center text-lg font-bold shrink-0"
              style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
            >
              {profile.name[0].toUpperCase()}
            </div>

            {editingId === profile.id ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && updateProfile(profile.id)}
                />
                <Button size="sm" onClick={() => updateProfile(profile.id)}>
                  Sauver
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Annuler
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <span className="font-medium">{profile.name}</span>
                  {profile.isKid && (
                    <span className="ml-2 text-xs bg-blue-600 px-2 py-0.5 rounded">
                      Enfant
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(profile.id);
                    setEditName(profile.name);
                  }}
                >
                  Modifier
                </Button>
                {profiles.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteProfile(profile.id)}
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {showCreate ? (
        <div className="mt-6 bg-surface border border-border rounded-lg p-4 space-y-4">
          <Input
            label="Nom du profil"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && createProfile()}
          />
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={isKid}
              onChange={(e) => setIsKid(e.target.checked)}
              className="rounded"
            />
            Profil enfant
          </label>
          <div className="flex gap-2">
            <Button onClick={createProfile}>Créer</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        profiles.length < 5 && (
          <Button
            variant="secondary"
            className="mt-6 w-full"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={16} className="mr-2" />
            Ajouter un profil
          </Button>
        )
      )}
    </div>
  );
}
