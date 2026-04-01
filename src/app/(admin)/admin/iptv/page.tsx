"use client";

import { useEffect, useState } from "react";
import { Radio, Plus, Trash2, RefreshCw, ChevronDown, ChevronRight, Eye, EyeOff, Upload, Link, Pencil, X, Cast, Check, Film, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

interface Channel {
  id: string;
  name: string;
  logoUrl: string | null;
  group: string | null;
  streamUrl: string;
  isActive: boolean;
  order: number;
}

interface Playlist {
  id: string;
  name: string;
  url: string | null;
  fileName: string | null;
  channelCount: number;
  lastRefreshedAt: string | null;
  createdAt: string;
  _count?: { channels: number };
  channels?: Channel[];
  xtreamProvider?: XtreamProviderInfo | null;
}

interface XtreamProviderInfo {
  id: string;
  name: string;
  serverUrl: string;
  username: string;
  password: string;
  selectedCategories: string | null;
  autoRefresh: boolean;
  refreshIntervalH: number;
  lastRefreshedAt: string | null;
}

interface XtreamCategory {
  category_id: string;
  category_name: string;
}

export default function IptvPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [sourceMode, setSourceMode] = useState<"file" | "url" | "xtream">("file");
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", group: "", logoUrl: "", streamUrl: "" });

  // Xtream import state
  const [xtreamUrl, setXtreamUrl] = useState("");
  const [xtreamUser, setXtreamUser] = useState("");
  const [xtreamPass, setXtreamPass] = useState("");
  const [xtreamCategories, setXtreamCategories] = useState<XtreamCategory[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const [xtreamStep, setXtreamStep] = useState<1 | 2>(1);
  const [fetchingCats, setFetchingCats] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(24);

  // Xtream content type (live / vod / series)
  const [xtreamContentType, setXtreamContentType] = useState<"live" | "vod" | "series">("live");

  // Xtream provider edit state
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [editCats, setEditCats] = useState<XtreamCategory[]>([]);
  const [editSelectedCatIds, setEditSelectedCatIds] = useState<Set<string>>(new Set());
  const [editAutoRefresh, setEditAutoRefresh] = useState(true);
  const [editRefreshInterval, setEditRefreshInterval] = useState(24);
  const [editFetchingCats, setEditFetchingCats] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    loadPlaylists();
  }, []);

  async function loadPlaylists() {
    const res = await fetch("/api/admin/iptv/playlists");
    if (!res.ok) return;
    const data: Playlist[] = await res.json();

    // Load xtream provider info for each playlist
    const provRes = await fetch("/api/admin/iptv/xtream-import");
    if (provRes.ok) {
      const providers: XtreamProviderInfo[] = await provRes.json();
      const provMap = new Map<string, XtreamProviderInfo>();
      for (const p of providers) {
        if ((p as unknown as { playlistId: string }).playlistId) {
          provMap.set((p as unknown as { playlistId: string }).playlistId, p);
        }
      }
      for (const pl of data) {
        pl.xtreamProvider = provMap.get(pl.id) || null;
      }
    }

    setPlaylists(data);
  }

  async function uploadPlaylist() {
    if (!newName) return;
    if (sourceMode === "file" && !file) return;
    if (sourceMode === "url" && !newUrl.trim()) return;
    setUploading(true);

    let res: Response;

    if (sourceMode === "url") {
      res = await fetch("/api/admin/iptv/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, url: newUrl.trim() }),
      });
    } else {
      const form = new FormData();
      form.append("file", file!);
      form.append("name", newName);
      res = await fetch("/api/admin/iptv/playlists", {
        method: "POST",
        body: form,
      });
    }

    if (res.ok) {
      const data = await res.json();
      toast(`Playlist ajoutee : ${data.channelCount} chaines`, "success");
      resetCreateForm();
      loadPlaylists();
    } else {
      const err = await res.json();
      toast(err.error || "Erreur", "error");
    }

    setUploading(false);
  }

  // ── Xtream import ─────────────────────────

  async function fetchCategories() {
    if (!xtreamUrl || !xtreamUser || !xtreamPass) return;
    setFetchingCats(true);
    const actionMap = { live: "categories", vod: "vod-categories", series: "series-categories" };
    try {
      const res = await fetch("/api/admin/iptv/xtream-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionMap[xtreamContentType], serverUrl: xtreamUrl.trim(), username: xtreamUser.trim(), password: xtreamPass.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error || "Erreur", "error");
        return;
      }
      const cats: XtreamCategory[] = await res.json();
      setXtreamCategories(cats);
      setSelectedCatIds(new Set());
      setXtreamStep(2);
    } catch {
      toast("Impossible de contacter le fournisseur", "error");
    } finally {
      setFetchingCats(false);
    }
  }

  function toggleCategory(id: string) {
    setSelectedCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllCategories() {
    if (selectedCatIds.size === xtreamCategories.length) {
      setSelectedCatIds(new Set());
    } else {
      setSelectedCatIds(new Set(xtreamCategories.map((c) => c.category_id)));
    }
  }

  async function importXtream() {
    if (selectedCatIds.size === 0) return;
    if (xtreamContentType === "live" && !newName) return;
    setUploading(true);

    const selected = xtreamCategories.filter((c) => selectedCatIds.has(c.category_id));
    const selectedNames = selected.map((c) => c.category_name);
    const selectedIds = selected.map((c) => c.category_id);

    const actionMap = { live: "import", vod: "vod-import", series: "series-import" };

    try {
      const res = await fetch("/api/admin/iptv/xtream-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionMap[xtreamContentType],
          name: newName || `IPTV ${xtreamContentType}`,
          serverUrl: xtreamUrl.trim(),
          username: xtreamUser.trim(),
          password: xtreamPass.trim(),
          categoryNames: selectedNames,
          categoryIds: selectedIds,
          autoRefresh,
          refreshIntervalH: refreshInterval,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const count = data.channelCount ?? data.imported ?? 0;
        const label = xtreamContentType === "live" ? "chaines" : xtreamContentType === "vod" ? "films" : "séries";
        toast(`Import reussi : ${count} ${label}`, "success");
        if (xtreamContentType !== "live" && count > 0) {
          toast("Lancez 'Refresh All (TMDB)' dans Admin > Médias pour enrichir les métadonnées", "info");
        }
        resetCreateForm();
        loadPlaylists();
      } else {
        const err = await res.json();
        toast(err.error || "Erreur lors de l'import", "error");
      }
    } catch {
      toast("Erreur lors de l'import", "error");
    } finally {
      setUploading(false);
    }
  }

  async function refreshXtreamProvider(provider: XtreamProviderInfo) {
    toast("Rafraichissement en cours...", "info");
    try {
      const res = await fetch("/api/admin/iptv/xtream-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", providerId: provider.id }),
      });
      if (res.ok) {
        const data = await res.json();
        toast(`Rafraichi : ${data.channelCount} chaines`, "success");
        loadPlaylists();
      } else {
        const err = await res.json();
        toast(err.error || "Erreur", "error");
      }
    } catch {
      toast("Erreur lors du rafraichissement", "error");
    }
  }

  async function deleteXtreamProvider(providerId: string) {
    const res = await fetch("/api/admin/iptv/xtream-import", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: providerId }),
    });
    if (res.ok) {
      toast("Fournisseur supprime", "success");
      if (expandedId) setExpandedId(null);
      loadPlaylists();
    }
  }

  async function startEditProvider(provider: XtreamProviderInfo) {
    setEditingProviderId(provider.id);
    setEditAutoRefresh(provider.autoRefresh);
    setEditRefreshInterval(provider.refreshIntervalH);
    setEditFetchingCats(true);
    setEditCats([]);
    setEditSelectedCatIds(new Set());

    // Parse currently selected categories
    const currentCats: { id: string; name: string }[] = provider.selectedCategories
      ? JSON.parse(provider.selectedCategories)
      : [];
    const currentNames = new Set(currentCats.map((c) => c.name));

    try {
      const res = await fetch("/api/admin/iptv/xtream-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "categories",
          serverUrl: provider.serverUrl,
          username: provider.username,
          password: provider.password,
        }),
      });
      if (res.ok) {
        const cats: XtreamCategory[] = await res.json();
        setEditCats(cats);
        // Pre-select categories that were previously selected (match by name)
        const preSelected = new Set(
          cats.filter((c) => currentNames.has(c.category_name)).map((c) => c.category_id)
        );
        setEditSelectedCatIds(preSelected);
      } else {
        toast("Impossible de recuperer les categories", "error");
        setEditingProviderId(null);
      }
    } catch {
      toast("Impossible de contacter le fournisseur", "error");
      setEditingProviderId(null);
    } finally {
      setEditFetchingCats(false);
    }
  }

  function toggleEditCategory(id: string) {
    setEditSelectedCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllEditCategories() {
    if (editSelectedCatIds.size === editCats.length) {
      setEditSelectedCatIds(new Set());
    } else {
      setEditSelectedCatIds(new Set(editCats.map((c) => c.category_id)));
    }
  }

  async function saveEditProvider() {
    if (!editingProviderId || editSelectedCatIds.size === 0) return;
    setEditSaving(true);

    const selected = editCats.filter((c) => editSelectedCatIds.has(c.category_id));
    const selectedNames = selected.map((c) => c.category_name);
    const selectedIds = selected.map((c) => c.category_id);

    try {
      const res = await fetch("/api/admin/iptv/xtream-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          providerId: editingProviderId,
          categoryNames: selectedNames,
          categoryIds: selectedIds,
          autoRefresh: editAutoRefresh,
          refreshIntervalH: editRefreshInterval,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast(`Mis a jour : ${data.channelCount} chaines`, "success");
        setEditingProviderId(null);
        loadPlaylists();
      } else {
        const err = await res.json();
        toast(err.error || "Erreur", "error");
      }
    } catch {
      toast("Erreur lors de la mise a jour", "error");
    } finally {
      setEditSaving(false);
    }
  }

  function resetCreateForm() {
    setNewName("");
    setFile(null);
    setNewUrl("");
    setXtreamUrl("");
    setXtreamUser("");
    setXtreamPass("");
    setXtreamCategories([]);
    setSelectedCatIds(new Set());
    setXtreamStep(1);
    setShowCreate(false);
  }

  // ── Existing playlist/channel management ──

  async function deletePlaylist(id: string) {
    await fetch(`/api/admin/iptv/playlists/${id}`, { method: "DELETE" });
    toast("Playlist supprimee", "success");
    if (expandedId === id) setExpandedId(null);
    loadPlaylists();
  }

  async function refreshPlaylist(pl: Playlist) {
    // If it's an Xtream provider, use the xtream refresh
    if (pl.xtreamProvider) {
      return refreshXtreamProvider(pl.xtreamProvider);
    }

    if (!pl.url) return;
    toast("Rafraichissement en cours...", "info");

    const res = await fetch("/api/admin/iptv/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pl.name, url: pl.url }),
    });

    if (res.ok) {
      await fetch(`/api/admin/iptv/playlists/${pl.id}`, { method: "DELETE" });
      const data = await res.json();
      toast(`Playlist rafraichie : ${data.channelCount} chaines`, "success");
      if (expandedId === pl.id) setExpandedId(null);
      loadPlaylists();
    } else {
      const err = await res.json();
      toast(err.error || "Erreur lors du rafraichissement", "error");
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);
    setLoadingChannels(true);
    const res = await fetch(`/api/admin/iptv/playlists/${id}`);
    if (res.ok) {
      const data = await res.json();
      setChannels(data.channels || []);
    }
    setLoadingChannels(false);
  }

  async function toggleChannelActive(channel: Channel) {
    const res = await fetch(`/api/admin/iptv/channels/${channel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !channel.isActive }),
    });

    if (res.ok) {
      setChannels((prev) =>
        prev.map((c) => (c.id === channel.id ? { ...c, isActive: !c.isActive } : c))
      );
    }
  }

  async function deleteChannel(id: string) {
    await fetch(`/api/admin/iptv/channels/${id}`, { method: "DELETE" });
    setChannels((prev) => prev.filter((c) => c.id !== id));
    loadPlaylists();
  }

  function startEdit(ch: Channel) {
    setEditingId(ch.id);
    setEditForm({
      name: ch.name,
      group: ch.group || "",
      logoUrl: ch.logoUrl || "",
      streamUrl: ch.streamUrl,
    });
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/admin/iptv/channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        group: editForm.group || null,
        logoUrl: editForm.logoUrl || null,
        streamUrl: editForm.streamUrl,
      }),
    });

    if (res.ok) {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, name: editForm.name, group: editForm.group || null, logoUrl: editForm.logoUrl || null, streamUrl: editForm.streamUrl }
            : c
        )
      );
      setEditingId(null);
      toast("Chaine mise a jour", "success");
    }
  }

  // Group channels by group name
  const groupedChannels: Record<string, Channel[]> = {};
  for (const ch of channels) {
    const g = ch.group || "Sans groupe";
    if (!groupedChannels[g]) groupedChannels[g] = [];
    groupedChannels[g].push(ch);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">IPTV / TV en direct</h1>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus size={16} />
          Ajouter une playlist
        </Button>
      </div>

      {showCreate && (
        <div className="bg-surface border border-border rounded-lg p-6 mb-6 space-y-4">
          <h3 className="font-semibold">Ajouter une playlist</h3>
          <Input
            label="Nom"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="IPTV France 2026"
          />
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Source</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setSourceMode("file"); setXtreamStep(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded border text-sm ${
                  sourceMode === "file"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-muted hover:border-white"
                }`}
              >
                <Upload size={16} /> Fichier
              </button>
              <button
                onClick={() => { setSourceMode("url"); setXtreamStep(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded border text-sm ${
                  sourceMode === "url"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-muted hover:border-white"
                }`}
              >
                <Link size={16} /> URL
              </button>
              <button
                onClick={() => { setSourceMode("xtream"); setXtreamStep(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded border text-sm ${
                  sourceMode === "xtream"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-muted hover:border-white"
                }`}
              >
                <Cast size={16} /> Xtream
              </button>
            </div>
          </div>

          {sourceMode === "file" && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">
                Fichier M3U / M3U8
              </label>
              <input
                type="file"
                accept=".m3u,.m3u8"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover file:cursor-pointer"
              />
            </div>
          )}

          {sourceMode === "url" && (
            <Input
              label="URL de la playlist M3U / M3U8"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com/playlist.m3u8"
            />
          )}

          {sourceMode === "xtream" && (
            <div className="space-y-4">
              {/* Content type tabs */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Type de contenu</label>
                <div className="flex gap-2">
                  {([["live", "TV en direct", Radio], ["vod", "Films", Film], ["series", "Séries", Tv]] as const).map(([type, label, Icon]) => (
                    <button
                      key={type}
                      onClick={() => { setXtreamContentType(type); setXtreamStep(1); setXtreamCategories([]); setSelectedCatIds(new Set()); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded border text-sm ${
                        xtreamContentType === type
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-text-muted hover:border-white"
                      }`}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  label="Serveur"
                  value={xtreamUrl}
                  onChange={(e) => setXtreamUrl(e.target.value)}
                  placeholder="http://provider.com:8080"
                />
                <Input
                  label="Identifiant"
                  value={xtreamUser}
                  onChange={(e) => setXtreamUser(e.target.value)}
                  placeholder="username"
                />
                <Input
                  label="Mot de passe"
                  value={xtreamPass}
                  onChange={(e) => setXtreamPass(e.target.value)}
                  placeholder="password"
                />
              </div>

              {xtreamStep === 1 && (
                <Button
                  onClick={fetchCategories}
                  loading={fetchingCats}
                  disabled={!xtreamUrl || !xtreamUser || !xtreamPass}
                >
                  Recuperer les categories
                </Button>
              )}

              {/* Step 2: Category selection */}
              {xtreamStep === 2 && xtreamCategories.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-muted">
                      Categories ({selectedCatIds.size}/{xtreamCategories.length} selectionnees)
                    </label>
                    <button
                      onClick={toggleAllCategories}
                      className="text-xs text-primary hover:underline"
                    >
                      {selectedCatIds.size === xtreamCategories.length ? "Tout deselectionner" : "Tout selectionner"}
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                    {xtreamCategories.map((cat) => (
                      <div
                        key={cat.category_id}
                        onClick={() => toggleCategory(cat.category_id)}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-surface-hover cursor-pointer"
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            selectedCatIds.has(cat.category_id)
                              ? "bg-primary border-primary"
                              : "border-border"
                          }`}
                        >
                          {selectedCatIds.has(cat.category_id) && <Check size={12} className="text-white" />}
                        </div>
                        <span className="text-sm">{cat.category_name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Auto-refresh options */}
                  <div className="flex items-center gap-4 pt-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        className="rounded border-border"
                      />
                      Rafraichissement auto
                    </label>
                    {autoRefresh && (
                      <select
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                        className="bg-black/40 border border-border rounded px-2 py-1 text-sm text-white"
                      >
                        <option value={6}>Toutes les 6h</option>
                        <option value={12}>Toutes les 12h</option>
                        <option value={24}>Toutes les 24h</option>
                        <option value={48}>Toutes les 48h</option>
                      </select>
                    )}
                  </div>
                </div>
              )}

              {xtreamStep === 2 && xtreamCategories.length === 0 && (
                <p className="text-sm text-text-dim">Aucune categorie trouvee chez ce fournisseur.</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {sourceMode === "xtream" ? (
              <Button
                onClick={importXtream}
                loading={uploading}
                disabled={(xtreamContentType === "live" && !newName) || xtreamStep !== 2 || selectedCatIds.size === 0}
              >
                Importer {selectedCatIds.size > 0 && `(${selectedCatIds.size} categories)`}
              </Button>
            ) : (
              <Button
                onClick={uploadPlaylist}
                loading={uploading}
                disabled={!newName || (sourceMode === "file" ? !file : !newUrl.trim())}
              >
                Importer
              </Button>
            )}
            <Button variant="ghost" onClick={resetCreateForm}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {playlists.map((pl) => (
          <div key={pl.id} className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-surface-hover">
                {pl.xtreamProvider ? (
                  <Cast size={24} className="text-purple-400" />
                ) : (
                  <Radio size={24} className="text-green-400" />
                )}
              </div>
              <div
                className="flex-1 cursor-pointer"
                onClick={() => toggleExpand(pl.id)}
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{pl.name}</h3>
                  {pl.xtreamProvider && (
                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                      Xtream
                    </span>
                  )}
                  <span className="text-xs bg-surface-hover px-2 py-0.5 rounded">
                    {pl._count?.channels ?? pl.channelCount} chaines
                  </span>
                </div>
                {pl.xtreamProvider && (
                  <p className="text-sm text-text-dim mt-0.5 truncate max-w-md">
                    {pl.xtreamProvider.serverUrl}
                    {pl.xtreamProvider.autoRefresh && ` · Auto ${pl.xtreamProvider.refreshIntervalH}h`}
                  </p>
                )}
                {!pl.xtreamProvider && pl.fileName && (
                  <p className="text-sm text-text-dim mt-0.5">{pl.fileName}</p>
                )}
                {!pl.xtreamProvider && pl.url && (
                  <p className="text-sm text-text-dim mt-0.5 truncate max-w-md">{pl.url}</p>
                )}
                <p className="text-xs text-text-dim mt-1">
                  Ajoutee le {new Date(pl.createdAt).toLocaleDateString("fr-FR")}
                  {pl.lastRefreshedAt &&
                    ` · Rafraichie le ${new Date(pl.lastRefreshedAt).toLocaleDateString("fr-FR")}`}
                </p>
              </div>
              <button onClick={() => toggleExpand(pl.id)} className="text-text-muted hover:text-white">
                {expandedId === pl.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>
              {pl.xtreamProvider && (
                <Button size="icon" variant="ghost" onClick={() => startEditProvider(pl.xtreamProvider!)} title="Modifier les categories">
                  <Pencil size={16} />
                </Button>
              )}
              {(pl.url || pl.xtreamProvider) && (
                <Button size="icon" variant="ghost" onClick={() => refreshPlaylist(pl)} title="Rafraichir">
                  <RefreshCw size={16} />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => pl.xtreamProvider ? deleteXtreamProvider(pl.xtreamProvider.id) : deletePlaylist(pl.id)}
              >
                <Trash2 size={16} className="text-red-400" />
              </Button>
            </div>

            {editingProviderId === pl.xtreamProvider?.id && (
              <div className="border-t border-border px-4 py-4 space-y-3 bg-surface-hover/30">
                <h4 className="text-sm font-semibold">Modifier les categories</h4>
                {editFetchingCats ? (
                  <p className="text-text-muted text-sm py-2">Chargement des categories...</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-muted">
                        {editSelectedCatIds.size}/{editCats.length} selectionnees
                      </span>
                      <button onClick={toggleAllEditCategories} className="text-xs text-primary hover:underline">
                        {editSelectedCatIds.size === editCats.length ? "Tout deselectionner" : "Tout selectionner"}
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                      {editCats.map((cat) => (
                        <div
                          key={cat.category_id}
                          onClick={() => toggleEditCategory(cat.category_id)}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-surface-hover cursor-pointer"
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              editSelectedCatIds.has(cat.category_id)
                                ? "bg-primary border-primary"
                                : "border-border"
                            }`}
                          >
                            {editSelectedCatIds.has(cat.category_id) && <Check size={12} className="text-white" />}
                          </div>
                          <span className="text-sm">{cat.category_name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editAutoRefresh}
                          onChange={(e) => setEditAutoRefresh(e.target.checked)}
                          className="rounded border-border"
                        />
                        Rafraichissement auto
                      </label>
                      {editAutoRefresh && (
                        <select
                          value={editRefreshInterval}
                          onChange={(e) => setEditRefreshInterval(Number(e.target.value))}
                          className="bg-black/40 border border-border rounded px-2 py-1 text-sm text-white"
                        >
                          <option value={6}>Toutes les 6h</option>
                          <option value={12}>Toutes les 12h</option>
                          <option value={24}>Toutes les 24h</option>
                          <option value={48}>Toutes les 48h</option>
                        </select>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={saveEditProvider}
                        loading={editSaving}
                        disabled={editSelectedCatIds.size === 0}
                        size="sm"
                      >
                        Enregistrer ({editSelectedCatIds.size} categories)
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingProviderId(null)}>
                        Annuler
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {expandedId === pl.id && (
              <div className="border-t border-border px-4 py-3 max-h-96 overflow-y-auto">
                {loadingChannels ? (
                  <p className="text-text-muted text-sm py-4 text-center">Chargement...</p>
                ) : (
                  Object.entries(groupedChannels).map(([group, chs]) => (
                    <div key={group} className="mb-4">
                      <h4 className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-2">
                        {group} ({chs.length})
                      </h4>
                      <div className="space-y-1">
                        {chs.map((ch) =>
                          editingId === ch.id ? (
                            <div key={ch.id} className="bg-surface-hover rounded p-3 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  value={editForm.name}
                                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                  placeholder="Nom"
                                  className="bg-black/40 border border-border rounded px-2 py-1 text-sm text-white"
                                />
                                <input
                                  value={editForm.group}
                                  onChange={(e) => setEditForm((f) => ({ ...f, group: e.target.value }))}
                                  placeholder="Groupe (pays, genre...)"
                                  className="bg-black/40 border border-border rounded px-2 py-1 text-sm text-white"
                                />
                                <input
                                  value={editForm.logoUrl}
                                  onChange={(e) => setEditForm((f) => ({ ...f, logoUrl: e.target.value }))}
                                  placeholder="URL du logo"
                                  className="bg-black/40 border border-border rounded px-2 py-1 text-sm text-white"
                                />
                                <input
                                  value={editForm.streamUrl}
                                  onChange={(e) => setEditForm((f) => ({ ...f, streamUrl: e.target.value }))}
                                  placeholder="URL du stream"
                                  className="bg-black/40 border border-border rounded px-2 py-1 text-sm text-white"
                                />
                              </div>
                              {editForm.logoUrl && (
                                <div className="flex items-center gap-2">
                                  <img src={editForm.logoUrl} alt="" className="w-8 h-8 object-contain rounded" />
                                  <span className="text-xs text-text-dim">Apercu logo</span>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => saveEdit(ch.id)}>Enregistrer</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Annuler</Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              key={ch.id}
                              className="flex items-center gap-3 px-3 py-1.5 rounded hover:bg-surface-hover text-sm"
                            >
                              {ch.logoUrl ? (
                                <img
                                  src={ch.logoUrl}
                                  alt=""
                                  className="w-6 h-6 object-contain rounded"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="w-6 h-6 rounded bg-surface-hover" />
                              )}
                              <span className={ch.isActive ? "text-white" : "text-text-dim line-through"}>
                                {ch.name}
                              </span>
                              <span className="text-text-dim text-xs truncate max-w-xs ml-auto">
                                {ch.streamUrl}
                              </span>
                              <button
                                onClick={() => startEdit(ch)}
                                className="text-text-muted hover:text-white"
                                title="Modifier"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => toggleChannelActive(ch)}
                                className="text-text-muted hover:text-white"
                                title={ch.isActive ? "Desactiver" : "Activer"}
                              >
                                {ch.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button
                                onClick={() => deleteChannel(ch.id)}
                                className="text-text-muted hover:text-red-400"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ))
                )}
                {!loadingChannels && channels.length === 0 && (
                  <p className="text-text-muted text-sm py-4 text-center">Aucune chaine</p>
                )}
              </div>
            )}
          </div>
        ))}

        {playlists.length === 0 && (
          <p className="text-text-muted text-center py-12">
            Aucune playlist IPTV. Importez un fichier M3U pour ajouter des chaines TV.
          </p>
        )}
      </div>
    </div>
  );
}
