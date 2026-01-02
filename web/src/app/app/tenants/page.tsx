"use client";

import { useEffect, useState } from "react";

type Tenant = {
  id: string;
  fullName: string;
  idNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/tenants");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      setLoading(false);
      return;
    }
    setTenants(data.tenants ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName, phone }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      return;
    }

    setFullName("");
    setPhone("");
    await load();
  }

  async function deleteTenant(id: string) {
    if (!confirm("Delete tenant?")) return;

    const res = await fetch(`/api/tenants/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      return;
    }
    await load();
  }

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Tenants</h1>

      <form onSubmit={createTenant} style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 16 }}>
        <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button type="submit">Add tenant</button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && tenants.length === 0 && <p>No tenants yet.</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {tenants.map((t) => (
          <section key={t.id} style={{ border: "1px solid #333", padding: 12, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <strong>{t.fullName}</strong> {t.phone ? <span>— {t.phone}</span> : null}
                <div style={{ fontSize: 12, opacity: 0.8 }}>{t.id}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => deleteTenant(t.id)}>Delete</button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
