export interface ParsedChannel {
  name: string;
  logoUrl: string | null;
  group: string | null;
  tvgId: string | null;
  streamUrl: string;
  order: number;
}

export function isHlsManifest(content: string): boolean {
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  // HLS manifests contain segment/stream tags that M3U playlists don't
  return lines.some(
    (l) =>
      l.startsWith("#EXT-X-TARGETDURATION") ||
      l.startsWith("#EXT-X-MEDIA-SEQUENCE") ||
      l.startsWith("#EXT-X-STREAM-INF") ||
      l.startsWith("#EXT-X-VERSION") ||
      l.startsWith("#EXT-X-MAP")
  );
}

export function parseM3U(content: string): ParsedChannel[] {
  // Don't parse HLS manifests as channel playlists
  if (isHlsManifest(content)) return [];

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const channels: ParsedChannel[] = [];
  let order = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip the M3U header
    if (line.startsWith("#EXTM3U")) continue;

    // Look for EXTINF lines
    if (!line.startsWith("#EXTINF:")) continue;

    // Extract attributes via regex
    const tvgName = line.match(/tvg-name="([^"]*)"/)?.[1] || null;
    const tvgLogo = line.match(/tvg-logo="([^"]*)"/)?.[1] || null;
    const groupTitle = line.match(/group-title="([^"]*)"/)?.[1] || null;
    const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1] || null;

    // Display name is after the last comma on the EXTINF line
    const commaIndex = line.lastIndexOf(",");
    const displayName = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : "";

    // Name = tvg-name or display name
    const name = tvgName || displayName || "Sans nom";

    // Next non-empty non-comment line is the stream URL
    let streamUrl = "";
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].startsWith("#") && lines[j].length > 0) {
        streamUrl = lines[j];
        i = j; // advance outer loop past the URL
        break;
      }
    }

    if (!streamUrl) continue;

    channels.push({
      name,
      logoUrl: tvgLogo || null,
      group: groupTitle || null,
      tvgId: tvgId || null,
      streamUrl,
      order: order++,
    });
  }

  return channels;
}
