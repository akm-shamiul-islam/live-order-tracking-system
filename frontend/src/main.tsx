import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { AuthSessionSync } from './components/auth/AuthSessionSync';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthSessionSync />
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
