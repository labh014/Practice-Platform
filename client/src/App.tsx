import { useEffect, useState } from 'react';

/**
 * Phase 0 placeholder. Its only job is to prove the client boots and can reach
 * the server through the Vite proxy. Replaced in Phase 7.
 */
export default function App() {
  const [health, setHealth] = useState<string>('checking...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: { status: string }) => setHealth(data.status))
      .catch(() => setHealth('unreachable'));
  }, []);

  return (
    <main style={{ padding: '3rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: 0 }}>LLD Practice</h1>
      <p style={{ color: '#666' }}>
        Understand exactly why your design can improve, revise it, and see whether the
        next attempt is actually better.
      </p>
      <p>
        Server: <strong>{health}</strong>
      </p>
    </main>
  );
}
