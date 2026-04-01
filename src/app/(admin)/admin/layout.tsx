"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderOpen, Film, Users, Settings, ArrowLeft, Radio, Cast } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToastContainer } from "@/components/ui/toast";

const adminLinks = [
  { href: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/libraries", label: "Bibliothèques", icon: FolderOpen },
  { href: "/admin/media", label: "Médias", icon: Film },
  { href: "/admin/iptv", label: "IPTV", icon: Radio },
  { href: "/admin/xtream", label: "Xtream", icon: Cast },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/settings", label: "Paramètres", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-border p-4 flex flex-col">
        <div className="mb-8">
          <Link href="/browse" className="flex items-center gap-2 text-text-muted hover:text-white transition-colors mb-4">
            <ArrowLeft size={16} />
            Retour
          </Link>
          <h1 className="text-xl font-bold text-primary">STREAMR</h1>
          <p className="text-xs text-text-dim">Administration</p>
        </div>

        <nav className="space-y-1 flex-1">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-text-muted hover:text-white hover:bg-surface-hover"
                )}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>

      <ToastContainer />
    </div>
  );
}
