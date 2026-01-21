import React, { useState } from 'react';
import { Music, LogOut, Sun, Moon, BarChart2, Save } from 'lucide-react';
import { useAnnotation } from '../../context/AnnotationContext';
import './MainLayout.css';

// Import Pages (เราจะสร้างไฟล์เหล่านี้ในขั้นตอนหน้า)
// เดี๋ยวผมจะใส่ Placeholder ไว้ก่อนเพื่อให้โค้ดรันได้เบื้องต้น
import UploadPage from '../../pages/Upload/UploadPage';
import AnnotationPage from '../../pages/Annotation/AnnotationPage';
import CorrectPage from '../../pages/Correction/CorrectPage';
import EditPage from '../../pages/Edit/EditPage';
import DashboardPage from '../../pages/Dashboard/DashboardPage';

type Tab = "pending" | "correct" | "fail" | "dashboard";

const MainLayout: React.FC = () => {
  const { 
    employeeId, logout, isDarkMode, toggleTheme, 
    pendingItems, correctData, incorrectData,
    isLoading, hasStarted
  } = useAnnotation();

  const [currentTab, setCurrentTab] = useState<Tab>("pending");

  // 1. ถ้ายังไม่ได้เริ่มงาน (ยังไม่ Scan ไฟล์) ให้แสดงหน้า Upload
  if (!hasStarted) {
    return <UploadPage />;
  }

  // 2. ถ้าเริ่มแล้ว แสดง Layout หลัก
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <div className="logo-icon">
            <Music size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold" style={{ color: 'var(--text-main)' }}>
              Audio Annotator
            </span>
            <span className="user-badge">
              USER: {employeeId}
            </span>
          </div>
        </div>

        {/* Navigation Pills */}
        <nav className="nav-pills">
          {(["pending", "correct", "fail"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setCurrentTab(t)}
              className={`nav-item ${currentTab === t ? `active tab-${t}` : ""}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              <span className="ml-2 text-xs opacity-60">
                {t === "pending"
                  ? pendingItems.length
                  : t === "correct"
                    ? correctData.length
                    : incorrectData.length}
              </span>
            </button>
          ))}
          <button
            onClick={() => setCurrentTab("dashboard")}
            className={`nav-item ${currentTab === "dashboard" ? "active" : ""}`}
          >
            <BarChart2 size={16} className="mr-1.5 inline" /> Dashboard
          </button>
        </nav>

        {/* Right Actions */}
        <div className="header-actions">
          {isLoading && (
            <span className="text-xs text-indigo-400 flex gap-2 items-center">
              <Save size={14} className="animate-spin" /> Processing...
            </span>
          )}
          
          <button onClick={toggleTheme} className="btn-icon-header" title="Toggle Theme">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <button onClick={logout} className="btn-icon-header logout" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {currentTab === "pending" && <AnnotationPage />}
        {currentTab === "correct" && <CorrectPage />}
        {currentTab === "fail" && <EditPage />}
        {currentTab === "dashboard" && <DashboardPage />}
      </main>
    </div>
  );
};

export default MainLayout;