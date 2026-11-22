import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { LibraryProvider } from './store/LibraryContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LibraryProvider>
      <App />
    </LibraryProvider>
  </StrictMode>,
);
