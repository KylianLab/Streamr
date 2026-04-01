/**
 * Client for connecting to an upstream Xtream Codes IPTV provider.
 * Supports both player_api.php (JSON) and get.php (M3U) endpoints.
 */

import { parseM3U, type ParsedChannel } from "./m3u-parser";

export interface XtreamCategory {
  category_id: string;
  category_name: string;
}

export interface XtreamChannel {
  name: string;
  logoUrl: string | null;
  group: string | null;
  streamUrl: string;
  tvgId: string | null;
  order: number;
}

export interface XtreamVodItem {
  stream_id: number;
  name: string;
  stream_icon?: string;
  rating?: string;
  category_id?: string;
  container_extension?: string;
  added?: string;
}

export interface XtreamSeriesItem {
  series_id: number;
  name: string;
  cover?: string;
  plot?: string;
  cast?: string;
  genre?: string;
  rating?: string;
  category_id?: string;
  backdrop_path?: string[];
}

export interface XtreamSeriesInfo {
  info: {
    name: string;
    cover?: string;
    plot?: string;
    cast?: string;
    genre?: string;
    rating?: string;
    backdrop_path?: string[];
  };
  seasons: Array<{
    season_number: number;
    name?: string;
    overview?: string;
    cover?: string;
    air_date?: string;
  }>;
  episodes: Record<string, Array<{
    id: string;
    episode_num: number;
    title: string;
    container_extension?: string;
    info?: { plot?: string; duration_secs?: number; movie_image?: string; release_date?: string };
    season: number;
  }>>;
}

const FETCH_HEADERS = {
  "User-Agent": "IPTVSmartersPro",
  "Accept": "*/*",
};

// ── Build URLs ──────────────────────────────────

function buildPlayerApiUrl(serverUrl: string, username: string, password: string, action: string, extra?: Record<string, string>) {
  const base = serverUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({ username, password, action, ...extra });
  return `${base}/player_api.php?${params}`;
}

function buildM3UUrl(serverUrl: string, username: string, password: string) {
  const base = serverUrl.replace(/\/+$/, "");
  return `${base}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`;
}

function buildLiveStreamUrl(serverUrl: string, username: string, password: string, streamId: number | string) {
  const base = serverUrl.replace(/\/+$/, "");
  return `${base}/live/${username}/${password}/${streamId}.m3u8`;
}

function buildVodStreamUrl(serverUrl: string, username: string, password: string, streamId: number | string, ext = "mp4") {
  const base = serverUrl.replace(/\/+$/, "");
  return `${base}/movie/${username}/${password}/${streamId}.${ext}`;
}

function buildSeriesStreamUrl(serverUrl: string, username: string, password: string, episodeId: string | number, ext = "mp4") {
  const base = serverUrl.replace(/\/+$/, "");
  return `${base}/series/${username}/${password}/${episodeId}.${ext}`;
}

// ── Track which method works for this provider ──

let providerMode: { key: string; mode: "api" | "m3u" } | null = null;

// ── player_api.php helpers ──────────────────────

async function fetchFromPlayerApi(serverUrl: string, username: string, password: string, action: string, extra?: Record<string, string>): Promise<unknown[] | null> {
  try {
    const url = buildPlayerApiUrl(serverUrl, username, password, action, extra);
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

// ── M3U helpers ─────────────────────────────────

let cachedM3U: { key: string; channels: ParsedChannel[]; ts: number } | null = null;

async function fetchM3UChannels(serverUrl: string, username: string, password: string): Promise<ParsedChannel[]> {
  const key = `${serverUrl}|${username}`;
  if (cachedM3U && cachedM3U.key === key && Date.now() - cachedM3U.ts < 300000) {
    return cachedM3U.channels;
  }
  const url = buildM3UUrl(serverUrl, username, password);
  console.log("[xtream-client] Fetching M3U from:", url.replace(password, "***"));
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(60000) });
  console.log("[xtream-client] M3U response status:", res.status);
  if (!res.ok) throw new Error(`Le fournisseur a retourné une erreur ${res.status}`);
  const text = await res.text();
  const channels = parseM3U(text);
  console.log("[xtream-client] Parsed", channels.length, "channels");
  cachedM3U = { key, channels, ts: Date.now() };
  return channels;
}

// ── Public API ──────────────────────────────────

/**
 * Fetch categories from the provider.
 * Tries player_api.php first, falls back to M3U groups.
 */
export async function fetchXtreamCategories(serverUrl: string, username: string, password: string): Promise<XtreamCategory[]> {
  const key = `${serverUrl}|${username}`;

  // Try player_api.php
  const apiResult = await fetchFromPlayerApi(serverUrl, username, password, "get_live_categories");
  if (apiResult && apiResult.length > 0) {
    console.log("[xtream-client] Using player_api.php for categories");
    providerMode = { key, mode: "api" };
    return apiResult as XtreamCategory[];
  }

  // Fall back to M3U
  console.log("[xtream-client] player_api.php failed, falling back to M3U");
  providerMode = { key, mode: "m3u" };
  const channels = await fetchM3UChannels(serverUrl, username, password);

  const groupSet = new Map<string, number>();
  for (const ch of channels) {
    const g = ch.group || "Sans groupe";
    groupSet.set(g, (groupSet.get(g) || 0) + 1);
  }

  const categories: XtreamCategory[] = [];
  let i = 1;
  for (const [name] of groupSet) {
    categories.push({ category_id: String(i++), category_name: name });
  }
  return categories;
}

/**
 * Fetch channels for selected category names.
 * Uses player_api.php if it worked for categories, otherwise M3U.
 */
export async function fetchXtreamChannelsByCategories(
  serverUrl: string,
  username: string,
  password: string,
  categoryNames: string[],
  categoryIds?: string[]
): Promise<XtreamChannel[]> {
  const key = `${serverUrl}|${username}`;
  const useApi = providerMode?.key === key && providerMode.mode === "api";

  if (useApi && categoryIds?.length) {
    return fetchChannelsViaApi(serverUrl, username, password, categoryNames, categoryIds);
  }

  return fetchChannelsViaM3U(serverUrl, username, password, categoryNames);
}

// ── Fetch via player_api.php ────────────────────

async function fetchChannelsViaApi(
  serverUrl: string,
  username: string,
  password: string,
  categoryNames: string[],
  categoryIds: string[]
): Promise<XtreamChannel[]> {
  console.log("[xtream-client] Fetching channels via player_api.php for", categoryIds.length, "categories");
  const allChannels: XtreamChannel[] = [];
  let order = 0;

  for (let i = 0; i < categoryIds.length; i++) {
    const catId = categoryIds[i];
    const catName = categoryNames[i] || `Cat ${catId}`;

    const streams = await fetchFromPlayerApi(serverUrl, username, password, "get_live_streams", { category_id: catId });
    if (!streams) continue;

    for (const s of streams as Array<{ name: string; stream_icon?: string; stream_id: number; epg_channel_id?: string }>) {
      allChannels.push({
        name: s.name,
        logoUrl: s.stream_icon || null,
        group: catName,
        streamUrl: buildLiveStreamUrl(serverUrl, username, password, s.stream_id),
        tvgId: s.epg_channel_id || null,
        order: order++,
      });
    }
  }

  console.log("[xtream-client] Fetched", allChannels.length, "channels via API");
  return allChannels;
}

// ── Fetch via M3U ───────────────────────────────

async function fetchChannelsViaM3U(
  serverUrl: string,
  username: string,
  password: string,
  categoryNames: string[]
): Promise<XtreamChannel[]> {
  console.log("[xtream-client] Fetching channels via M3U for groups:", categoryNames.join(", "));
  const channels = await fetchM3UChannels(serverUrl, username, password);
  const nameSet = new Set(categoryNames);

  let order = 0;
  return channels
    .filter((ch) => nameSet.has(ch.group || "Sans groupe"))
    .map((ch) => ({
      name: ch.name,
      logoUrl: ch.logoUrl,
      group: ch.group,
      streamUrl: ch.streamUrl,
      tvgId: ch.tvgId,
      order: order++,
    }));
}

// ── VOD (Films) ─────────────────────────────────

export async function fetchVodCategories(serverUrl: string, username: string, password: string): Promise<XtreamCategory[]> {
  const result = await fetchFromPlayerApi(serverUrl, username, password, "get_vod_categories");
  return (result as XtreamCategory[]) || [];
}

export async function fetchVodStreams(serverUrl: string, username: string, password: string, categoryId?: string): Promise<XtreamVodItem[]> {
  const extra: Record<string, string> = {};
  if (categoryId) extra.category_id = categoryId;
  const result = await fetchFromPlayerApi(serverUrl, username, password, "get_vod_streams", extra);
  return (result as XtreamVodItem[]) || [];
}

export function getVodStreamUrl(serverUrl: string, username: string, password: string, streamId: number, ext?: string) {
  return buildVodStreamUrl(serverUrl, username, password, streamId, ext);
}

// ── Séries ──────────────────────────────────────

export async function fetchSeriesCategories(serverUrl: string, username: string, password: string): Promise<XtreamCategory[]> {
  const result = await fetchFromPlayerApi(serverUrl, username, password, "get_series_categories");
  return (result as XtreamCategory[]) || [];
}

export async function fetchSeriesList(serverUrl: string, username: string, password: string, categoryId?: string): Promise<XtreamSeriesItem[]> {
  const extra: Record<string, string> = {};
  if (categoryId) extra.category_id = categoryId;
  const result = await fetchFromPlayerApi(serverUrl, username, password, "get_series", extra);
  return (result as XtreamSeriesItem[]) || [];
}

export async function fetchSeriesInfo(serverUrl: string, username: string, password: string, seriesId: number): Promise<XtreamSeriesInfo | null> {
  try {
    const url = buildPlayerApiUrl(serverUrl, username, password, "get_series_info", { series_id: String(seriesId) });
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data as XtreamSeriesInfo;
  } catch {
    return null;
  }
}

export function getSeriesStreamUrl(serverUrl: string, username: string, password: string, episodeId: string | number, ext?: string) {
  return buildSeriesStreamUrl(serverUrl, username, password, episodeId, ext);
}
