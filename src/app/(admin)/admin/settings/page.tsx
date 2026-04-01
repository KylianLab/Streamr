"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

interface AppSettings {
  tmdbApiKey: string;
  registrationOpen: string;
  maxProfiles: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    tmdbApiKey: "",
    registrationOpen: "true",
    maxProfiles: "5",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object") {
          setSettings((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    if (res.ok) {
      toast("Paramètres enregistrés", "success");
    } else {
      toast("Erreur lors de la sauvegarde", "error");
    }
    setSaving(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Paramètres</h1>

      <div className="max-w-lg space-y-6">
        <Input
          label="Clé API TMDB"
          value={settings.tmdbApiKey}
          onChange={(e) => setSettings((s) => ({ ...s, tmdbApiKey: e.target.value }))}
          placeholder="Votre clé API TMDB"
          type="password"
        />

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">
            Inscription ouverte
          </label>
          <select
            value={settings.registrationOpen}
            onChange={(e) => setSettings((s) => ({ ...s, registrationOpen: e.target.value }))}
            className="bg-surface border border-border rounded px-4 py-3 text-white w-full"
          >
            <option value="true">Oui</option>
            <option value="false">Non (invitation uniquement)</option>
          </select>
        </div>

        <Input
          label="Nombre max de profils par utilisateur"
          value={settings.maxProfiles}
          onChange={(e) => setSettings((s) => ({ ...s, maxProfiles: e.target.value }))}
          type="number"
          min="1"
          max="10"
        />

        <Button onClick={save} loading={saving} size="lg">
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
