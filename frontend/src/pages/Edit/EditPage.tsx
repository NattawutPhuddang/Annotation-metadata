import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Download,
  Filter,
  Save,
  RotateCcw,
  FileX,
  Play,
  Pause,
  Search,
  FileText,
  Trash2,
  BookOpen,
  ChevronsRight,
  Info,
  FastForward,
  Zap,
  Layers,
  Loader2,
} from "lucide-react";
import { useAnnotation } from "../../context/AnnotationContext";
import { AudioItem } from "../../types";
import { Pagination } from "../../components/Shared/Pagination";
import { WaveformPlayer } from "../../components/AudioPlayer/WaveformPlayer";
import { TokenizedText } from "../../components/Tokenizer/TokenizedText";
import { audioService } from "../../api/audioService";
import "./EditPage.css";

const ITEMS_PER_PAGE = 10;

// ✅ Component ใหม่: Textarea ที่ยืดหดตามข้อความอัตโนมัติ (ใส่ไว้ในไฟล์นี้ได้เลย)
const AutoResizeTextarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
> = (props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ปรับขนาดเมื่อค่า (value) เปลี่ยน หรือเมื่อโหลดครั้งแรก
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [props.value]);

  return (
    <textarea
      ref={textareaRef}
      {...props}
      rows={1}
      style={{ overflow: "hidden", ...props.style }} // ซ่อน Scrollbar
    />
  );
};

const EditPage: React.FC = () => {
  const {
    incorrectData,
    handleCorrection,
    playAudio,
    playingFile,
    audioFiles,
    employeeId,
    tokenCache,
    inspectText,
    suggestions,
  } = useAnnotation();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLocalOnly, setShowLocalOnly] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(true);

  // ✅ 1. โหลดข้อมูลที่พิมพ์ค้างไว้จาก LocalStorage (กันข้อมูลหาย)
  const [edits, setEdits] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("edit_drafts");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // ✅ 2. โหลดข้อมูล Smart Edits (Token chips) ที่เลือกค้างไว้
  const [smartEditsMap, setSmartEditsMap] = useState<
    Record<string, Record<number, string>>
  >(() => {
    try {
      const saved = localStorage.getItem("edit_smart_drafts");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // --- Automation States ---
  const [autoPlay, setAutoPlay] = useState(() =>
    JSON.parse(localStorage.getItem("edit_autoPlay") || "false"),
  );
  const [autoTokenize, setAutoTokenize] = useState(() =>
    JSON.parse(localStorage.getItem("edit_autoTokenize") || "false"),
  );

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchTokens, setBatchTokens] = useState<Record<string, string[]>>({});
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  const lastAutoPlayedRef = useRef<string | null>(null);

  // ✅ 3. บันทึกข้อมูลลง LocalStorage ทุกครั้งที่มีการแก้ไข
  useEffect(() => {
    localStorage.setItem("edit_drafts", JSON.stringify(edits));
  }, [edits]);

  useEffect(() => {
    localStorage.setItem("edit_smart_drafts", JSON.stringify(smartEditsMap));
  }, [smartEditsMap]);

  // Persistence Effects (Settings)
  useEffect(() => {
    localStorage.setItem("edit_autoPlay", JSON.stringify(autoPlay));
  }, [autoPlay]);
  useEffect(() => {
    localStorage.setItem("edit_autoTokenize", JSON.stringify(autoTokenize));
  }, [autoTokenize]);

  // Reset Batch Mode
  useEffect(() => {
    setIsBatchMode(false);
  }, [page]);

  // Map Local Files
  const fileMap = useMemo(() => {
    const m = new Map<string, string>();
    audioFiles.forEach((f) => {
      if (f.audioPath) m.set(f.filename, f.audioPath);
    });
    return m;
  }, [audioFiles]);

  // Logic กรองข้อมูล
  const filteredItems = useMemo(() => {
    let data = incorrectData;
    if (showLocalOnly) {
      data = data.filter((item) => fileMap.has(item.filename));
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(
        (item) =>
          item.filename.toLowerCase().includes(lower) ||
          item.text.toLowerCase().includes(lower),
      );
    }
    return data;
  }, [incorrectData, searchTerm, showLocalOnly, fileMap]);

  // Pagination
  const items = filteredItems.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const firstItem = items[0];

  // --- Automation Logic ---
  useEffect(() => {
    if (!firstItem) return;
    const isNewFile = firstItem.filename !== lastAutoPlayedRef.current;
    if (isNewFile) {
      lastAutoPlayedRef.current = firstItem.filename;
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
  const toggleBatchMode = async () => {
    if (isBatchMode) {
      setIsBatchMode(false);
    } else {
      if (items.length === 0) return;
      setIsBatchLoading(true);
      try {
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
        setIsBatchMode(true);
      } catch (error) {
        console.error("Batch tokenize failed", error);
      } finally {
        setIsBatchLoading(false);
      }
    }
  };

  const shouldExpand = (idx: number) => {
    if (isBatchMode) return true;
    if (autoTokenize && idx === 0) return true;
    return false;
  };

  // ✅ Key Handler: ปุ่ม Enter = Save
  const handleKey = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    item: AudioItem,
    val: string,
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCorrection(item, val);

      // ล้างข้อมูลใน State และ LocalStorage อัตโนมัติ (ผ่าน useEffect)
      setEdits((prev) => {
        const c = { ...prev };
        delete c[item.filename];
        return c;
      });
      setSmartEditsMap((prev) => {
        const c = { ...prev };
        delete c[item.filename];
        return c;
      });
      return;
    }

    if (e.key === "F2" || (e.ctrlKey && e.key === "b")) {
      e.preventDefault();
      const input = e.currentTarget;
      const s = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const sel = val.substring(s, end);

      if (sel) {
        const newVal = val.substring(0, s) + `(${sel},)` + val.substring(end);
        setEdits((prev) => ({ ...prev, [item.filename]: newVal }));
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(s + sel.length + 2, s + sel.length + 2);
        }, 0);
      }
    }

    if (e.code === "Slash" && e.ctrlKey) setIsGuideOpen((prev) => !prev);
  };

  const handleSmartCorrection = (
    item: AudioItem,
    idx: number,
    newWord: string | null,
  ) => {
    const currentFileEdits = { ...(smartEditsMap[item.filename] || {}) };
    if (newWord === null) delete currentFileEdits[idx];
    else currentFileEdits[idx] = newWord;

    setSmartEditsMap((prev) => ({
      ...prev,
      [item.filename]: currentFileEdits,
    }));

    const tokens = tokenCache.get(item.text) || batchTokens[item.filename];
    if (tokens) {
      const newText = tokens.map((t, i) => currentFileEdits[i] || t).join("");
      setEdits((prev) => ({ ...prev, [item.filename]: newText }));
    }
  };

  const handleDownload = (data: AudioItem[], filename: string) => {
    const content =
      "filename\ttext\n" +
      data.map((i) => `${i.filename}\t${i.text}`).join("\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleDownloadPersonal = async () => {
    const filename = `${employeeId}-Correct.tsv`;
    try {
      const data = await audioService.loadTSV(filename);
      if (!data || data.length === 0) {
        alert("Personal log not found or empty.");
        return;
      }
      const content =
        "filename\ttext\n" +
        data.map((i) => `${i.filename}\t${i.text}`).join("\n");
      const blob = new Blob([content], { type: "text/tab-separated-values" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    } catch {
      alert("Error downloading log");
    }
  };

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    try {
      await audioService.deleteTsvEntry("fail.tsv", filename);

      // ลบข้อมูลที่ค้างใน LocalStorage ด้วยถ้ามี
      setEdits((prev) => {
        const c = { ...prev };
        delete c[filename];
        return c;
      });
      setSmartEditsMap((prev) => {
        const c = { ...prev };
        delete c[filename];
        return c;
      });

      window.location.reload();
    } catch (e) {
      alert("Delete failed");
    }
  };

  return (
    <div className="edit-container animate-fade-in">
      {/* --- Header & Toolbar --- */}
      <div className="edit-header-wrapper">
        <div className="edit-header">
          <div className="header-left">
            <div className="header-title-row">
              <div className="header-title">
                <h2>Needs Correction</h2>
                <span className="badge-count">{filteredItems.length}</span>
              </div>
              <div className="filter-group">
                <button
                  onClick={() => {
                    setShowLocalOnly(true);
                    setPage(1);
                  }}
                  className={`btn-filter ${showLocalOnly ? "active" : ""}`}
                >
                  <Filter size={14} /> Local Audio
                </button>
                <button
                  onClick={() => {
                    setShowLocalOnly(false);
                    setPage(1);
                  }}
                  className={`btn-filter ${!showLocalOnly ? "active" : ""}`}
                >
                  Show All History
                </button>
              </div>
            </div>

            <div className="search-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search filename or transcript..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="header-actions">
            <button onClick={handleDownloadPersonal} className="btn-download">
              <FileText size={16} /> Export My Log
            </button>
            <button
              onClick={() => handleDownload(incorrectData, "fail.tsv")}
              className="btn-download"
            >
              <Download size={16} /> Export All Data
            </button>
          </div>
        </div>

        <div className="anno-toolbar">
          <div className="toolbar-left">
            <h2 className="toolbar-title">Workstation</h2>
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
                />{" "}
                Auto Play
              </span>
            </label>
            <label className="toggle-switch-wrapper">
              <input
                type="checkbox"
                checked={autoTokenize}
                onChange={(e) => setAutoTokenize(e.target.checked)}
                disabled={isBatchMode}
              />
              <span
                className={`toggle-slider ${isBatchMode ? "disabled" : ""}`}
              ></span>
              <span
                className={`toggle-label ${isBatchMode ? "opacity-50" : ""}`}
              >
                <Zap
                  size={14}
                  className={
                    autoTokenize && !isBatchMode ? "text-orange-500" : ""
                  }
                />{" "}
                Auto Cut
              </span>
            </label>
          </div>
          <div className="toolbar-right">
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
      </div>

      <div className="edit-layout">
        <div className="main-panel">
          <div className="minimal-card mb-8">
            <table className="custom-table w-full">
              <thead>
                <tr>
                  <th className="w-[35%]">Audio</th>
                  <th className="w-auto">Correction</th>
                  <th className="w-[100px] text-center">Save</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item, idx) => {
                    const val = edits[item.filename] ?? item.text;
                    const isModified = val !== item.text;
                    const isPlaying = playingFile === item.filename;
                    const tokens =
                      tokenCache.get(item.text) || batchTokens[item.filename];
                    const fileSmartEdits = smartEditsMap[item.filename] || {};
                    const isExpanded = shouldExpand(idx);

                    let src = item.audioPath;
                    if (!src) src = fileMap.get(item.filename);
                    if (
                      src &&
                      !src.startsWith("blob:") &&
                      !src.startsWith("http")
                    )
                      src = audioService.getAudioUrl(src);
                    const hasAudio = src && src !== "";

                    return (
                      <tr key={item.filename}>
                        <td className="align-top">
                          <div className="audio-cell-content">
                            <div
                              className="filename-badge"
                              title={item.filename}
                            >
                              {item.filename}
                            </div>
                            {hasAudio ? (
                              <div className="player-row">
                                <button
                                  onClick={() =>
                                    playAudio({ ...item, audioPath: src })
                                  }
                                  className={`btn-play-small ${isPlaying ? "playing" : ""}`}
                                >
                                  {isPlaying ? (
                                    <Pause size={14} fill="currentColor" />
                                  ) : (
                                    <Play
                                      size={14}
                                      fill="currentColor"
                                      className="ml-0.5"
                                    />
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <WaveformPlayer
                                    audioUrl={src || ""}
                                    isPlaying={isPlaying}
                                    onPlayChange={(p) =>
                                      !p && isPlaying && playAudio(item)
                                    }
                                    progressColor="#f43f5e"
                                    height="h-1"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="no-audio-box">
                                <FileX size={14} /> <span>ไม่มีไฟล์เสียง</span>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="align-top">
                          <div className="edit-wrapper relative">
                            {/* ✅ ใช้ AutoResizeTextarea แทน textarea ปกติ */}
                            <AutoResizeTextarea
                              className="edit-textarea auto-expand"
                              value={val}
                              onChange={(e) => {
                                setEdits((prev) => ({
                                  ...prev,
                                  [item.filename]: e.target.value,
                                }));
                              }}
                              onKeyDown={(e) => handleKey(e, item, val)}
                              placeholder="Type correction here..."
                              spellCheck={false}
                            />

                            <button
                              className={`btn-reset-outside ${isModified ? "visible" : ""}`}
                              onClick={() => {
                                setEdits((prev) => {
                                  const c = { ...prev };
                                  delete c[item.filename];
                                  return c;
                                });
                                setSmartEditsMap((prev) => {
                                  const c = { ...prev };
                                  delete c[item.filename];
                                  return c;
                                });
                              }}
                              title="Reset to original"
                            >
                              <RotateCcw size={14} />
                            </button>

                            <div className="mt-3 pl-1 border-t border-slate-100 pt-2">
                              <TokenizedText
                                text={item.text}
                                onInspect={inspectText}
                                tokens={tokens}
                                isExpanded={isExpanded}
                                suggestions={suggestions}
                                appliedEdits={fileSmartEdits}
                                onApplyCorrection={(i, word) =>
                                  handleSmartCorrection(item, i, word)
                                }
                              />
                            </div>
                          </div>
                        </td>

                        <td className="align-middle text-center relative">
                          <button
                            className="btn-trash-float"
                            title="Delete Item"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.filename);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              handleCorrection(item, val);
                              setEdits((prev) => {
                                const c = { ...prev };
                                delete c[item.filename];
                                return c;
                              });
                              setSmartEditsMap((prev) => {
                                const c = { ...prev };
                                delete c[item.filename];
                                return c;
                              });
                            }}
                            className="btn-save"
                            title="Save Correction"
                            disabled={!isModified && !hasAudio}
                          >
                            <Save size={20} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="text-center py-12 text-slate-400"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Filter size={24} className="opacity-20" />
                        <span>No items needing correction found.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-center">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>

        {/* --- Guideline Panel --- */}
        <aside
          className={`guideline-panel ${!isGuideOpen ? "collapsed" : ""}`}
          onClick={() => !isGuideOpen && setIsGuideOpen(true)}
        >
          <div className="guide-header">
            <h3>
              <BookOpen size={18} className="text-primary" /> Guidelines
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
            <Info size={16} /> GUIDELINES
          </div>
          <div className="guide-content">
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
            <div className="guide-item">
              <div
                className="guide-icon"
                style={{ background: "#f97316" }}
              ></div>
              <div>
                Format <span className="highlight">(ผิด,ถูก)</span>{" "}
                <div className="text-slate-400 text-xs">
                  กด <b>F2</b> เพื่อสร้าง Pattern
                </div>
              </div>
            </div>
            <div className="shortcut-grid">
              <div className="shortcut-item">
                <span className="flex items-center gap-2 text-orange-600">
                  Format
                </span>
                <span className="key-badge">F2</span>
              </div>
              <div className="shortcut-item">
                <span className="flex items-center gap-2 text-primary">
                  Save
                </span>
                <span className="key-badge">Enter</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default EditPage;
