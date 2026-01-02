import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { z } from "zod";

const CreateLeaseSchema = z.object({
  unitId: z.string().min(1),
  tenantId: z.string().min(1),
  startDate: z.string().min(10), // ISO date
  endDate: z.string().optional(), // ISO date
  rentAmount: z.number().int().positive(),
  currency: z.string().optional(), // "MAD"
  paymentDay: z.number().int().min(1).max(28).optional(),
});

function ym(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonthsUTC(dateUTC: Date, months: number) {
  const d = new Date(dateUTC);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

// prend "YYYY-MM-DD" et retourne une Date à 12:00 UTC (évite les shifts)
function dateAtNoonUTC(isoDate: string) {
  // isoDate: "2026-02-01"
  return new Date(`${isoDate}T12:00:00.000Z`);
}

function dueDateUTCNoon(year: number, monthIndex0: number, day: number) {
  return new Date(Date.UTC(year, monthIndex0, day, 12, 0, 0));
}


export async function GET() {
  const session = await requireSession();

  const leases = await prisma.lease.findMany({
    where: { orgId: session.orgId },
    orderBy: { createdAt: "desc" },
    include: {
      unit: { include: { property: true } },
      tenant: true,
      installments: { orderBy: { dueDate: "asc" } },
    },
  });

  return Response.json({ ok: true, leases });
}

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);

  const parsed = CreateLeaseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const { unitId, tenantId } = parsed.data;

  // Ensure unit belongs to org via property
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, property: { orgId: session.orgId } },
    include: { property: true },
  });
  if (!unit) return Response.json({ ok: false, error: "UNIT_NOT_FOUND" }, { status: 404 });

  // Ensure tenant belongs to org
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, orgId: session.orgId } });
  if (!tenant) return Response.json({ ok: false, error: "TENANT_NOT_FOUND" }, { status: 404 });

  // Enforce 1 ACTIVE lease per unit
  const active = await prisma.lease.findFirst({ where: { unitId, orgId: session.orgId, status: "ACTIVE" } });
  if (active) return Response.json({ ok: false, error: "UNIT_ALREADY_HAS_ACTIVE_LEASE" }, { status: 409 });

  const start = dateAtNoonUTC(parsed.data.startDate);
  if (Number.isNaN(start.getTime())) return Response.json({ ok: false, error: "INVALID_START_DATE" }, { status: 400 });

  const end = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
  if (end && Number.isNaN(end.getTime())) return Response.json({ ok: false, error: "INVALID_END_DATE" }, { status: 400 });

  const rentAmount = parsed.data.rentAmount;
  const currency = parsed.data.currency ?? "MAD";
  const paymentDay = parsed.data.paymentDay ?? 1;

  // Create lease + 12 installments (MVP)
  const lease = await prisma.lease.create({
    data: {
      orgId: session.orgId,
      unitId,
      tenantId,
      startDate: start,
      endDate: end ?? undefined,
      rentAmount,
      currency,
      paymentDay,
      status: "ACTIVE",
      installments: {
        create: Array.from({ length: 12 }).map((_, i) => {
          // month i starting from start month
          const dueMonth = addMonthsUTC(start, i);

          const y = dueMonth.getUTCFullYear();
          const m = dueMonth.getUTCMonth(); // 0..11

          // due date = paymentDay in that month, at noon UTC
          const dueDate = dueDateUTCNoon(y, m, Math.min(paymentDay, 28));

          // period must match dueMonth (not start-1)
          const period = `${y}-${String(m + 1).padStart(2, "0")}`;

          return {
            period,
            dueDate,
            amount: rentAmount,
            status: "UNPAID",
          };
        }),
      },

    },
    include: {
      unit: { include: { property: true } },
      tenant: true,
      installments: { orderBy: { dueDate: "asc" } },
    },
  });

  return Response.json({ ok: true, lease });
}
