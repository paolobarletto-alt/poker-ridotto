import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    this.setState({ hasError: true, error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          background: '#120000', color: '#ffdede', fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{ maxWidth: 900 }}>
            <h1 style={{ color: '#ffb3b3' }}>Errore nell'app</h1>
            <div style={{ marginTop: 8, color: '#ffdede', fontSize: 14 }}>Si è verificato un errore. Controlla la console per i dettagli.</div>
            <pre style={{ marginTop: 12, background: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 6, color: '#fff', maxHeight: '50vh', overflow: 'auto' }}>
              {String(this.state.error && this.state.error.stack ? this.state.error.stack : this.state.error)}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
