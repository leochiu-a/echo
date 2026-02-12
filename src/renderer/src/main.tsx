import React from 'react'
import { createRoot } from 'react-dom/client'
import { RootApp } from './RootApp'
import './styles/app.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Missing #root container.')
}

createRoot(rootElement).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
)
