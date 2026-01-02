import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { z } from "zod";

const UpdatePropertySchema = z.object({
  label: z.string().min(2).optional(),
  addressLine: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = UpdatePropertySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  // enforce tenant boundary
  const existing = await prisma.property.findFirst({ where: { id, orgId: session.orgId } });
  if (!existing) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const updated = await prisma.property.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json({ ok: true, property: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await ctx.params;

  const existing = await prisma.property.findFirst({ where: { id, orgId: session.orgId } });
  if (!existing) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // delete units first to avoid FK issues (simple MVP policy)
  await prisma.unit.deleteMany({ where: { propertyId: id } });
  await prisma.property.delete({ where: { id } });

  return Response.json({ ok: true });
}
