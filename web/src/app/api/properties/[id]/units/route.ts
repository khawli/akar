import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { z } from "zod";

const CreateUnitSchema = z.object({
  label: z.string().min(1),
  type: z.string().optional(),
  surface: z.number().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: propertyId } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = CreateUnitSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  // ensure property belongs to org
  const property = await prisma.property.findFirst({ where: { id: propertyId, orgId: session.orgId } });
  if (!property) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const unit = await prisma.unit.create({
    data: {
      propertyId,
      label: parsed.data.label,
      type: parsed.data.type,
      surface: parsed.data.surface,
    },
  });

  return Response.json({ ok: true, unit });
}
