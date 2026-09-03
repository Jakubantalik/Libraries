import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiTest } from './ApiTest'
import { App } from './App'
import { DemoPage } from './DemoPage'
import { MeltLab } from './MeltLab'
import { Solo } from './Solo'
import './styles.css'
import './demo.css'

// / = the marketing demo page. ?pro / ?lab = the full lab grid (?pro with
// the raw-physics panels). ?test = the consumer API test page.
const params = new URLSearchParams(window.location.search)
const test = params.has('test')
const lab = params.has('lab') || params.has('pro')
// ?melt = the from-scratch image-melting prototype, isolated from the lab.
const melt = params.has('melt')
// ?solo=<key> = one prototype on its own page, on the design's #F6F6F6 field.
const solo = params.get('solo')
// ?dev = recording mode for the demo page: no hero card fills, #101010 page.
const dev = params.has('dev')

document.documentElement.dataset.page = test || lab || melt || solo ? 'lab' : 'demo'
if (dev) document.documentElement.dataset.dev = ''
// The melt lab and every solo page are light-mode surfaces by spec (#F6F6F6).
if (melt || solo) document.documentElement.dataset.theme = 'light'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {solo ? (
      <Solo name={solo} />
    ) : melt ? (
      <MeltLab />
    ) : test ? (
      <ApiTest />
    ) : lab ? (
      <App />
    ) : (
      <DemoPage />
    )}
  </StrictMode>,
)
