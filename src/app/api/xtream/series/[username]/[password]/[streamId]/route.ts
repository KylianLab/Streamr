import { NextRequest } from "next/server";
import { handleXtreamStream } from "@/lib/xtream-stream";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string; password: string; streamId: string }> }
) {
  return handleXtreamStream(req, params);
}
