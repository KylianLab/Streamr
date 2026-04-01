"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Plus, Trash2, RefreshCw, Film, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

interface Library {
  id: string;
  path: string;
  name: string;
  mediaType: "MOVIE" | "SERIES";
  scanStatus: string;
  lastScanAt: string | null;
  autoScan: boolean;
  _count: { mediaFiles: number };
}

export default function LibrariesPage() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"MOVIE" | "SERIES">("MOVIE");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadLibraries();
  }, []);

  async function loadLibraries() {
    const res = await fetch("/api/library");
    setLibraries(await res.json());
  }

  async function createLibrary() {
    if (!newPath || !newName) return;

    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: newPath, name: newName, mediaType: newType }),
    });

    if (res.ok) {
      toast("Bibliothèque ajoutée", "success");
      setNewPath("");
      setNewName("");
      setShowCreate(false);
      loadLibraries();
    } else {
      const err = await res.json();
      toast(err.error || "Erreur", "error");
    }
  }

  async function deleteLibrary(id: string) {
    await fetch(`/api/library/${id}`, { method: "DELETE" });
    toast("Bibliothèque supprimée", "success");
    loadLibraries();
  }

  async function scanAll() {
    setScanning(true);
    toast("Scan en cours...", "info");

    try {
      const res = await fetch("/api/library/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const results = await res.json();

      if (Array.isArray(results)) {
        const total = results.reduce((acc: number, r: { scanned: number }) => acc + r.scanned, 0);
        toast(`Scan terminé : ${total} fichiers traités`, "success");
      }
    } catch {
      toast("Erreur lors du scan", "error");
    }

    setScanning(false);
    loadLibraries();
  }

  async function scanLibrary(id: string) {
    setScanning(true);
    toast("Scan en cours...", "info");

    try {
      await fetch("/api/library/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryId: id }),
      });
      toast("Scan terminé", "success");
    } catch {
      toast("Erreur lors du scan", "error");
    }

    setScanning(false);
    loadLibraries();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Bibliothèques</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={scanAll} loading={scanning} className="gap-2">
            <RefreshCw size={16} />
            Scanner tout
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus size={16} />
            Ajouter
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-surface border border-border rounded-lg p-6 mb-6 space-y-4">
          <h3 className="font-semibold">Nouvelle bibliothèque</h3>
          <Input
            label="Nom"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Films NAS"
          />
          <Input
            label="Chemin du dossier"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="/mnt/media/films"
          />
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setNewType("MOVIE")}
                className={`flex items-center gap-2 px-4 py-2 rounded border text-sm ${
                  newType === "MOVIE"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-muted hover:border-white"
                }`}
              >
                <Film size={16} /> Films
              </button>
              <button
                onClick={() => setNewType("SERIES")}
                className={`flex items-center gap-2 px-4 py-2 rounded border text-sm ${
                  newType === "SERIES"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-muted hover:border-white"
                }`}
              >
                <Tv size={16} /> Séries
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={createLibrary}>Ajouter</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {libraries.map((lib) => (
          <div key={lib.id} className="bg-surface border border-border rounded-lg p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-surface-hover">
              <FolderOpen size={24} className={lib.mediaType === "MOVIE" ? "text-blue-400" : "text-purple-400"} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{lib.name}</h3>
                <span className="text-xs bg-surface-hover px-2 py-0.5 rounded">
                  {lib.mediaType === "MOVIE" ? "Films" : "Séries"}
                </span>
                {lib.scanStatus === "SCANNING" && (
                  <span className="text-xs text-yellow-400 animate-pulse">Scan en cours...</span>
                )}
              </div>
              <p className="text-sm text-text-dim mt-0.5">{lib.path}</p>
              <p className="text-xs text-text-dim mt-1">
                {lib._count.mediaFiles} fichiers
                {lib.lastScanAt && ` · Dernier scan : ${new Date(lib.lastScanAt).toLocaleDateString("fr-FR")}`}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => scanLibrary(lib.id)}
              disabled={scanning}
            >
              <RefreshCw size={16} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => deleteLibrary(lib.id)}>
              <Trash2 size={16} className="text-red-400" />
            </Button>
          </div>
        ))}

        {libraries.length === 0 && (
          <p className="text-text-muted text-center py-12">
            Aucune bibliothèque configurée. Ajoutez un dossier contenant vos médias.
          </p>
        )}
      </div>
    </div>
  );
}
