import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiTest } from './ApiTest'
import { App } from './App'
import './styles.css'

// ?test renders the consumer API test: library only, no playground CSS.
const test = new URLSearchParams(window.location.search).has('test')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{test ? <ApiTest /> : <App />}</StrictMode>,
)
