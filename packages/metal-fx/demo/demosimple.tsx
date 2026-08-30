import React from 'react';
import { createRoot } from 'react-dom/client';
import { DemoSimple } from './components/DemoSimple';
import './tailwind.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<DemoSimple />);
