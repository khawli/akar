export default function AppHome() {
  return (
    <main style={{ padding: 24 }}>
      <h1>AKAR Dashboard</h1>
      <p>Protected area OK.</p>

      <p><a href="/app/properties">Properties</a></p>
      <p><a href="/app/tenants">Tenants</a></p>
      <p><a href="/app/leases">Leases</a></p>
      <p><a href="/app/settings">Settings</a></p>
    </main>
  );
}
