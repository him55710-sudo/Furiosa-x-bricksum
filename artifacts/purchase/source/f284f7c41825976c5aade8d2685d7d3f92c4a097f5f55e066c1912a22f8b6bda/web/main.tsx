import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import {PurchaseApp} from './PurchaseApp';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{location.pathname.startsWith('/purchase')?<PurchaseApp/>:<App/>}</React.StrictMode>);
