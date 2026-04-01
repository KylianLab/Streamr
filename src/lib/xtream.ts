import { prisma } from "./prisma";

export async function authenticateXtream(username: string, password: string) {
  if (!username || !password) return null;

  const cred = await prisma.xtreamCode.findUnique({
    where: { username },
    include: { user: true },
  });

  if (!cred || cred.password !== password || !cred.isActive || !cred.user.isActive) {
    return null;
  }

  return cred;
}

export function xtreamServerInfo(host: string) {
  // Parse actual port from host URL
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    url = new URL("http://localhost");
  }

  const isHttps = url.protocol === "https:";
  const port = url.port || (isHttps ? "443" : "80");

  return {
    url: host,
    port,
    https_port: port,
    server_protocol: isHttps ? "https" : "http",
    rtmp_port: port,
    timezone: "Europe/Paris",
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString().replace("T", " ").substring(0, 19),
  };
}

export function xtreamUserInfo(username: string, password: string) {
  // exp_date: far future timestamp (players crash on null)
  const expDate = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;

  return {
    username,
    password,
    message: "",
    auth: 1,
    status: "Active",
    exp_date: String(expDate),
    is_trial: "0",
    active_cons: "0",
    created_at: Math.floor(Date.now() / 1000),
    max_connections: "1",
    allowed_output_formats: ["m3u8", "ts", "rtmp"],
  };
}
