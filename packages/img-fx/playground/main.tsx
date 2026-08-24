import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Playground } from './Playground';

const root = document.getElementById('root');
if (!root) throw new Error('root not found');
createRoot(root).render(
  <StrictMode>
    <Playground />
  </StrictMode>
);
