"use client";

import { useEffect, useMemo, useState } from "react";

type Unit = { id: string; label: string; propertyId: string };
type Property = { id: string; label: string; units: Unit[] };
type Tenant = { id: string; fullName: string };

type Installment = {
  id: string;
  period: string;
  dueDate: string;
  amount: number;
  status: "PAID" | "UNPAID";
  paidAt?: string | null;
};

type Lease = {
  id: string;
  rentAmount: number;
  currency: string;
  paymentDay: number;
  startDate: string;
  status: "ACTIVE" | "ENDED";
  unit: { id: string; label: string; property: { label: string } };
  tenant: { id: string; fullName: string };
  installments: Installment[];
};

export default function LeasesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rentAmount, setRentAmount] = useState(2000);

  const unitsForProperty = useMemo(() => {
    const p = properties.find((x) => x.id === propertyId);
    return p?.units ?? [];
  }, [properties, propertyId]);

  async function loadAll() {
    setLoading(true);
    setError(null);

    const [lookupRes, leasesRes] = await Promise.all([
      fetch("/api/lookup"),
      fetch("/api/leases"),
    ]);

    const lookup = await lookupRes.json().catch(() => ({}));
    const leasesData = await leasesRes.json().catch(() => ({}));

    if (!lookupRes.ok) {
      setError(lookup?.error ?? "LOOKUP_ERROR");
      setLoading(false);
      return;
    }
    if (!leasesRes.ok) {
      setError(leasesData?.error ?? "LEASES_ERROR");
      setLoading(false);
      return;
    }

    setProperties(lookup.properties ?? []);
    setTenants(lookup.tenants ?? []);
    setLeases(leasesData.leases ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    // reset unit if property changes
    setUnitId("");
  }, [propertyId]);

  async function createLease(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/leases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        unitId,
        tenantId,
        startDate,
        rentAmount: Number(rentAmount),
        currency: "MAD",
        paymentDay: 1,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      return;
    }

    await loadAll();
  }

  async function markPaid(installmentId: string) {
    const res = await fetch(`/api/installments/${installmentId}/pay`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      return;
    }
    await loadAll();
  }

  async function generateReceipt(installmentId: string) {
    const res = await fetch("/api/documents/receipt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ installmentId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      return;
    }

    window.open(data.downloadUrl, "_blank");
  }

  async function generateNotice(installmentId: string) {
    const res = await fetch("/api/documents/notice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ installmentId, graceDays: 8 }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      return;
    }

    window.open(data.downloadUrl, "_blank");
  }

  async function openExistingDoc(installmentId: string, type: "RECEIPT" | "NOTICE") {
    const res = await fetch(`/api/documents/by-installment?installmentId=${encodeURIComponent(installmentId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      return;
    }
    const doc = (data.documents ?? []).find((d: any) => d.type === type && d.pdfUrl);
    if (!doc) {
      setError("DOC_NOT_FOUND");
      return;
    }
    window.open(`/api/documents/${doc.id}/download`, "_blank");
  }

  async function generateReminder(installmentId: string) {
    const res = await fetch("/api/documents/reminder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ installmentId, graceDays: 5 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data?.error ?? "ERROR"); return; }
    window.open(data.downloadUrl, "_blank");
  }

  function exportLeaseZip(leaseId: string) {
    window.open(`/api/leases/${leaseId}/export`, "_blank");
  }


  return (
    <main style={{ padding: 24, maxWidth: 1000 }}>
      <h1>Leases</h1>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && (
        <>
          <form onSubmit={createLease} style={{ display: "grid", gap: 10, marginTop: 16, marginBottom: 24, maxWidth: 520 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label>Property</label>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">Select...</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Unit</label>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={!propertyId}>
                <option value="">Select...</option>
                {unitsForProperty.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Tenant</label>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                <option value="">Select...</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Rent amount (MAD)</label>
              <input type="number" value={rentAmount} onChange={(e) => setRentAmount(Number(e.target.value))} />
            </div>

            <button type="submit" disabled={!unitId || !tenantId}>
              Create lease + 12 installments
            </button>
          </form>

          <div style={{ display: "grid", gap: 14 }}>
            {leases.map((l) => (
              <section key={l.id} style={{ border: "1px solid #333", padding: 12, borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <strong>{l.unit.property.label} — {l.unit.label}</strong>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>
                      Tenant: {l.tenant.fullName} · Rent: {l.rentAmount} {l.currency}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{l.status}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button onClick={() => exportLeaseZip(l.id)}>Export dossier (ZIP)</button>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{l.status}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>Installments:</div>
                  <ul style={{ marginTop: 6 }}>
                    {l.installments.map((i) => (
                      <li
                        key={i.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 16,
                          alignItems: "center",
                          padding: "6px 0",
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <strong style={{ fontWeight: 600 }}>
                            {i.period} · due {new Date(i.dueDate).toLocaleDateString("en-CA")} · {i.amount} {l.currency}
                            {i.status === "PAID" ? " ✅" : ""}
                          </strong>
                          <span style={{ fontSize: 12, opacity: 0.75 }}>
                            {i.status === "PAID" ? `Paid at ${i.paidAt ? new Date(i.paidAt).toLocaleDateString("en-CA") : ""}` : "Unpaid"}
                          </span>
                        </span>

                        {i.status === "UNPAID" ? (
                          <span style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => markPaid(i.id)}>Mark paid</button>
                            <button onClick={() => generateNotice(i.id)}>Generate notice PDF</button>
                            <button onClick={() => openExistingDoc(i.id, "NOTICE")}>Open notice</button>
                            <button onClick={() => generateReminder(i.id)}>Generate reminder PDF</button>

                          </span>
                        ) : (
                          <span style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => generateReceipt(i.id)}>Generate receipt PDF</button>
                            <button onClick={() => openExistingDoc(i.id, "RECEIPT")}>Open receipt</button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
          </div>

          {leases.length === 0 && <p>No leases yet.</p>}
        </>
      )}
    </main>
  );
}
