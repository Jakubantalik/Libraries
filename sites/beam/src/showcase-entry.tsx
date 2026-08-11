import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Showcase from './ShowcasePage';
import './styles.css';
import './showcase.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Showcase />
  </StrictMode>
);
