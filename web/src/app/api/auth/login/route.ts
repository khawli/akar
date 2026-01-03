import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signSession, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { buildSetCookieHeader } from "@/lib/auth/session";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return Response.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return Response.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  if (!user.orgId) {
    return Response.json({ ok: false, error: "NO_ORG" }, { status: 403 });
  }

    const token = await signSession({ userId: user.id, orgId: user.orgId ?? undefined, email: user.email });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": buildSetCookieHeader(token),
    },
  });
}
