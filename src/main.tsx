import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { ExperienceProvider } from './context/ExperienceContext';
if('serviceWorker'in navigator&&import.meta.env.PROD)window.addEventListener('load',()=>void navigator.serviceWorker.register('/sw.js'));
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><ExperienceProvider><App/></ExperienceProvider></BrowserRouter></React.StrictMode>);
