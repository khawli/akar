import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { chromium } from "playwright";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { getDocumentsDir } from "@/lib/documents/storage";

const Schema = z.object({
  installmentId: z.string().min(1),
  graceDays: z.number().int().min(1).max(60).optional(),
});

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function renderReminderHtml(d: any) {
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
body{font-family:Arial,sans-serif;padding:32px;line-height:1.35}
h1{margin:0;font-size:20px}
.muted{color:#444;font-size:12px}
.box{border:1px solid #222;padding:16px;border-radius:8px;margin-top:16px}
.row{display:flex;justify-content:space-between;gap:16px}
.k{font-weight:bold}
.sig{margin-top:48px;border-top:1px solid #222;padding-top:8px;width:320px;font-size:12px}
</style></head>
<body>
<div class="row">
  <div>
    <h1>RELANCE AMIABLE</h1>
    <div class="muted">N° ${d.no} · Émise le ${d.issuedAt}</div>
  </div>
  <div class="muted" style="text-align:right">
    ${d.propertyLabel} — ${d.unitLabel}<br/>
    Période: ${d.period}
  </div>
</div>

<div class="box">
  <div class="row">
    <div>
      <div class="k">Bailleur</div>
      <div>${d.landlordName}</div>
      ${d.landlordAddress ? `<div class="muted">${d.landlordAddress}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div class="k">Locataire</div>
      <div>${d.tenantName}</div>
      ${d.tenantAddress ? `<div class="muted">${d.tenantAddress}</div>` : ""}
    </div>
  </div>

  <div style="margin-top:14px">
    <p>
      Nous vous rappelons, en toute cordialité, que le loyer relatif à la période
      <span class="k">${d.period}</span> (échéance du <span class="k">${d.dueDate}</span>)
      reste dû pour un montant de <span class="k">${d.amount} ${d.currency}</span>.
    </p>

    <p>
      Nous vous remercions de bien vouloir régulariser sous <span class="k">${d.graceDays} jours</span>.
    </p>

    <p class="muted">
      Si le paiement a déjà été effectué, merci d’ignorer cette relance.
    </p>
  </div>
</div>

<div class="sig">Signature bailleur</div>
<p class="muted" style="margin-top:24px">Document généré automatiquement. Version 1.0.</p>
</body></html>`;
}

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const inst = await prisma.rentInstallment.findFirst({
    where: { id: parsed.data.installmentId, lease: { orgId: session.orgId } },
    include: { lease: { include: { tenant: true, unit: { include: { property: true } } } } },
  });

  if (!inst) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (inst.status !== "UNPAID") {
    return Response.json({ ok: false, error: "INSTALLMENT_NOT_UNPAID" }, { status: 409 });
  }

  const existing = await prisma.document.findFirst({
    where: { orgId: session.orgId, installmentId: inst.id, type: "REMINDER" },
    select: { id: true, storagePath: true },
  });

  if (existing?.storagePath && fs.existsSync(existing.storagePath)) {
    return Response.json({ ok: true, downloadUrl: `/api/documents/${existing.id}/download`, document: { id: existing.id } });
  }

  const org = await prisma.organization.findUnique({ where: { id: session.orgId } });
  const landlordName = (org?.landlordProfileJson as any)?.name ?? session.email;
  const landlordAddress = (org?.landlordProfileJson as any)?.address ?? "";

  const no = `RL-${inst.period.replace("-", "")}-${inst.id.slice(-6).toUpperCase()}`;
  const issuedAt = ymd(new Date());
  const graceDays = parsed.data.graceDays ?? 5;

  const html = renderReminderHtml({
    no,
    issuedAt,
    landlordName,
    landlordAddress,
    tenantName: inst.lease.tenant.fullName,
    tenantAddress: inst.lease.tenant.address ?? "",
    propertyLabel: inst.lease.unit.property.label,
    unitLabel: inst.lease.unit.label,
    period: inst.period,
    dueDate: ymd(inst.dueDate),
    amount: inst.amount,
    currency: inst.lease.currency,
    graceDays,
  });

  const outDir = getDocumentsDir();
  const filename = `${no}.pdf`;
  const filePath = path.join(outDir, filename);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({ path: filePath, format: "A4", printBackground: true });
  await browser.close();

  const doc = existing
    ? await prisma.document.update({
        where: { id: existing.id },
        data: {
          version: "1.0",
          payloadJson: { no, installmentId: inst.id, leaseId: inst.leaseId, graceDays },
          storagePath: filePath,
          leaseId: inst.leaseId,
          installmentId: inst.id,
        },
      })
    : await prisma.document.create({
        data: {
          orgId: session.orgId,
          type: "REMINDER",
          version: "1.0",
          payloadJson: { no, installmentId: inst.id, leaseId: inst.leaseId, graceDays },
          storagePath: filePath,
          leaseId: inst.leaseId,
          installmentId: inst.id,
        },
      });

  return Response.json({ ok: true, downloadUrl: `/api/documents/${doc.id}/download`, document: doc });
}
