import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage.jsx';
import ExistenceMap from './ExistenceMap.jsx';
import PersistenceMap from './PersistenceMap.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/existence" element={<ExistenceMap />} />
        <Route path="/persistence" element={<PersistenceMap />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);