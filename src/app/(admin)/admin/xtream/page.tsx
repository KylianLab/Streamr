"use client";

import { useEffect, useState } from "react";
import { Cast, Plus, Trash2, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

interface User {
  id: string;
  name: string;
  email: string;
}

interface XtreamCode {
  id: string;
  userId: string;
  username: string;
  password: string;
  isActive: boolean;
  createdAt: string;
  user: User;
}

export default function XtreamPage() {
  const [codes, setCodes] = useState<XtreamCode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [customUsername, setCustomUsername] = useState("");
  const [creating, setCreating] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCodes();
    loadUsers();
  }, []);

  async function loadCodes() {
    const res = await fetch("/api/admin/xtream");
    if (res.ok) setCodes(await res.json());
  }

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : data.users || []);
    }
  }

  async function createCode() {
    if (!selectedUserId) return;
    setCreating(true);
    const res = await fetch("/api/admin/xtream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId, username: customUsername || undefined }),
    });
    if (res.ok) {
      toast("Identifiants Xtream créés", "success");
      setShowCreate(false);
      setSelectedUserId("");
      setCustomUsername("");
      loadCodes();
    } else {
      const err = await res.json();
      toast(err.error || "Erreur", "error");
    }
    setCreating(false);
  }

  async function toggleActive(code: XtreamCode) {
    const res = await fetch(`/api/admin/xtream/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !code.isActive }),
    });
    if (res.ok) loadCodes();
  }

  async function deleteCode(id: string) {
    if (!confirm("Supprimer ces identifiants Xtream ?")) return;
    const res = await fetch(`/api/admin/xtream/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Supprimé", "success");
      loadCodes();
    }
  }

  function togglePassword(id: string) {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast(`${label} copié`, "success");
  }

  const serverUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Cast size={28} />
            Xtream Codes
          </h1>
          <p className="text-text-muted mt-1">
            Identifiants pour les applications IPTV externes (TiviMate, Smarters, etc.)
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} className="mr-2" />
          Nouveau
        </Button>
      </div>

      {/* Connection info */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium mb-2 text-text-muted">URL du serveur Xtream</h3>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-black/30 px-3 py-2 rounded text-sm font-mono">
            {serverUrl}/api/xtream
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(`${serverUrl}/api/xtream`, "URL")}
          >
            <Copy size={14} />
          </Button>
        </div>
        <p className="text-xs text-text-dim mt-2">
          Dans l&apos;app IPTV, utiliser cette URL comme &quot;Server URL&quot; avec le username/password ci-dessous.
        </p>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-6">
          <h3 className="font-medium mb-3">Créer des identifiants</h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-text-muted mb-1 block">Utilisateur</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-black/30 border border-border rounded px-3 py-2 text-sm"
              >
                <option value="">Sélectionner un utilisateur...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-text-muted mb-1 block">
                Username personnalisé <span className="text-text-dim">(optionnel)</span>
              </label>
              <Input
                value={customUsername}
                onChange={(e) => setCustomUsername(e.target.value)}
                placeholder="Généré automatiquement si vide"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={createCode} disabled={!selectedUserId || creating}>
                {creating ? "Création..." : "Créer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Codes list */}
      <div className="space-y-3">
        {codes.length === 0 && (
          <p className="text-text-muted text-center py-12">Aucun identifiant Xtream</p>
        )}
        {codes.map((code) => (
          <div
            key={code.id}
            className="bg-surface border border-border rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-medium">{code.user.name}</span>
                  <span className="text-text-dim text-sm">{code.user.email}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      code.isActive
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {code.isActive ? "Actif" : "Inactif"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Username:</span>
                    <code className="bg-black/30 px-2 py-0.5 rounded font-mono">{code.username}</code>
                    <button onClick={() => copyToClipboard(code.username, "Username")} className="text-text-dim hover:text-white">
                      <Copy size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Password:</span>
                    <code className="bg-black/30 px-2 py-0.5 rounded font-mono">
                      {visiblePasswords.has(code.id) ? code.password : "••••••••"}
                    </code>
                    <button onClick={() => togglePassword(code.id)} className="text-text-dim hover:text-white">
                      {visiblePasswords.has(code.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button onClick={() => copyToClipboard(code.password, "Password")} className="text-text-dim hover:text-white">
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => toggleActive(code)}>
                  {code.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteCode(code.id)}>
                  <Trash2 size={14} className="text-red-400" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
