import { Component, type ErrorInfo, type ReactNode } from 'react';
import './error-boundary.css';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Uncaught UI error', error, info); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app-error"><p className="eyebrow">SOMETHING WENT WRONG</p><h1>We couldn’t open this page.</h1><p>Your trips and account are safe. Please reload and try again.</p><button className="primary" onClick={() => window.location.reload()}>Reload GoCity</button></main>;
  }
}
