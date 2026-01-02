import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(2),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  idNumber: z.string().optional(), // ICE/CIN
});

export async function GET() {
  const session = await requireSession();
  const org = await prisma.organization.findUnique({ where: { id: session.orgId } });

  return Response.json({
    ok: true,
    profile: (org?.landlordProfileJson as any) ?? null,
  });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const org = await prisma.organization.update({
    where: { id: session.orgId },
    data: { landlordProfileJson: parsed.data },
  });

  return Response.json({ ok: true, profile: org.landlordProfileJson });
}
