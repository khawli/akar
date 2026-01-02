import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { z } from "zod";

const CreatePropertySchema = z.object({
  label: z.string().min(2),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await requireSession();

  const properties = await prisma.property.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: "desc" },
    include: { units: true },
  });

  return Response.json({ ok: true, properties });
}

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);

  const parsed = CreatePropertySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const created = await prisma.property.create({
    data: {
      orgId: session.orgId,
      ...parsed.data,
      country: parsed.data.country ?? "MA",
    },
  });

  return Response.json({ ok: true, property: created });
}
