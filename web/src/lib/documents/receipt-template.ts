type ReceiptInput = {
  receiptNo: string;
  issuedAt: string; // YYYY-MM-DD
  landlordName: string;
  tenantName: string;
  propertyLabel: string;
  unitLabel: string;
  period: string; // YYYY-MM
  amount: number;
  currency: string;
  paidAt: string; // YYYY-MM-DD
  landlordAddress?: string;
  landlordIdNumber?: string;
};

export function renderReceiptHtml(d: ReceiptInput) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Quittance ${d.receiptNo}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; }
    .box { border:1px solid #222; padding:16px; border-radius:8px; margin-top:16px; }
    h1 { margin:0; font-size:20px; }
    .muted { color:#444; font-size:12px; }
    .row { display:flex; justify-content:space-between; gap:16px; }
    .k { font-weight:bold; }
    .sig { margin-top:40px; display:flex; justify-content:space-between; }
    .sig > div { width:45%; border-top:1px solid #222; padding-top:8px; font-size:12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>QUITTANCE DE LOYER</h1>
      <div class="muted">N° ${d.receiptNo} · Émise le ${d.issuedAt}</div>
    </div>
    <div class="muted" style="text-align:right">
      ${d.propertyLabel} — ${d.unitLabel}<br/>
      Période: ${d.period}
    </div>
  </div>

  <div class="box">
    <div class="row">
      <div><span class="k">Bailleur:</span> ${d.landlordName}</div>
      <div><span class="k">Locataire:</span> ${d.tenantName}</div>
      ${d.landlordAddress ? `<div class="muted">${d.landlordAddress}</div>` : ""}
      ${d.landlordIdNumber ? `<div class="muted">ICE/CIN: ${d.landlordIdNumber}</div>` : ""}
    </div>
    <div style="margin-top:10px">
      <div><span class="k">Montant:</span> ${d.amount} ${d.currency}</div>
      <div><span class="k">Payé le:</span> ${d.paidAt}</div>
    </div>
  </div>

  <div class="sig">
    <div>Signature bailleur</div>
    <div>Signature locataire</div>
  </div>

  <p class="muted" style="margin-top:24px">
    Document généré automatiquement. Version 1.0.
  </p>
</body>
</html>`;
}
