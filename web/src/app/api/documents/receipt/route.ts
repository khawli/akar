import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { renderReceiptHtml } from "@/lib/documents/receipt-template";
import { chromium } from "playwright";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { getDocumentsDir } from "@/lib/documents/storage";

const Schema = z.object({
  installmentId: z.string().min(1),
});

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
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
    include: {
      lease: { include: { tenant: true, unit: { include: { property: true } } } },
    },
  });

  if (!inst) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (inst.status !== "PAID" || !inst.paidAt) {
    return Response.json({ ok: false, error: "INSTALLMENT_NOT_PAID" }, { status: 409 });
  }

  // Idempotence: 1 receipt per installment (new world: storagePath)
  const existing = await prisma.document.findFirst({
    where: { orgId: session.orgId, installmentId: inst.id, type: "RECEIPT" },
    select: { id: true, storagePath: true },
  });

  if (existing?.storagePath) {
    const downloadUrl = `/api/documents/${existing.id}/download`;
    return Response.json({ ok: true, downloadUrl, document: { id: existing.id } });
  }

  // MVP: landlord name from user email
  const org = await prisma.organization.findUnique({ where: { id: session.orgId } });
  const landlordName = (org?.landlordProfileJson as any)?.name ?? session.email;
  const landlordAddress = (org?.landlordProfileJson as any)?.address ?? "";


  const receiptNo = `RC-${inst.period.replace("-", "")}-${inst.id.slice(-6).toUpperCase()}`;
  const issuedAt = ymd(new Date());

  const landlordIdNumber = (org?.landlordProfileJson as any)?.idNumber ?? "";

  const html = renderReceiptHtml({
    receiptNo,
    issuedAt,
    landlordName,
    landlordAddress,
    landlordIdNumber,
    tenantName: inst.lease.tenant.fullName,
    propertyLabel: inst.lease.unit.property.label,
    unitLabel: inst.lease.unit.label,
    period: inst.period,
    amount: inst.amount,
    currency: inst.lease.currency,
    paidAt: ymd(inst.paidAt),
  });

  const outDir = getDocumentsDir();

  const filename = `${receiptNo}.pdf`;
  const filePath = path.join(outDir, filename);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({ path: filePath, format: "A4", printBackground: true });
  await browser.close();

  const pdfUrl = `/generated/${filename}`;

  const doc = existing
    ? await prisma.document.update({
        where: { id: existing.id },
        data: {
          version: "1.0",
          payloadJson: {
            receiptNo,
            installmentId: inst.id,
            leaseId: inst.leaseId,
          },
          storagePath: filePath,
          leaseId: inst.leaseId,
          installmentId: inst.id,
        },
      })
    : await prisma.document.create({
        data: {
          orgId: session.orgId,
          type: "RECEIPT",
          version: "1.0",
          payloadJson: {
            receiptNo,
            installmentId: inst.id,
            leaseId: inst.leaseId,
          },
          storagePath: filePath,
          leaseId: inst.leaseId,
          installmentId: inst.id,
        },
      });

  const downloadUrl = `/api/documents/${doc.id}/download`;
  return Response.json({ ok: true, downloadUrl, document: doc });

}
