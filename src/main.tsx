import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ui/ErrorBoundary.tsx';
import { BackgroundAIProvider } from './contexts/BackgroundAIContext.tsx';

// Prevent default context menu (long-press popups like Google Search / Image search) on mobile
window.addEventListener('contextmenu', (e) => {
  // Allow context menu only inside inputs or textareas if needed
  const target = e.target as HTMLElement;
  if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
    e.preventDefault();
  }
});

// Unregister any existing service workers to ensure the latest version is loaded
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BackgroundAIProvider>
        <App />
      </BackgroundAIProvider>
    </ErrorBoundary>
  </StrictMode>,
);
