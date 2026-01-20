import React, { useState, useEffect, useMemo } from "react";
import "./App.css";
import { AudioItem } from "./types";
import UploadPage from "./pages/UploadPage";
import AnnotationPage from "./pages/AnnotationPage";
import CorrectPage from "./pages/CorrectPage";
import EditPage from "./pages/EditPage";
import { LogOut, Save, Music, User, ArrowRight, BarChart2 } from "lucide-react";
import { LoadingOverlay } from "./components/LoadingOverlay";
import DashboardPage from "./pages/DashboardPage"; // 🟢 เพิ่มบรรทัดนี้

type Tab = "pending" | "correct" | "fail" | "dashboard";

// 🔴 CONFIG: ใช้แบบ Dev เพื่อความยืดหยุ่น (แก้ Port หรือ IP ได้ที่นี่หรือ .env)
const API_BASE = process.env.REACT_APP_API_URL || "http://10.2.98.118:3003";

const App: React.FC = () => {
  // --- Auth State (จาก Dev) ---
  const [employeeId, setEmployeeId] = useState<string>(
    () => localStorage.getItem("employeeId") || "",
  );
  const [tempId, setTempId] = useState("");

  // --- Data Stores ---
  const [hasStarted, setHasStarted] = useState<boolean>(() =>
    JSON.parse(localStorage.getItem("hasStarted") || "false"),
  );
  const [currentTab, setCurrentTab] = useState<Tab>("pending");

  const [metadata, setMetadata] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("metadata") || "[]"),
  );
  const [audioPath, setAudioPath] = useState<string>(
    () => localStorage.getItem("audioPath") || "",
  );

  const [audioFiles, setAudioFiles] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("audioFiles") || "[]"),
  );

  const [correctData, setCorrectData] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("correctData") || "[]"),
  );
  const [incorrectData, setIncorrectData] = useState<AudioItem[]>(() =>
    JSON.parse(localStorage.getItem("incorrectData") || "[]"),
  );
  const [changes, setChanges] = useState<
    Array<{ original: string; changed: string }>
  >(() => JSON.parse(localStorage.getItem("changes") || "[]"));
  const [tempEdits, setTempEdits] = useState<Record<string, string>>(() =>
    JSON.parse(localStorage.getItem("tempEdits") || "{}"),
  );

  // --- Performance State (จาก List-UI) ---
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [tokenCache, setTokenCache] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [isScanning, setIsScanning] = useState(false);
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<File[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [playingFile, setPlayingFile] = useState<string | null>(null);

  // --- Helper Functions (จาก Dev) ---
  const getFileName = (base: string) => `${employeeId}-${base}`;

  const deleteUserLog = async (filenameKey: string, type: "correct") => {
    try {
      const userFileName = getFileName(
        `${type === "correct" ? "Correct" : "fail"}.tsv`,
      );
      // ⚠️ หมายเหตุ: Backend Python ต้องมี API นี้ด้วย
      await fetch(`${API_BASE}/api/delete-tsv-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: userFileName, key: filenameKey }),
      });
    } catch (e) {
      console.error("Delete log failed", e);
    }
  };

  const logUserAction = async (item: AudioItem, type: "correct") => {
    try {
      const filename = getFileName(
        `${type === "correct" ? "Correct" : "fail"}.tsv`,
      );
      // ⚠️ หมายเหตุ: Backend Python ต้องมี API นี้ด้วย
      await fetch(`${API_BASE}/api/append-tsv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, item }),
      });
    } catch (e) {
      console.error("Log failed", e);
    }
  };

  // 🟢 NEW: ฟังก์ชันสำหรับอัปเดตไฟล์ Global แบบปลอดภัย (ใช้ Append/Upsert)
  const appendToGlobal = async (filename: string, item: AudioItem) => {
    setIsSaving(true);
    try {
      await fetch(`${API_BASE}/api/append-tsv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, item }),
      });
    } catch (e) {
      console.error(`Error appending to ${filename}`, e);
    } finally {
      setIsSaving(false);
    }
  };

  // 🟢 NEW: ฟังก์ชันสำหรับลบออกจาก Global (ใช้ API ที่มีอยู่แล้ว)
  const removeFromGlobal = async (filename: string, key: string) => {
    try {
      await fetch(`${API_BASE}/api/delete-tsv-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, key }),
      });
    } catch (e) {
      console.error(`Error deleting from ${filename}`, e);
    }
  };

  // --- Persistence ---
  useEffect(() => {
    if (employeeId) localStorage.setItem("employeeId", employeeId);
  }, [employeeId]);
  useEffect(() => {
    localStorage.setItem("hasStarted", JSON.stringify(hasStarted));
  }, [hasStarted]);
  useEffect(() => {
    localStorage.setItem("metadata", JSON.stringify(metadata));
  }, [metadata]);
  useEffect(() => {
    localStorage.setItem("audioPath", audioPath);
  }, [audioPath]);
  useEffect(() => {
    const safeToSave = audioFiles.map((a) => ({ ...a, audioPath: "" }));
    localStorage.setItem("audioFiles", JSON.stringify(safeToSave));
  }, [audioFiles]);
  useEffect(() => {
    localStorage.setItem("correctData", JSON.stringify(correctData));
  }, [correctData]);
  useEffect(() => {
    localStorage.setItem("incorrectData", JSON.stringify(incorrectData));
  }, [incorrectData]);
  useEffect(() => {
    localStorage.setItem("changes", JSON.stringify(changes));
  }, [changes]);
  useEffect(() => {
    localStorage.setItem("tempEdits", JSON.stringify(tempEdits));
  }, [tempEdits]);

  // --- 1. Load Data (Logic ผสม: รอ Login ก่อนค่อยโหลด) ---
  useEffect(() => {
    if (!employeeId) return;

    // Check Stale Data
    const savedAudioFiles = JSON.parse(
      localStorage.getItem("audioFiles") || "[]",
    );
    if (savedAudioFiles.length > 0) {
      const samplePath = savedAudioFiles[0].audioPath || "";
      if (samplePath.startsWith("blob:") || samplePath.includes(":")) {
        setAudioFiles([]);
        setHasStarted(false);
        setAudioPath("");
        localStorage.removeItem("audioFiles");
      }
    }

    const loadTSV = async (name: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/load-file?filename=${name}`);
        if (!res.ok) return [];
        const txt = await res.text();
        return txt
          .split("\n")
          .slice(1)
          .map((r) => {
            const [f, t] = r.trim().split("\t");
            return f && t ? { filename: f, text: t } : null;
          })
          .filter(Boolean) as AudioItem[];
      } catch {
        return [];
      }
    };

    const loadChanges = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/load-file?filename=ListOfChange.tsv`,
        );
        if (!res.ok) return [];
        const txt = await res.text();
        return txt
          .split("\n")
          .slice(1)
          .map((r) => {
            const [o, c] = r.trim().split("\t");
            return o && c ? { original: o, changed: c } : null;
          })
          .filter(Boolean);
      } catch {
        return [];
      }
    };

    Promise.all([
      loadTSV("Correct.tsv"),
      loadTSV("fail.tsv"),
      loadChanges(),
    ]).then(([c, f, ch]) => {
      if (c.length) setCorrectData(c);
      if (f.length) setIncorrectData(f.reverse());
      if (ch.length) setChanges(ch as any);
    });
  }, [employeeId]);

  // --- 2. Check Refresh ---
  useEffect(() => {
    if (hasStarted && audioFiles.length > 0 && !audioFiles[0].audioPath) {
      alert(
        "⚠️ กรุณาเลือกโฟลเดอร์ไฟล์เสียงใหม่อีกครั้ง\n(เนื่องจาก Browser รีเฟรชหน้าจอทำให้การเชื่อมต่อไฟล์หลุดไป)",
      );
      setHasStarted(false);
      setAudioFiles([]);
      setAudioPath("");
    }
  }, [hasStarted, audioFiles]);

  // --- 🟢 3. Pre-Tokenization Logic (Batch) ---
  const preTokenize = async (items: AudioItem[]) => {
    const uniqueTexts = Array.from(new Set(items.map((i) => i.text))).filter(
      (t) => !tokenCache.has(t),
    );

    if (uniqueTexts.length === 0) return;

    const chunkSize = 50;
    const newCache = new Map(tokenCache);

    for (let i = 0; i < uniqueTexts.length; i += chunkSize) {
      const chunk = uniqueTexts.slice(i, i + chunkSize);
      try {
        const res = await fetch(`${API_BASE}/api/tokenize-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: chunk }),
        });
        const tokensList = await res.json();
        chunk.forEach((txt, idx) => {
          if (tokensList[idx]) newCache.set(txt, tokensList[idx]);
        });
      } catch (e) {
        console.error("Batch tokenize failed", e);
      }
    }
    setTokenCache(newCache);
  };

  // --- Logic Functions ---
  const fileMap = useMemo(() => {
    const m = new Map<string, string>();
    audioFiles.forEach((f) => {
      if (f.audioPath) m.set(f.filename, f.audioPath);
    });
    return m;
  }, [audioFiles]);

  const availableFilenames = useMemo(
    () => new Set(audioFiles.map((a) => a.filename)),
    [audioFiles],
  );

  const enrich = (items: AudioItem[]) =>
    items.map((i) => {
      let src = i.audioPath;
      if (!src) src = fileMap.get(i.filename);
      // แปลง Path สำหรับ Python Backend
      if (src && !src.startsWith("blob:") && !src.startsWith("http")) {
        src = `${API_BASE}/api/audio?path=${encodeURIComponent(src)}`;
      }
      return { ...i, audioPath: src };
    });

  const saveFile = async (name: string, data: AudioItem[]) => {
    setIsSaving(true);
    const content =
      "filename\ttext\n" +
      data.map((i) => `${i.filename}\t${i.text}`).join("\n");
    await fetch(`${API_BASE}/api/save-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: name, content }),
    });
    setIsSaving(false);
  };

  const playAudio = (item: AudioItem) => {
    setPlayingFile((curr) => (curr === item.filename ? null : item.filename));
  };

  const handleDecision = (item: AudioItem, status: "correct" | "incorrect") => {
    // 1. อัปเดต State หน้าจอ (เพื่อให้ UI ตอบสนองทันที)
    const newC =
      status === "correct"
        ? [...correctData, item]
        : correctData.filter((i) => i.filename !== item.filename);
    const newF =
      status === "incorrect"
        // 🟢 แก้ตรงนี้: เอา item ไว้ข้างหน้า incorrectData (แทรกบนสุด)
        ? [item, ...incorrectData] 
        : incorrectData.filter((i) => i.filename !== item.filename);

    setCorrectData(newC);
    setIncorrectData(newF);

    // 2. 🟢 แก้ไข: บันทึกข้อมูลลง Backend (ใช้แบบ Append แทน SaveFile)
    if (status === "correct") {
      // เพิ่มลง Correct.tsv
      appendToGlobal("Correct.tsv", item);
      // ลบออกจาก fail.tsv (เผื่อเคยอยู่)
      removeFromGlobal("fail.tsv", item.filename);

      // User Log (Personal)
      logUserAction(item, "correct");
    } else {
      // เพิ่มลง fail.tsv
      appendToGlobal("fail.tsv", item);
      // ลบออกจาก Correct.tsv (เผื่อเคยอยู่)
      removeFromGlobal("Correct.tsv", item.filename);

      // User Log (Remove personal correct log)
      deleteUserLog(item.filename, "correct");
    }
  };

  const handleCorrection = async (item: AudioItem, newText: string) => {
    const matches = [...newText.matchAll(/\(([^,]+),([^)]+)\)/g)];
    if (matches.length > 0) {
      for (const m of matches) {
        try {
          await fetch(`${API_BASE}/api/append-change`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ original: m[1], changed: m[2] }),
          });
        } catch (err) {
          console.error("Save change failed", err);
        }
      }
      const newChanges = [
        ...changes,
        ...matches.map((m) => ({ original: m[1], changed: m[2] })),
      ];
      setChanges(newChanges);
    }

    const cleanText = newText.replace(/\(([^,]+),([^)]+)\)/g, "$2");
    const newItem = { ...item, text: cleanText };

    // อัปเดต State
    const newF = incorrectData.filter((i) => i.filename !== item.filename);
    const newC = [...correctData, newItem];

    setIncorrectData(newF);
    setCorrectData(newC);

    // 🟢 แก้ไข: ใช้ appendToGlobal แทน saveFile
    // saveFile("Correct.tsv", newC); <--- ลบอันนี้
    // saveFile("fail.tsv", newF);    <--- ลบอันนี้
    
    // ย้ายจาก Fail -> Correct (Global)
    appendToGlobal("Correct.tsv", newItem); // Upsert ตัวใหม่
    removeFromGlobal("fail.tsv", item.filename); // ลบจาก Fail

    logUserAction(newItem, "correct"); // Log personal

    setTempEdits((prev) => {
      const next = { ...prev };
      delete next[item.filename];
      return next;
    });
  };
  const handleInspect = async (text: string) => {
    if (tokenCache.has(text)) return tokenCache.get(text) || [];
    try {
      const res = await fetch(`${API_BASE}/api/tokenize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return await res.json();
    } catch {
      return [];
    }
  };

  const downloadTSV = (data: AudioItem[], name: string) => {
    const content =
      "filename\ttext\n" +
      data.map((i) => `${i.filename}\t${i.text}`).join("\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  const downloadPersonalLog = async () => {
    const filename = getFileName("Correct.tsv");
    try {
      const res = await fetch(`${API_BASE}/api/load-file?filename=${filename}`);
      if (!res.ok) {
        alert(
          `ยังไม่มีไฟล์ Log ส่วนตัว (${filename})\n(ลองทำงานสัก 1 รายการแล้วกดใหม่)`,
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    } catch (e) {
      alert("Error fetching personal log");
    }
  };

  // --- Filtering ---
  const pending = enrich(
    audioFiles.filter(
      (i) =>
        !correctData.some((c) => c.filename === i.filename) &&
        !incorrectData.some((f) => f.filename === i.filename),
    ),
  );
  const correct = enrich(correctData);
  const incorrect = enrich(incorrectData);

  // 🟢 Effect: Background Pre-loading
  useEffect(() => {
    if (pending.length > 0) {
      preTokenize(pending.slice(0, 30));
    }
  }, [pending.length, hasStarted]);

  // --- LOGIN PAGE (Dev Feature) ---
  if (!employeeId) {
    return (
      <div className="page-container center-content bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center border border-slate-100">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <User size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-700 mb-2">
            Employee Login
          </h1>
          <p className="text-slate-400 mb-6 text-sm">
            Enter your ID to access workspace
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tempId.trim()) setEmployeeId(tempId.trim());
            }}
          >
            <input
              autoFocus
              type="text"
              className="w-full text-center text-lg tracking-widest px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all mb-4 uppercase"
              placeholder="e.g., EMP001"
              value={tempId}
              onChange={(e) => setTempId(e.target.value)}
            />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
              disabled={!tempId.trim()}
            >
              Enter Workspace <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  if (!hasStarted)
    return (
      <>
        <LoadingOverlay isVisible={isLoading} message={loadingMsg} />
        <UploadPage
          metadata={metadata}
          audioPath={audioPath}
          setAudioPath={setAudioPath}
          isScanning={isScanning}
          onFolderSelect={(fileList) => {
            setSelectedLocalFiles(Array.from(fileList));
            if (fileList.length > 0) {
              const name =
                fileList[0].webkitRelativePath.split("/")[0] ||
                "Selected Folder";
              setAudioPath(`${name} (${fileList.length} files)`);
            }
          }}
          onMetadataUpload={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              const r = new FileReader();
              r.onload = (ev) => {
                const rows = (ev.target?.result as string).split("\n");
                setMetadata(
                  rows
                    .slice(1)
                    .map((x) => {
                      const [n, t] = x.split("\t");
                      return { filename: n, text: t };
                    })
                    .filter((x) => x.filename),
                );
              };
              r.readAsText(f);
            }
          }}
          onScan={async () => {
            setIsLoading(true); // 🟢 Show Overlay
            setLoadingMsg("Scanning audio files...");
            await new Promise((r) => setTimeout(r, 500));

            try {
              let matched: AudioItem[] = [];
              if (selectedLocalFiles.length > 0) {
                const fileMap = new Map<string, File>();
                for (const f of selectedLocalFiles) {
                  fileMap.set(f.name, f);
                  const nameNoExt = f.name.substring(
                    0,
                    f.name.lastIndexOf("."),
                  );
                  if (nameNoExt) fileMap.set(nameNoExt, f);
                }
                matched = metadata
                  .map((m) => {
                    const file = fileMap.get(m.filename);
                    return file
                      ? {
                          filename: m.filename,
                          text: m.text,
                          audioPath: URL.createObjectURL(file),
                        }
                      : null;
                  })
                  .filter(Boolean) as AudioItem[];
              } else {
                if (!audioPath) {
                  alert("Please specify folder path");
                  return;
                }
                const res = await fetch(`${API_BASE}/api/scan-audio`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ path: audioPath }),
                });
                const serverFiles: string[] = await res.json();
                const serverFileMap = new Map<string, string>();
                serverFiles.forEach((p) => {
                  const fname = p.split(/[/\\]/).pop() || "";
                  serverFileMap.set(fname, p);
                  const nameNoExt = fname.substring(0, fname.lastIndexOf("."));
                  if (nameNoExt) serverFileMap.set(nameNoExt, p);
                });
                matched = metadata
                  .map((m) => {
                    const path = serverFileMap.get(m.filename);
                    return path
                      ? { filename: m.filename, text: m.text, audioPath: path }
                      : null;
                  })
                  .filter(Boolean) as AudioItem[];
              }

              if (matched.length) {
                setAudioFiles(matched);
                setLoadingMsg(
                  `Optimizing ${Math.min(matched.length, 100)} items...`,
                );
                await preTokenize(matched.slice(0, 100));
                setHasStarted(true);
              } else {
                alert(
                  `ไม่พบไฟล์เสียงที่ตรงกันเลย\n(โปรดตรวจสอบชื่อไฟล์ใน Metadata)`,
                );
              }
            } catch (error) {
              console.error(error);
              alert("เกิดข้อผิดพลาดในการประมวลผลไฟล์");
            } finally {
              setIsLoading(false);
              setIsScanning(false);
            }
          }}
          onLogout={() => {
            if (window.confirm("Log out from workspace?")) {
              setEmployeeId("");
              localStorage.removeItem("employeeId");
              setHasStarted(false);
              setAudioFiles([]);
              setAudioPath("");
              setTokenCache(new Map());
            }
          }}
        />
      </>
    );

  return (
    <div className="app-container">
      <LoadingOverlay isVisible={isLoading} message={loadingMsg} />

      <header className={`app-header ${window.scrollY > 10 ? "scrolled" : ""}`}>
        <div className="header-logo">
          <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg">
            <Music size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-700">
              Audio Annotator
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider">
              USER: {employeeId}
            </span>
          </div>
        </div>

        <div className="nav-pills">
          {/* ส่วนเดิม: ลูปสร้างปุ่ม Pending, Correct, Fail */}
          {(["pending", "correct", "fail"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setCurrentTab(t)}
              className={`nav-item ${currentTab === t ? `active tab-${t}` : ""}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              <span className="ml-2 text-xs opacity-60">
                {t === "pending"
                  ? pending.length
                  : t === "correct"
                    ? correct.length
                    : incorrect.length}
              </span>
            </button>
          ))}

          {/* 🟢 3.1 เพิ่มส่วนนี้เข้าไป (ต่อท้าย loop แต่ยังอยู่ใน div) */}
          <button
            onClick={() => setCurrentTab("dashboard")}
            className={`nav-item ${currentTab === "dashboard" ? "active bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-200" : "text-slate-500 hover:bg-slate-50"}`}
            title="View Leaderboard"
          >
            {/* อย่าลืม import BarChart2 ข้างบนด้วยนะครับ */}
            <BarChart2 size={16} className="mr-1.5" />
            Dashboard
          </button>
        </div>

        <div className="flex items-center gap-4">
          {isSaving && (
            <span className="text-xs text-indigo-400 flex gap-2 items-center">
              <Save size={14} className="animate-spin" /> Saving...
            </span>
          )}
          <button
            onClick={() => {
              if (window.confirm("Log out from workspace?")) {
                setEmployeeId("");
                localStorage.removeItem("employeeId");
                setHasStarted(false);
                setAudioFiles([]);
                setAudioPath("");
                setTokenCache(new Map());
              }
            }}
            className="btn-icon text-red-300 hover:text-red-500 hover:bg-red-50"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="main-content animate-fade-in">
        {currentTab === "pending" && (
          <AnnotationPage
            pendingItems={pending}
            onDecision={handleDecision}
            playAudio={playAudio}
            playingFile={playingFile}
            onInspectText={handleInspect}
            // tokenCache={tokenCache} // 🟢 ส่ง Cache ไปให้
          />
        )}
        {currentTab === "correct" && (
          <CorrectPage
            data={correct}
            onMoveToFail={(i) => handleDecision(i, "incorrect")}
            onDownload={downloadTSV}
            onDownloadPersonal={downloadPersonalLog}
            playAudio={playAudio}
            playingFile={playingFile}
            onInspectText={handleInspect}
            availableFiles={availableFilenames}
          />
        )}
        {currentTab === "fail" && (
          <EditPage
            data={incorrect}
            onSaveCorrection={handleCorrection}
            onDownload={downloadTSV}
            playAudio={playAudio}
            playingFile={playingFile}
            availableFiles={availableFilenames}
            onInspectText={handleInspect}
            edits={tempEdits}
            setEdits={setTempEdits}
          />
        )}
        {currentTab === "dashboard" && (
  <DashboardPage apiBase={API_BASE} />
)}
      </main>
    </div>
  );
};
export default App;
