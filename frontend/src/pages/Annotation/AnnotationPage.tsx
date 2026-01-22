import React, { useState, useEffect, useRef } from "react";
import {
  Check,
  X,
  Play,
  Pause,
  Info,
  Trash2,
  ChevronsRight,
  BookOpen,
  Zap,
  Layers,
  FastForward,
  Loader2,
} from "lucide-react";
import { useAnnotation } from "../../context/AnnotationContext";
import { WaveformPlayer } from "../../components/AudioPlayer/WaveformPlayer";
import { TokenizedText } from "../../components/Tokenizer/TokenizedText";
import { Pagination } from "../../components/Shared/Pagination";
import { audioService } from "../../api/audioService";
import "./AnnotationPage.css";

const ITEMS_PER_PAGE = 10;

const AnnotationPage: React.FC = () => {
  const {
    pendingItems,
    handleDecision,
    playAudio,
    playingFile,
    inspectText,
    tokenCache,
    suggestions,
  } = useAnnotation();

  const [page, setPage] = useState(1);
  const [smartEdits, setSmartEdits] = useState<
    Record<string, Record<number, string>>
  >({});
  const [isGuideOpen, setIsGuideOpen] = useState(true);

  // --- Automation States (Load from LocalStorage) ---
  const [autoPlay, setAutoPlay] = useState(() =>
    JSON.parse(localStorage.getItem("anno_autoPlay") || "false"),
  );
  const [autoTokenize, setAutoTokenize] = useState(() =>
    JSON.parse(localStorage.getItem("anno_autoTokenize") || "false"),
  );

  // Batch Mode State (Cut All)
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchTokens, setBatchTokens] = useState<Record<string, string[]>>({});
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  // Ref ป้องกัน Auto Play ทำงานซ้ำซ้อน
  const lastAutoPlayedRef = useRef<string | null>(null);

  // Pagination
  const totalPages = Math.ceil(pendingItems.length / ITEMS_PER_PAGE);
  const items = pendingItems.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );
  const firstItem = items[0];

  // --- Persistence Effects ---
  useEffect(() => {
    localStorage.setItem("anno_autoPlay", JSON.stringify(autoPlay));
  }, [autoPlay]);
  useEffect(() => {
    localStorage.setItem("anno_autoTokenize", JSON.stringify(autoTokenize));
  }, [autoTokenize]);

  // Reset Batch Mode เมื่อเปลี่ยนหน้า (Pagination)
  useEffect(() => {
    setIsBatchMode(false);
  }, [page]);

  // --- Automation Logic ---
  useEffect(() => {
    if (!firstItem) return;

    const isNewFile = firstItem.filename !== lastAutoPlayedRef.current;

    if (isNewFile) {
      lastAutoPlayedRef.current = firstItem.filename;

      // 1. Auto Play Logic
      if (autoPlay) {
        setTimeout(() => {
          if (playingFile !== firstItem.filename) {
            playAudio(firstItem);
          }
        }, 300);
      }
    }
  }, [firstItem, autoPlay, playingFile, playAudio]);

  // --- Handlers ---

  // Toggle Cut All
  const toggleBatchMode = async () => {
    if (isBatchMode) {
      // ถ้าเปิดอยู่ -> ปิด (หุบทั้งหมด)
      setIsBatchMode(false);
    } else {
      // ถ้าปิดอยู่ -> เปิด (ขยายทั้งหมด และโหลด)
      if (items.length === 0) return;

      setIsBatchLoading(true);
      try {
        // กรองเฉพาะอันที่ยังไม่มีใน Cache เพื่อลด Load
        const itemsToFetch = items.filter(
          (i) => !tokenCache.has(i.text) && !batchTokens[i.filename],
        );

        if (itemsToFetch.length > 0) {
          const texts = itemsToFetch.map((i) => i.text);
          const results = await audioService.tokenizeBatch(texts);

          const newBatch: Record<string, string[]> = {};
          itemsToFetch.forEach((item, idx) => {
            if (results[idx]) newBatch[item.filename] = results[idx];
          });
          setBatchTokens((prev) => ({ ...prev, ...newBatch }));
        }
        setIsBatchMode(true); // เปิดโหมด Batch หลังจากโหลดเสร็จ (หรือถ้ามี cache แล้วก็เปิดเลย)
      } catch (error) {
        console.error("Batch tokenize failed", error);
      } finally {
        setIsBatchLoading(false);
      }
    }
  };

  const handleSmartCorrection = (
    filename: string,
    idx: number,
    newWord: string | null,
  ) => {
    setSmartEdits((prev) => {
      const fileEdits = { ...(prev[filename] || {}) };
      if (newWord === null) delete fileEdits[idx];
      else fileEdits[idx] = newWord;

      if (Object.keys(fileEdits).length === 0) {
        const next = { ...prev };
        delete next[filename];
        return next;
      }
      return { ...prev, [filename]: fileEdits };
    });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        !firstItem ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        playAudio(firstItem);
      }
      if (e.code === "Enter") {
        e.preventDefault();
        handleDecision(firstItem, "correct", smartEdits[firstItem.filename]);
        setSmartEdits((prev) => {
          const n = { ...prev };
          delete n[firstItem.filename];
          return n;
        });
      }
      if (e.code === "Backspace") {
        e.preventDefault();
        handleDecision(firstItem, "incorrect");
      }
      if (e.code === "Slash" && e.ctrlKey) setIsGuideOpen((prev) => !prev);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [firstItem, playAudio, handleDecision, smartEdits]);

  // Logic การขยายการ์ด
  const shouldExpand = (idx: number) => {
    // 1. ถ้ากด Cut All ไว้ (isBatchMode) -> ขยายทั้งหมด
    if (isBatchMode) return true;
    // 2. ถ้าไม่ได้กด Cut All แต่เปิด Auto Cut -> ขยายเฉพาะตัวแรก
    if (autoTokenize && idx === 0) return true;
    return false;
  };

  if (pendingItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in text-slate-400">
        <div className="w-16 h-16 bg-green-50 text-green-400 rounded-full flex items-center justify-center mb-4 shadow-sm">
          <Check size={32} />
        </div>
        <h3 className="text-xl font-semibold text-slate-600">All caught up!</h3>
        <p>No pending items to review.</p>
      </div>
    );
  }

  return (
    <div className="anno-container animate-fade-in">
      {/* --- Toolbar --- */}
      <div className="anno-toolbar">
        <div className="toolbar-left">
          <h2 className="toolbar-title">Workstation</h2>

          {/* Toggle: Auto Play */}
          <label className="toggle-switch-wrapper">
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={(e) => setAutoPlay(e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">
              <FastForward
                size={14}
                className={autoPlay ? "text-indigo-600" : ""}
              />
              Auto Play
            </span>
          </label>

          {/* Toggle: Auto Cut */}
          <label className="toggle-switch-wrapper">
            <input
              type="checkbox"
              checked={autoTokenize}
              onChange={(e) => setAutoTokenize(e.target.checked)}
              disabled={isBatchMode} // Disable ถ้า Cut All เปิดอยู่
            />
            <span
              className={`toggle-slider ${isBatchMode ? "disabled" : ""}`}
            ></span>
            <span className={`toggle-label ${isBatchMode ? "opacity-50" : ""}`}>
              <Zap
                size={14}
                className={
                  autoTokenize && !isBatchMode ? "text-orange-500" : ""
                }
              />
              Auto Cut
            </span>
          </label>
        </div>

        <div className="toolbar-right">
          {/* Toggle: Cut All (Batch) */}
          <button
            onClick={toggleBatchMode}
            disabled={isBatchLoading}
            className={`btn-batch-toggle ${isBatchMode ? "active" : ""}`}
          >
            {isBatchLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Layers size={16} />
            )}
            <span>Cut All {isBatchMode ? "(ON)" : "(OFF)"}</span>
          </button>
        </div>
      </div>

      <div className="anno-layout">
        <div className="main-panel">
          <table className="custom-table">
            <thead>
              <tr>
                <th className="w-[25%]">Audio</th>
                <th className="w-auto">Transcript</th>
                <th className="w-[140px] text-center">Decision</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const isPlaying = playingFile === item.filename;
                const fileEdits = smartEdits[item.filename] || {};
                const tokens =
                  tokenCache.get(item.text) || batchTokens[item.filename];
                const isExpanded = shouldExpand(idx);

                return (
                  <tr key={item.filename}>
                    <td>
                      <div className="audio-cell-content">
                        <div className="filename-badge" title={item.filename}>
                          {item.filename}
                        </div>
                        <button
                          onClick={() => playAudio(item)}
                          className={`btn-play-hero ${isPlaying ? "playing" : ""}`}
                        >
                          {isPlaying ? (
                            <Pause size={20} fill="currentColor" />
                          ) : (
                            <Play
                              size={20}
                              fill="currentColor"
                              className="ml-1"
                            />
                          )}
                        </button>
                        {item.audioPath && (
                          <div className="w-full px-2">
                            <WaveformPlayer
                              audioUrl={item.audioPath}
                              isPlaying={isPlaying}
                              onPlayChange={(p) =>
                                !p && isPlaying && playAudio(item)
                              }
                              progressColor="#818cf8"
                              height="h-1"
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <TokenizedText
                        text={item.text}
                        onInspect={inspectText}
                        tokens={tokens}
                        isExpanded={isExpanded}
                        suggestions={suggestions}
                        appliedEdits={fileEdits}
                        onApplyCorrection={(i, word) =>
                          handleSmartCorrection(item.filename, i, word)
                        }
                      />
                    </td>

                    <td>
                      <div className="action-wrapper">
                        <button
                          className="btn-trash-float"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            alert("Delete Logic");
                          }}
                        >
                          <Trash2 size={12} />
                        </button>

                        <div className="decision-group">
                          <button
                            onClick={() => {
                              handleDecision(item, "correct", fileEdits);
                              setSmartEdits((prev) => {
                                const n = { ...prev };
                                delete n[item.filename];
                                return n;
                              });
                            }}
                            className="btn-action correct"
                            title="Correct (Enter)"
                          >
                            <Check size={20} strokeWidth={3} />
                          </button>
                          <button
                            onClick={() => handleDecision(item, "incorrect")}
                            className="btn-action incorrect"
                            title="Incorrect (Backspace)"
                          >
                            <X size={20} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-center mt-6">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>

        {/* Right Panel */}
        <aside
          className={`guideline-panel ${!isGuideOpen ? "collapsed" : ""}`}
          onClick={() => !isGuideOpen && setIsGuideOpen(true)}
        >
          <div className="guide-header">
            <h3>
              <BookOpen size={18} className="text-primary" /> คำแนะนำ
            </h3>
            <div
              className="btn-collapse"
              onClick={(e) => {
                e.stopPropagation();
                setIsGuideOpen(!isGuideOpen);
              }}
            >
              <ChevronsRight
                size={18}
                className={`transition-transform ${!isGuideOpen ? "rotate-180" : ""}`}
              />
            </div>
          </div>
          <div className="vertical-label">
            <Info size={16} /> คำแนะนำการตรวจสอบ
          </div>
          <div className="guide-content">
            {/* Content เดิม */}
            <div className="guide-item">
              <div className="guide-icon"></div>
              <div>
                คำซ้ำใช้ <span className="highlight">ๆ</span>{" "}
                <div className="text-slate-400 text-xs">"อื่นๆ", "ไปๆ มาๆ"</div>
              </div>
            </div>
            <div className="guide-item">
              <div className="guide-icon"></div>
              <div>
                คำย่อใช้ <span className="highlight">ฯ</span>{" "}
                <div className="text-slate-400 text-xs">"จังหวัดกาญฯ"</div>
              </div>
            </div>
            <div className="guide-item">
              <div className="guide-icon"></div>
              <div>
                ตัวเลข <span className="highlight">อารบิก</span>{" "}
                <div className="text-slate-400 text-xs">"10คน", "10:30"</div>
              </div>
            </div>
            <div className="guide-item">
              <div className="guide-icon"></div>
              <div>
                เสียงซ้อน{" "}
                <span className="highlight bg-red-50 text-red-600 border-red-200">
                  ทิ้งถังขยะ
                </span>
              </div>
            </div>
            <div className="shortcut-grid">
              <div className="shortcut-item">
                <span className="flex items-center gap-2 text-slate-500">
                  <Play size={12} /> Play
                </span>
                <span className="key-badge">Space</span>
              </div>
              <div className="shortcut-item">
                <span className="flex items-center gap-2 text-green-600">
                  <Check size={12} /> Correct
                </span>
                <span className="key-badge">Enter</span>
              </div>
              <div className="shortcut-item">
                <span className="flex items-center gap-2 text-red-600">
                  <X size={12} /> Fail
                </span>
                <span className="key-badge">Back</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AnnotationPage;
