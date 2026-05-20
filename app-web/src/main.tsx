import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { LanguageProvider } from './i18n';
import { StoreProvider } from './stores';
import { router } from './routers';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <StoreProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </StoreProvider>
    </LanguageProvider>
  </StrictMode>
);
