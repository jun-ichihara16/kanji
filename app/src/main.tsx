import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// GitHub Pages SPA redirect handling
const redirect = sessionStorage.getItem('spa_redirect')
if (redirect) {
  sessionStorage.removeItem('spa_redirect')
  const url = new URL(redirect, window.location.origin)
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}

// Legacy path redirect: /kanji/app/* → /app/*
if (window.location.pathname.startsWith('/kanji/app/')) {
  window.location.replace(window.location.pathname.replace('/kanji/app/', '/app/'))
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/app" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
