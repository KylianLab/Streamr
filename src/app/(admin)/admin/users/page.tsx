"use client";

import { useEffect, useState } from "react";
import { Shield, User, Ban, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { profiles: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "USER" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    setUsers(await res.json());
  }

  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
    await fetch(`/api/admin/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    toast(`Rôle mis à jour`, "success");
    loadUsers();
  }

  async function toggleActive(userId: string, isActive: boolean) {
    await fetch(`/api/admin/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, isActive: !isActive }),
    });
    toast(isActive ? "Utilisateur désactivé" : "Utilisateur activé", "success");
    loadUsers();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Nom requis";
    if (!form.email.trim()) newErrors.email = "Email requis";
    if (form.password.length < 6) newErrors.password = "6 caractères minimum";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setCreating(true);
    setErrors({});

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      toast(data.error || "Erreur lors de la création", "error");
      setCreating(false);
      return;
    }

    toast("Utilisateur créé", "success");
    setForm({ name: "", email: "", password: "", role: "USER" });
    setShowForm(false);
    setCreating(false);
    loadUsers();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Annuler" : "Créer un utilisateur"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Nouvel utilisateur</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nom"
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
              placeholder="Jean Dupont"
            />
            <Input
              label="Email"
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={errors.email}
              placeholder="jean@exemple.fr"
            />
            <Input
              label="Mot de passe"
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={errors.password}
              placeholder="6 caractères minimum"
            />
            <div className="w-full">
              <label htmlFor="role" className="block text-sm font-medium text-text-muted mb-1">
                Rôle
              </label>
              <select
                id="role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded bg-surface border border-border px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" loading={creating}>
              Créer
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-4 bg-surface border border-border rounded-lg p-4">
            <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center">
              {user.role === "ADMIN" ? (
                <Shield size={20} className="text-primary" />
              ) : (
                <User size={20} className="text-text-dim" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{user.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  user.role === "ADMIN" ? "bg-primary/20 text-primary" : "bg-surface-hover text-text-muted"
                }`}>
                  {user.role}
                </span>
                {!user.isActive && (
                  <span className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300">
                    Désactivé
                  </span>
                )}
              </div>
              <p className="text-sm text-text-dim">{user.email}</p>
              <p className="text-xs text-text-dim mt-0.5">
                {user._count.profiles} profil(s) · Inscrit le {new Date(user.createdAt).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => toggleRole(user.id, user.role)}>
              {user.role === "ADMIN" ? "Retirer admin" : "Passer admin"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toggleActive(user.id, user.isActive)}>
              <Ban size={16} className={user.isActive ? "text-text-dim" : "text-red-400"} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
