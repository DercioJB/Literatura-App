import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

declare global {
  interface Window {
    deferredPrompt: any;
    showInstallPrompt: boolean;
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
  // Let the app know
  window.dispatchEvent(new Event('app:installprompt'));
});

// Register specific for PWA in Vite
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      if (confirm('Nova atualização disponível. Pretende atualizar agora?')) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
