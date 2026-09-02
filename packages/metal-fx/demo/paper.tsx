import React from 'react';
import { createRoot } from 'react-dom/client';
import { PaperPlayground } from './components/PaperPlayground';
import './tailwind.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<PaperPlayground />);
