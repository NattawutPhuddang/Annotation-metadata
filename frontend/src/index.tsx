// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/variables.css'; // 🟢 โหลด CSS Variables ที่เราเพิ่งสร้าง
import './index.css'; // โหลด Tailwind หรือ CSS พื้นฐานอื่นๆ ถ้ามี
import App from './App';
import { AnnotationProvider } from './context/AnnotationContext'; // ADD THIS
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <AnnotationProvider>
      <App />
    </AnnotationProvider>
  </React.StrictMode>
);

reportWebVitals();