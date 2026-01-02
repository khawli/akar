import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import fs from "fs";
import archiver from "archiver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const safe = (s: string) => (s || "").toString().trim().replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: propertyId } = await params;

  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId: session.orgId },
    include: { units: true },
  });

  if (!property) {
    return Response.json({ ok: false, error: "PROPERTY_NOT_FOUND" }, { status: 404 });
  }

  // Leases + relations + installments
  const leases = await prisma.lease.findMany({
    where: { orgId: session.orgId, unit: { propertyId } },
    include: {
      tenant: true,
      unit: { include: { property: true } },
      installments: { orderBy: { dueDate: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Documents de tous les baux
  const leaseIds = leases.map((l) => l.id);
  const docs = await prisma.document.findMany({
    where: { orgId: session.orgId, leaseId: { in: leaseIds, not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, leaseId: true, createdAt: true, storagePath: true },
  });


  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("data", async (chunk) => { await writer.write(chunk); });
  archive.on("end", async () => { await writer.close(); });
  archive.on("error", async (err) => { try { await writer.abort(err); } catch {} });

  const zipName = `property-${safe(property.label)}-${property.id.slice(-6)}.zip`;

  // Group docs by lease
  const docsByLease = new Map<string, Array<(typeof docs)[number]>>();

  for (const d of docs) {
    if (!d.leaseId) continue; // ✅ évite string | null
    const arr = docsByLease.get(d.leaseId) ?? [];
    arr.push(d);
    docsByLease.set(d.leaseId, arr);
  }


  for (const lease of leases) {
    const folder = `leases/${safe(`${lease.unit.label}-${lease.tenant.fullName}`)}-${lease.id.slice(-6)}`;

    const leasePayload = {
      exportedAt: new Date().toISOString(),
      lease: {
        id: lease.id,
        status: lease.status,
        startDate: lease.startDate,
        rentAmount: lease.rentAmount,
        currency: lease.currency,
        paymentDay: lease.paymentDay,
      },
      property: { label: lease.unit.property.label },
      unit: { label: lease.unit.label },
      tenant: { fullName: lease.tenant.fullName, address: lease.tenant.address ?? null },
      installments: lease.installments.map((i) => ({
        id: i.id, period: i.period, dueDate: i.dueDate, amount: i.amount, status: i.status, paidAt: i.paidAt ?? null,
      })),
    };

    archive.append(JSON.stringify(leasePayload, null, 2), { name: `${folder}/lease.json` });

    const leaseDocs = docsByLease.get(lease.id) ?? [];
    const rows = leaseDocs
      .filter((d) => d.storagePath && fs.existsSync(d.storagePath))
      .map((d) => {
        const fileName = `${d.type}-${d.id.slice(-6)}.pdf`;
        return `<li><b>${d.type}</b> — <a href="documents/${fileName}">${fileName}</a></li>`;
      })
      .join("");

    const indexHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>Dossier</title></head>
<body style="font-family:Arial,sans-serif;padding:24px">
<h2>Dossier location</h2>
<p><b>Bien:</b> ${lease.unit.property.label} — ${lease.unit.label}</p>
<p><b>Locataire:</b> ${lease.tenant.fullName}</p>
<hr/>
<h3>Documents</h3>
<ul>${rows || "<li>Aucun document PDF disponible</li>"}</ul>
</body></html>`;

    archive.append(indexHtml, { name: `${folder}/index.html` });

    for (const d of leaseDocs) {
      if (!d.storagePath) continue;
      if (!fs.existsSync(d.storagePath)) continue;
      const fileName = `${d.type}-${d.id.slice(-6)}.pdf`;
      archive.file(d.storagePath, { name: `${folder}/documents/${fileName}` });
    }
  }

  archive.finalize();

  return new Response(readable, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${zipName}"`,
      "cache-control": "private, max-age=0, no-store",
    },
  });
}
