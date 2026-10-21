import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { AuthSessionSync } from './components/auth/AuthSessionSync';
import './index.css';
import { initializeI18n } from './lib/i18n';
import { languagePreferenceStore } from './lib/languagePreferences';

const rootElement = document.getElementById('root');

async function mount() {
  const failedLanguage = await initializeI18n();
  if (failedLanguage)
    languagePreferenceStore.setState({ error: true, retryLanguage: failedLanguage });
  if (!rootElement) return;
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthSessionSync />
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
void mount().catch((error: unknown) => console.error('The application could not start.', error));
