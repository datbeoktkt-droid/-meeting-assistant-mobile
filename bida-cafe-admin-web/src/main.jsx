import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="runtime-shell">
          <div className="runtime-card">
            <div className="eyebrow">RUNTIME ERROR</div>
            <h1>Trang admin dang bi loi</h1>
            <p className="muted">Frontend da mount nhung gap loi runtime trong React.</p>
            <pre className="runtime-pre">{String(this.state.error?.stack || this.state.error)}</pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
