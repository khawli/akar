import { buildClearCookieHeader } from "@/lib/auth/session";

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": buildClearCookieHeader(),
    },
  });
}
