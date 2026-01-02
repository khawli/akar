"use client";

import { useEffect, useState } from "react";

type Profile = {
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  idNumber?: string;
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>({ name: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setOk(null);

    const res = await fetch("/api/settings/org");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      setLoading(false);
      return;
    }

    setProfile(data.profile ?? { name: "" });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);

    const res = await fetch("/api/settings/org", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "ERROR");
      setSaving(false);
      return;
    }

    setOk("Saved.");
    setSaving(false);
  }

  return (
    <main style={{ padding: 24, maxWidth: 700 }}>
      <h1>Settings</h1>
      <p style={{ opacity: 0.8 }}>Landlord / Company profile used in PDFs.</p>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {ok && <p style={{ color: "limegreen" }}>{ok}</p>}

      {!loading && (
        <form onSubmit={save} style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <label>
            Name (required)
            <input
              value={profile.name ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g., Rachid Khawli"
            />
          </label>

          <label>
            Address
            <input
              value={profile.address ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
              placeholder="Street, building..."
            />
          </label>

          <label>
            City
            <input
              value={profile.city ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
              placeholder="Casablanca"
            />
          </label>

          <label>
            Phone
            <input
              value={profile.phone ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+212..."
            />
          </label>

          <label>
            ICE / CIN
            <input
              value={profile.idNumber ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, idNumber: e.target.value }))}
              placeholder="Optional"
            />
          </label>

          <button type="submit" disabled={saving || !profile.name || profile.name.length < 2}>
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      )}
    </main>
  );
}
