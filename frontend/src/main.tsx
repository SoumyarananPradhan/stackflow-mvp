import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeApi } from './lib/api'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Missing root element')
}

const root = createRoot(rootElement)
root.render(<p className="p-6 text-sm text-slate-600">Connecting to StockFlow…</p>)

void initializeApi()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Unable to initialize the session.'
    root.render(
      <main className="p-6" role="alert">
        <h1 className="text-lg font-semibold">StockFlow could not start</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </main>,
    )
  })
