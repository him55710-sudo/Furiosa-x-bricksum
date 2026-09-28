import React from 'react';
import {createRoot} from 'react-dom/client';
import './base.css';
import {Replay} from './Replay';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Replay/></React.StrictMode>);
