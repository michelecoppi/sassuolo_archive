import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { ExperienceProvider } from './context/ExperienceContext';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><ExperienceProvider><App/></ExperienceProvider></BrowserRouter></React.StrictMode>);
