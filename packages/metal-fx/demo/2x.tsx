import React from 'react';
import { createRoot } from 'react-dom/client';
import { Hero2x } from './components/Hero2x';
import './tailwind.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<Hero2x />);
