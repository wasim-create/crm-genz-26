import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Open with no signal: cache the app on the phone (live site only, not in
// previews or embedded frames).
if ('serviceWorker' in navigator && import.meta.env.PROD && window.self === window.top) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
