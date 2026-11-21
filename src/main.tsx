import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<HashRouter><App /></HashRouter>);

// Проверяем обновления PWA при возвращении на страницу.
// Не затрагивает IndexedDB: карточки и фотографии остаются на устройстве.
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
  const checkForUpdates = () => {
    navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {});
  };
  window.addEventListener('focus', checkForUpdates);
  window.addEventListener('pageshow', checkForUpdates);
}
