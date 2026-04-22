import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from './ErrorBoundary';

(async () => {
  const root = document.getElementById('root');
  const renderFallback = (err) => {
    console.error('Failed to load App:', err);
    createRoot(root).render(
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#050505', color: '#F5F1E8', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ maxWidth: 900 }}>
          <h1 style={{ color: '#D4AF37' }}>Errore nell'app</h1>
          <div style={{ marginTop: 8 }}>Si è verificato un errore durante il caricamento dell'app. Controlla la console per i dettagli.</div>
          <pre style={{ marginTop: 12, background: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 6, color: '#fff', maxHeight: '40vh', overflow: 'auto' }}>{String(err && err.stack ? err.stack : err)}</pre>
        </div>
      </div>
    );
  };

  try {
    const module = await import('./App');
    const App = module.default;
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
  } catch (e) {
    renderFallback(e);
  }
})();
