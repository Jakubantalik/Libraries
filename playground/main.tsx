import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiTest } from './ApiTest'
import { App } from './App'
import { DemoPage } from './DemoPage'
import './styles.css'
import './demo.css'

// / = the marketing demo page. ?pro / ?lab = the full lab grid (?pro with
// the raw-physics panels). ?test = the consumer API test page.
const params = new URLSearchParams(window.location.search)
const test = params.has('test')
const lab = params.has('lab') || params.has('pro')

document.documentElement.dataset.page = test || lab ? 'lab' : 'demo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{test ? <ApiTest /> : lab ? <App /> : <DemoPage />}</StrictMode>,
)
