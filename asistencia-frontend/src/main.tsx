import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import './assets/app.css'
import { NetworkStatusProvider } from './hooks/useNetworkStatus'
import { ensureLocalDataReset } from './services/localAppData'

const queryClient = new QueryClient()

void ensureLocalDataReset()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NetworkStatusProvider>
          <App />
        </NetworkStatusProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
