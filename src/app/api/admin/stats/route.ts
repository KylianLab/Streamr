import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const [movies, series, episodes, users, mediaFiles, libraries, totalSizeResult] =
    await Promise.all([
      prisma.media.count({ where: { type: "MOVIE" } }),
      prisma.media.count({ where: { type: "SERIES" } }),
      prisma.episode.count(),
      prisma.user.count(),
      prisma.mediaFile.count(),
      prisma.libraryPath.count(),
      prisma.mediaFile.aggregate({ _sum: { fileSize: true } }),
    ]);

  const totalBytes = Number(totalSizeResult._sum.fileSize || 0);
  let totalSize: string;
  if (totalBytes > 1e12) {
    totalSize = `${(totalBytes / 1e12).toFixed(2)} To`;
  } else if (totalBytes > 1e9) {
    totalSize = `${(totalBytes / 1e9).toFixed(2)} Go`;
  } else {
    totalSize = `${(totalBytes / 1e6).toFixed(2)} Mo`;
  }

  return NextResponse.json({
    movies,
    series,
    episodes,
    users,
    mediaFiles,
    libraries,
    totalSize,
  });
}
