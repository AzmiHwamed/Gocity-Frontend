import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import './favorites-hidden.css';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { ToastHost } from './ToastHost';
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><BrowserRouter><App /><ToastHost /></BrowserRouter></ErrorBoundary></StrictMode>);
