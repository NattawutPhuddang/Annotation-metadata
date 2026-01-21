// src/App.tsx
import React from 'react';
import { AnnotationProvider, useAnnotation } from './context/AnnotationContext';
import LoginPage from './pages/Login/LoginPage';
import MainLayout from './components/Layout/MainLayout';
import { LoadingOverlay } from './components/Shared/LoadingOverlay';

// 🟢 แยกส่วน Content ออกมา เพื่อให้ใช้ Hook "useAnnotation" ได้
const AppContent: React.FC = () => {
  const { employeeId, isLoading, loadingMsg } = useAnnotation();

  return (
    <>
      <LoadingOverlay isVisible={isLoading} message={loadingMsg} />
      
      {/* ถ้าไม่มี ID ให้ Login, ถ้ามีแล้วให้เข้าหน้า Layout หลัก */}
      {!employeeId ? (
        <LoginPage />
      ) : (
        <MainLayout />
      )}
    </>
  );
};

// 🟢 Component หลัก ทำหน้าที่แค่ Provide Context เท่านั้น
const App: React.FC = () => {
  return (
    <AnnotationProvider>
      <AppContent />
    </AnnotationProvider>
  );
};

export default App;