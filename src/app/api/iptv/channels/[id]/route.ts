import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  const channel = await prisma.iptvChannel.findUnique({
    where: { id },
  });

  if (!channel) {
    return NextResponse.json(
      { error: "Chaîne non trouvée" },
      { status: 404 }
    );
  }

  // Return a proxied stream URL instead of the direct provider URL
  // This avoids CORS/mixed-content issues on mobile browsers
  return NextResponse.json({
    ...channel,
    streamUrl: `/api/iptv/channels/${channel.id}/stream`,
  });
}
