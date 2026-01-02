import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { z } from "zod";

const UpdateTenantSchema = z.object({
  fullName: z.string().min(2).optional(),
  idNumber: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = UpdateTenantSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.tenant.findFirst({ where: { id, orgId: session.orgId } });
  if (!existing) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const updated = await prisma.tenant.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json({ ok: true, tenant: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await ctx.params;

  const existing = await prisma.tenant.findFirst({ where: { id, orgId: session.orgId } });
  if (!existing) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  await prisma.tenant.delete({ where: { id } });
  return Response.json({ ok: true });
}
