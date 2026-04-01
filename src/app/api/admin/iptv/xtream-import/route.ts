import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchXtreamCategories, fetchXtreamChannelsByCategories,
  fetchVodCategories, fetchVodStreams, getVodStreamUrl,
  fetchSeriesCategories, fetchSeriesList, fetchSeriesInfo, getSeriesStreamUrl,
} from "@/lib/xtream-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminCheck(session: any) {
  return session?.user && session.user.role === "ADMIN";
}

// GET — List all Xtream providers
export async function GET() {
  const session = await auth();
  if (!adminCheck(session)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const providers = await prisma.xtreamProvider.findMany({
    include: { playlist: { select: { id: true, name: true, channelCount: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(providers);
}

// POST — action-based endpoint
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!adminCheck(session)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "categories":
      return handleCategories(body);
    case "import":
      return handleImport(body);
    case "refresh":
      return handleRefresh(body);
    case "update":
      return handleUpdate(body);
    case "vod-categories":
      return handleVodCategories(body);
    case "vod-import":
      return handleVodImport(body);
    case "series-categories":
      return handleSeriesCategories(body);
    case "series-import":
      return handleSeriesImport(body);
    default:
      return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  }
}

// DELETE — Remove provider
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!adminCheck(session)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const provider = await prisma.xtreamProvider.findUnique({ where: { id } });
  if (!provider) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

  if (provider.playlistId) {
    await prisma.iptvPlaylist.delete({ where: { id: provider.playlistId } }).catch(() => {});
  }
  await prisma.xtreamProvider.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

// ── Fetch categories from upstream provider ─────────

async function handleCategories(body: { serverUrl?: string; username?: string; password?: string }) {
  const { serverUrl, username, password } = body;
  if (!serverUrl || !username || !password) {
    return NextResponse.json({ error: "Serveur, identifiant et mot de passe requis" }, { status: 400 });
  }

  try {
    const categories = await fetchXtreamCategories(serverUrl, username, password);
    return NextResponse.json(categories);
  } catch (err) {
    return NextResponse.json(
      { error: `Impossible de contacter le fournisseur: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}

// ── Import selected categories ──────────────────────

async function handleImport(body: {
  name?: string;
  serverUrl?: string;
  username?: string;
  password?: string;
  categoryNames?: string[];
  categoryIds?: string[];
  autoRefresh?: boolean;
  refreshIntervalH?: number;
}) {
  const { name, serverUrl, username, password, categoryNames, categoryIds, autoRefresh, refreshIntervalH } = body;

  if (!name || !serverUrl || !username || !password || !categoryNames?.length) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  try {
    const channels = await fetchXtreamChannelsByCategories(serverUrl, username, password, categoryNames, categoryIds);

    // Store selected categories as JSON (keep both id and name for refresh)
    const selectedCats = categoryNames.map((n, i) => ({ id: categoryIds?.[i] || n, name: n }));

    const result = await prisma.$transaction(async (tx) => {
      const playlist = await tx.iptvPlaylist.create({
        data: {
          name,
          channelCount: channels.length,
          lastRefreshedAt: new Date(),
        },
      });

      if (channels.length > 0) {
        await tx.iptvChannel.createMany({
          data: channels.map((ch) => ({ playlistId: playlist.id, ...ch })),
        });
      }

      await tx.xtreamProvider.create({
        data: {
          name,
          serverUrl,
          username,
          password,
          selectedCategories: JSON.stringify(selectedCats),
          autoRefresh: autoRefresh || false,
          refreshIntervalH: refreshIntervalH || 24,
          lastRefreshedAt: new Date(),
          playlistId: playlist.id,
        },
      });

      return playlist;
    });

    return NextResponse.json({ ok: true, playlistId: result.id, channelCount: channels.length }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: `Erreur lors de l'import: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

// ── Refresh an existing provider ────────────────────

async function handleRefresh(body: { providerId?: string }) {
  const { providerId } = body;
  if (!providerId) return NextResponse.json({ error: "providerId requis" }, { status: 400 });

  const provider = await prisma.xtreamProvider.findUnique({ where: { id: providerId } });
  if (!provider || !provider.playlistId) {
    return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
  }

  const selectedCats: { id: string; name: string }[] = provider.selectedCategories
    ? JSON.parse(provider.selectedCategories)
    : [];

  if (selectedCats.length === 0) {
    return NextResponse.json({ error: "Aucune catégorie sélectionnée" }, { status: 400 });
  }

  try {
    const categoryNames = selectedCats.map((c) => c.name);
    const categoryIds = selectedCats.map((c) => c.id);
    const channels = await fetchXtreamChannelsByCategories(
      provider.serverUrl, provider.username, provider.password, categoryNames, categoryIds
    );

    await prisma.$transaction(async (tx) => {
      await tx.iptvChannel.deleteMany({ where: { playlistId: provider.playlistId! } });

      if (channels.length > 0) {
        await tx.iptvChannel.createMany({
          data: channels.map((ch) => ({ playlistId: provider.playlistId!, ...ch })),
        });
      }

      await tx.iptvPlaylist.update({
        where: { id: provider.playlistId! },
        data: { channelCount: channels.length, lastRefreshedAt: new Date() },
      });

      await tx.xtreamProvider.update({
        where: { id: providerId },
        data: { lastRefreshedAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true, channelCount: channels.length });
  } catch (err) {
    return NextResponse.json(
      { error: `Erreur lors du rafraîchissement: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

// ── Update provider categories & re-import ──────────

async function handleUpdate(body: {
  providerId?: string;
  categoryNames?: string[];
  categoryIds?: string[];
  autoRefresh?: boolean;
  refreshIntervalH?: number;
}) {
  const { providerId, categoryNames, categoryIds, autoRefresh, refreshIntervalH } = body;

  if (!providerId || !categoryNames?.length) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const provider = await prisma.xtreamProvider.findUnique({ where: { id: providerId } });
  if (!provider || !provider.playlistId) {
    return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
  }

  try {
    const channels = await fetchXtreamChannelsByCategories(
      provider.serverUrl, provider.username, provider.password, categoryNames, categoryIds
    );

    const selectedCats = categoryNames.map((n, i) => ({ id: categoryIds?.[i] || n, name: n }));

    await prisma.$transaction(async (tx) => {
      await tx.iptvChannel.deleteMany({ where: { playlistId: provider.playlistId! } });

      if (channels.length > 0) {
        await tx.iptvChannel.createMany({
          data: channels.map((ch) => ({ playlistId: provider.playlistId!, ...ch })),
        });
      }

      await tx.iptvPlaylist.update({
        where: { id: provider.playlistId! },
        data: { channelCount: channels.length, lastRefreshedAt: new Date() },
      });

      await tx.xtreamProvider.update({
        where: { id: providerId },
        data: {
          selectedCategories: JSON.stringify(selectedCats),
          autoRefresh: autoRefresh ?? provider.autoRefresh,
          refreshIntervalH: refreshIntervalH ?? provider.refreshIntervalH,
          lastRefreshedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ ok: true, channelCount: channels.length });
  } catch (err) {
    return NextResponse.json(
      { error: `Erreur lors de la mise à jour: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

// ── VOD Categories ──────────────────────────────

async function handleVodCategories(body: { serverUrl?: string; username?: string; password?: string }) {
  const { serverUrl, username, password } = body;
  if (!serverUrl || !username || !password) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }
  try {
    const cats = await fetchVodCategories(serverUrl, username, password);
    return NextResponse.json(cats);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

// ── VOD Import ──────────────────────────────────

async function getOrCreateIptvLibrary(mediaType: "MOVIE" | "SERIES") {
  const name = mediaType === "MOVIE" ? "IPTV Films" : "IPTV Séries";
  const path = mediaType === "MOVIE" ? "iptv://vod" : "iptv://series";

  let lib = await prisma.libraryPath.findUnique({ where: { path } });
  if (!lib) {
    lib = await prisma.libraryPath.create({
      data: { path, name, mediaType, autoScan: false },
    });
  }
  return lib;
}

async function handleVodImport(body: {
  serverUrl?: string;
  username?: string;
  password?: string;
  categoryIds?: string[];
  categoryNames?: string[];
}) {
  const { serverUrl, username, password, categoryIds, categoryNames } = body;
  if (!serverUrl || !username || !password || !categoryIds?.length) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  try {
    const library = await getOrCreateIptvLibrary("MOVIE");
    let imported = 0;

    for (let i = 0; i < categoryIds.length; i++) {
      const catId = categoryIds[i];
      const catName = categoryNames?.[i] || `VOD ${catId}`;
      const streams = await fetchVodStreams(serverUrl, username, password, catId);

      // Ensure genre exists
      const genre = await prisma.genre.upsert({
        where: { name: catName },
        create: { name: catName },
        update: {},
      });

      for (const vod of streams) {
        const ext = vod.container_extension || "mp4";
        const streamUrl = getVodStreamUrl(serverUrl, username, password, vod.stream_id, ext);

        // Skip if already imported (by filePath)
        const existing = await prisma.mediaFile.findUnique({ where: { filePath: streamUrl } });
        if (existing) continue;

        const media = await prisma.media.create({
          data: {
            type: "MOVIE",
            title: vod.name,
            posterPath: vod.stream_icon || null,
            rating: vod.rating ? parseFloat(vod.rating) || null : null,
            status: "PENDING",
          },
        });

        await prisma.mediaGenre.create({
          data: { mediaId: media.id, genreId: genre.id },
        }).catch(() => {}); // ignore duplicate

        await prisma.mediaFile.create({
          data: {
            filePath: streamUrl,
            fileName: `${vod.name}.${ext}`,
            fileSize: BigInt(0),
            containerFormat: ext,
            libraryPathId: library.id,
            mediaId: media.id,
          },
        });

        imported++;
      }
    }

    console.log(`[xtream-import] Imported ${imported} VOD movies`);
    return NextResponse.json({ ok: true, imported });
  } catch (err) {
    return NextResponse.json({ error: `Erreur VOD: ${(err as Error).message}` }, { status: 500 });
  }
}

// ── Series Categories ───────────────────────────

async function handleSeriesCategories(body: { serverUrl?: string; username?: string; password?: string }) {
  const { serverUrl, username, password } = body;
  if (!serverUrl || !username || !password) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }
  try {
    const cats = await fetchSeriesCategories(serverUrl, username, password);
    return NextResponse.json(cats);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

// ── Series Import ───────────────────────────────

async function handleSeriesImport(body: {
  serverUrl?: string;
  username?: string;
  password?: string;
  categoryIds?: string[];
  categoryNames?: string[];
}) {
  const { serverUrl, username, password, categoryIds, categoryNames } = body;
  if (!serverUrl || !username || !password || !categoryIds?.length) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  try {
    const library = await getOrCreateIptvLibrary("SERIES");
    let imported = 0;

    for (let i = 0; i < categoryIds.length; i++) {
      const catId = categoryIds[i];
      const catName = categoryNames?.[i] || `Séries ${catId}`;
      const seriesList = await fetchSeriesList(serverUrl, username, password, catId);

      const genre = await prisma.genre.upsert({
        where: { name: catName },
        create: { name: catName },
        update: {},
      });

      for (const s of seriesList) {
        // Fetch detailed series info (seasons & episodes)
        const info = await fetchSeriesInfo(serverUrl, username, password, s.series_id);
        if (!info) continue;

        const media = await prisma.media.create({
          data: {
            type: "SERIES",
            title: info.info.name || s.name,
            overview: info.info.plot || null,
            posterPath: info.info.cover || s.cover || null,
            backdropPath: info.info.backdrop_path?.[0] || null,
            rating: info.info.rating ? parseFloat(info.info.rating) || null : null,
            status: "PENDING",
          },
        });

        await prisma.mediaGenre.create({
          data: { mediaId: media.id, genreId: genre.id },
        }).catch(() => {});

        // Create seasons & episodes
        for (const seasonInfo of info.seasons || []) {
          const season = await prisma.season.create({
            data: {
              mediaId: media.id,
              seasonNumber: seasonInfo.season_number,
              name: seasonInfo.name || null,
              overview: seasonInfo.overview || null,
              posterPath: seasonInfo.cover || null,
              airDate: seasonInfo.air_date ? new Date(seasonInfo.air_date) : null,
            },
          });

          const episodes = info.episodes?.[String(seasonInfo.season_number)] || [];
          for (const ep of episodes) {
            const ext = ep.container_extension || "mp4";
            const streamUrl = getSeriesStreamUrl(serverUrl, username, password, ep.id, ext);

            const episode = await prisma.episode.create({
              data: {
                seasonId: season.id,
                episodeNumber: ep.episode_num,
                title: ep.title || null,
                overview: ep.info?.plot || null,
                stillPath: ep.info?.movie_image || null,
                runtime: ep.info?.duration_secs ? Math.floor(ep.info.duration_secs / 60) : null,
                airDate: ep.info?.release_date ? new Date(ep.info.release_date) : null,
              },
            });

            await prisma.mediaFile.create({
              data: {
                filePath: streamUrl,
                fileName: `${ep.title || `S${seasonInfo.season_number}E${ep.episode_num}`}.${ext}`,
                fileSize: BigInt(0),
                containerFormat: ext,
                duration: ep.info?.duration_secs || null,
                libraryPathId: library.id,
                episodeId: episode.id,
              },
            });
          }
        }

        imported++;
      }
    }

    console.log(`[xtream-import] Imported ${imported} series`);
    return NextResponse.json({ ok: true, imported });
  } catch (err) {
    return NextResponse.json({ error: `Erreur séries: ${(err as Error).message}` }, { status: 500 });
  }
}
