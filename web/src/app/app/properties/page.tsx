"use client";

import { useEffect, useState } from "react";

type Unit = { id: string; label: string; type?: string | null; surface?: number | null };
type Property = {
  id: string;
  label: string;
  addressLine?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  units: Unit[];
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create property form
  const [label, setLabel] = useState("");
  const [city, setCity] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/properties");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      setLoading(false);
      return;
    }
    setProperties(data.properties ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProperty(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, city }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      return;
    }

    setLabel("");
    setCity("");
    await load();
  }

  async function addUnit(propertyId: string) {
    const unitLabel = window.prompt("Unit label (e.g., Apt 12)");
    if (!unitLabel) return;

    const res = await fetch(`/api/properties/${propertyId}/units`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: unitLabel }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      return;
    }
    await load();
  }

  async function deleteProperty(propertyId: string) {
    if (!confirm("Delete property and all its units?")) return;

    const res = await fetch(`/api/properties/${propertyId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      return;
    }
    await load();
  }

  function exportPropertyZip(propertyId: string) {
    window.open(`/api/properties/${propertyId}/export`, "_blank");
  }

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Properties</h1>

      <form onSubmit={createProperty} style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 16 }}>
        <input placeholder="Label (e.g., Casa Apt)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} />
        <button type="submit">Add property</button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && properties.length === 0 && <p>No properties yet.</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {properties.map((p) => (
          <section key={p.id} style={{ border: "1px solid #333", padding: 12, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <strong>{p.label}</strong> {p.city ? <span>— {p.city}</span> : null}
                <div style={{ fontSize: 12, opacity: 0.8 }}>{p.id}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => addUnit(p.id)}>+ Unit</button>
                <button onClick={() => deleteProperty(p.id)}>Delete</button>
                <button onClick={() => exportPropertyZip(p.id)}>Export property pack (ZIP)</button>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>Units:</div>
              {p.units.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>No units</div>
              ) : (
                <ul>
                  {p.units.map((u) => (
                    <li key={u.id}>
                      {u.label} {u.type ? `(${u.type})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
