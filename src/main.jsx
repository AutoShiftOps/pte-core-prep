import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { reloadOnce } from './lib/stale.js';

// A new deployment replaced the files this tab was loaded with: reload once to pick up the new build.
window.addEventListener('vite:preloadError', (e) => { if (reloadOnce()) e.preventDefault(); });

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
