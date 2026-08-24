import React from 'react';
import { createRoot } from 'react-dom/client';
import { Debugger } from './components/Debugger';
import './tailwind.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<Debugger />);
