"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Search, User, LogOut, Settings, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearActiveProfileId } from "@/hooks/use-profile";

export function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const links = [
    { href: "/browse", label: "Accueil" },
    { href: "/browse?type=MOVIE", label: "Films" },
    { href: "/browse?type=SERIES", label: "Séries" },
    { href: "/tv", label: "TV" },
    { href: "/watchlist", label: "Ma liste" },
  ];

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  function switchProfile() {
    clearActiveProfileId();
    router.push("/profiles");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent">
      <div className="flex items-center justify-between px-4 md:px-12 py-4">
        {/* Left */}
        <div className="flex items-center gap-8">
          <Link href="/browse" className="text-primary font-bold text-2xl tracking-tight">
            STREAMR
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm transition-colors hover:text-white",
                  (() => {
                    const [linkPath, linkQuery] = link.href.split("?");
                    const linkParams = new URLSearchParams(linkQuery || "");
                    const linkType = linkParams.get("type");
                    const currentType = searchParams.get("type");

                    if (linkPath !== pathname) return false;
                    // "Accueil" = /browse without type param
                    if (!linkType) return !currentType;
                    // "Films" / "Séries" = /browse with matching type param
                    return linkType === currentType;
                  })()
                    ? "text-white font-medium"
                    : "text-text-muted"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          {/* Search */}
          {showSearch ? (
            <form onSubmit={handleSearch} className="flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Titres, genres..."
                className="bg-black/80 border border-white/30 text-white text-sm px-3 py-1.5 rounded w-48 md:w-64 focus:outline-none focus:border-white"
                autoFocus
                onBlur={() => {
                  if (!searchQuery) setShowSearch(false);
                }}
              />
            </form>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="text-white hover:text-text-muted transition-colors"
            >
              <Search size={20} />
            </button>
          )}

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-1 text-white hover:text-text-muted transition-colors"
            >
              <User size={20} />
              <ChevronDown size={14} />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-lg shadow-xl z-50 py-1">
                  <button
                    onClick={() => { switchProfile(); setShowMenu(false); }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-surface-hover flex items-center gap-2"
                  >
                    <User size={16} />
                    Changer de profil
                  </button>
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setShowMenu(false)}
                    className="block px-4 py-2 text-sm hover:bg-surface-hover flex items-center gap-2"
                  >
                    <Settings size={16} />
                    Administration
                  </Link>
                  <hr className="border-border my-1" />
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-surface-hover flex items-center gap-2 text-red-400"
                  >
                    <LogOut size={16} />
                    Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
