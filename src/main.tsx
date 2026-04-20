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

// Register service worker for PWA and Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
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
