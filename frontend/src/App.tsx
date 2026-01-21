// src/App.tsx
import React, { useEffect, useState } from "react";
import { useAnnotation } from "./context/AnnotationContext";
import LoginPage from "./pages/Login/LoginPage";
import MainLayout from "./components/Layout/MainLayout";
import { Modal } from "./components/Shared/Modal";
import { RotateCw } from "lucide-react";
import "./App.css";

const App: React.FC = () => {
  const { employeeId, isLoading, loadingMsg, hasStarted, setHasStarted, audioFiles } = useAnnotation();
  const [showReloadModal, setShowReloadModal] = useState(false);

  // ตรวจจับเมื่อ page เพิ่งโหลด และ hasStarted = true แต่ audioFiles เป็นว่าง
  // (เพราะ blob URLs จะหาย หลังจาก refresh)
  useEffect(() => {
    const wasUnloading = sessionStorage.getItem("_isUnloading") === "true";
    sessionStorage.removeItem("_isUnloading");
    sessionStorage.setItem("_pageJustLoaded", "true");

    if (wasUnloading && hasStarted) {
      // User confirmed reload from browser dialog
      setShowReloadModal(true);
    } else if (hasStarted && audioFiles.length === 0) {
      // Normal refresh detection
      setShowReloadModal(true);
    }
  }, []);

  const handleConfirmReload = () => {
    setShowReloadModal(false);
    setHasStarted(false);
  };

  // Prompt user before leaving the page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasStarted && audioFiles.length > 0) {
        // This will trigger the refresh but we'll catch it after
        e.preventDefault();
        e.returnValue = ""; // Set to empty string - some browsers still show dialog
      }
    };

    // Detect page unload/refresh
    const handleUnload = () => {
      // When page is being unloaded, set a flag
      sessionStorage.setItem("_isUnloading", "true");
    };

    if (hasStarted && audioFiles.length > 0) {
      window.addEventListener("beforeunload", handleBeforeUnload);
      window.addEventListener("unload", handleUnload);

      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.removeEventListener("unload", handleUnload);
      };
    }
  }, [hasStarted, audioFiles.length]);

  // Loading Screen
  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--bg-app)",
        flexDirection: "column",
        gap: "1rem"
      }}>
        <div style={{ fontSize: "2rem", color: "var(--primary)" }}>
          <RotateCw className="animate-spin" size={40} />
        </div>
        <span style={{ color: "var(--text-light)" }}>{loadingMsg || "Loading..."}</span>
      </div>
    );
  }

  return (
    <>
      {/* Reload Warning Modal */}
      <Modal
        isOpen={showReloadModal}
        type="warning"
        title="Page Refreshed"
        message="จะต้องกลับไปอัปโหลด metadata และ ไฟล์เสียงใหม่"
        closeButton={false}
        actions={[
          {
            label: "Go to Upload",
            onClick: handleConfirmReload,
            variant: "primary",
          },
        ]}
      />

      {/* ถ้าไม่มี ID ให้ Login, ถ้ามีแล้วให้เข้าหน้า Layout หลัก */}
      {!employeeId ? (
        <LoginPage />
      ) : (
        <MainLayout />
      )}
    </>
  );
};

export default App;