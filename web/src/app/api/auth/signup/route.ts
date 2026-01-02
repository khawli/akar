import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { buildSetCookieHeader } from "@/lib/auth/session";
import { signSession, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { z } from "zod";

const SignupSchema = z.object({
  orgName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const { orgName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ ok: false, error: "EMAIL_ALREADY_USED" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const created = await prisma.organization.create({
    data: {
      name: orgName,
      users: {
        create: {
          email,
          passwordHash,
        },
      },
    },
    include: { users: true },
  });

  const user = created.users[0];

    const token = await signSession({ userId: user.id, orgId: created.id, email: user.email });

  return new Response(
    JSON.stringify({
      ok: true,
      user: { id: user.id, email: user.email },
      org: { id: created.id, name: created.name },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": buildSetCookieHeader(token),
      },
    }
  );
}
