/**
 * Convert SRT subtitles to WebVTT format.
 * WebVTT is the only format natively supported by HTML5 video.
 */

export function srtToVtt(srt: string): string {
  let vtt = "WEBVTT\n\n";

  // Normalize line endings
  const content = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split into blocks
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    // Find the timestamp line (skip the index number)
    let timestampIdx = 0;
    if (/^\d+$/.test(lines[0])) {
      timestampIdx = 1;
    }

    if (timestampIdx >= lines.length) continue;

    const timestampLine = lines[timestampIdx];

    // Convert SRT timestamp format (00:00:00,000) to VTT format (00:00:00.000)
    const convertedTimestamp = timestampLine.replace(/,/g, ".");

    if (!convertedTimestamp.includes("-->")) continue;

    const textLines = lines.slice(timestampIdx + 1).join("\n");
    if (!textLines.trim()) continue;

    vtt += `${convertedTimestamp}\n${textLines}\n\n`;
  }

  return vtt;
}

export function assToVtt(ass: string): string {
  let vtt = "WEBVTT\n\n";

  const lines = ass.split("\n");
  const dialogueLines = lines.filter((l) =>
    l.startsWith("Dialogue:")
  );

  for (const line of dialogueLines) {
    // Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Text
    const match = line.match(
      /Dialogue:\s*\d+,(\d+:\d+:\d+\.\d+),(\d+:\d+:\d+\.\d+),[^,]*,[^,]*,\d+,\d+,\d+,[^,]*,(.*)/
    );

    if (!match) continue;

    const start = match[1];
    const end = match[2];
    let text = match[3];

    // Remove ASS formatting tags
    text = text
      .replace(/\{[^}]*\}/g, "")
      .replace(/\\N/g, "\n")
      .replace(/\\n/g, "\n")
      .trim();

    if (!text) continue;

    vtt += `${start} --> ${end}\n${text}\n\n`;
  }

  return vtt;
}
