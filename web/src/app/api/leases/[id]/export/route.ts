import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { getDocumentsDir } from "@/lib/documents/storage";
import fs from "fs";
import path from "path";
import archiver from "archiver";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id: leaseId } = await params;

  // 1) Charger bail + relations
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, orgId: session.orgId },
    include: {
      tenant: true,
      unit: { include: { property: true } },
      installments: { orderBy: { dueDate: "asc" } },
    },
  });

  if (!lease) {
    return Response.json({ ok: false, error: "LEASE_NOT_FOUND" }, { status: 404 });
  }

  // 2) Charger documents (on prend ceux avec storagePath)
  const docs = await prisma.document.findMany({
    where: { orgId: session.orgId, leaseId },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, createdAt: true, storagePath: true },
  });

  // 3) Construire un nom de fichier propre
  const safe = (s: string) => (s || "").toString().trim().replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
  const safeLabel = safe(`${lease.unit.property.label}-${lease.unit.label}`);
  const safeTenant = safe(lease.tenant.fullName);
  const zipName = `dossier-${safeLabel}-${safeTenant}-${lease.id.slice(-6)}.zip`;

  // 4) Préparer une réponse streaming
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // archiver écrit dans un "stream" Node. On fait un pont vers le writer Web.
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("data", async (chunk) => {
    await writer.write(chunk);
  });
  archive.on("end", async () => {
    await writer.close();
  });
  archive.on("error", async (err) => {
    try { await writer.abort(err); } catch {}
  });

  // 5) Ajouter lease.json
  const payload = {
    exportedAt: new Date().toISOString(),
    lease: {
      id: lease.id,
      status: lease.status,
      startDate: lease.startDate,
      rentAmount: lease.rentAmount,
      currency: lease.currency,
      paymentDay: lease.paymentDay,
    },
    property: {
      label: lease.unit.property.label,
    },
    unit: {
      label: lease.unit.label,
    },
    tenant: {
      fullName: lease.tenant.fullName,
      address: lease.tenant.address ?? null,
    },
    installments: lease.installments.map((i) => ({
      id: i.id,
      period: i.period,
      dueDate: i.dueDate,
      amount: i.amount,
      status: i.status,
      paidAt: i.paidAt ?? null,
    })),
    documents: docs.map((d) => ({
      id: d.id,
      type: d.type,
      createdAt: d.createdAt,
      hasFile: !!d.storagePath,
    })),
  };

  archive.append(JSON.stringify(payload, null, 2), { name: "lease.json" });

  // 6) Ajouter un index.html (sommaire)
  const docRows = docs
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
  <ul>${docRows || "<li>Aucun document PDF disponible</li>"}</ul>
  </body></html>`;

  archive.append(indexHtml, { name: "index.html" });

  // 7) Ajouter les PDFs
  for (const d of docs) {
    if (!d.storagePath) continue;
    if (!fs.existsSync(d.storagePath)) continue;
    const fileName = `${d.type}-${d.id.slice(-6)}.pdf`;
    archive.file(d.storagePath, { name: `documents/${fileName}` });
  }

  // Finalize
  archive.finalize();

  // 8) Retourner le flux
  return new Response(readable, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${zipName}"`,
      "cache-control": "private, max-age=0, no-store",
    },
  });
}
