import React, { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import { useAnnotation } from "../../context/AnnotationContext";
import { AudioItem } from "../../types";
import { Pagination } from "../../components/Shared/Pagination";
import { WaveformPlayer } from "../../components/AudioPlayer/WaveformPlayer";
import { TokenizedText } from "../../components/Tokenizer/TokenizedText";
import { audioService } from "../../api/audioService";
import "./EditPage.css";

const ITEMS_PER_PAGE = 10;

const EditPage: React.FC = () => {
  const {
    incorrectData,
    handleCorrection,
    playAudio,
    playingFile,
    audioFiles,
    employeeId,
    suggestions, // ADD THIS
  } = useAnnotation();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLocalOnly, setShowLocalOnly] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [tokensMap, setTokensMap] = useState<Record<string, string[]>>({});

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

    // 1. Filter Local
    if (showLocalOnly) {
      data = data.filter((item) => fileMap.has(item.filename));
    }

    // 2. Search
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

  // Effect: โหลด Tokens
  useEffect(() => {
    const fetchTokens = async () => {
      const itemsToFetch = items.filter((i) => !tokensMap[i.filename]);
      if (itemsToFetch.length === 0) return;

      try {
        const texts = itemsToFetch.map((i) => i.text);
        const results = await audioService.tokenizeBatch(texts);
        setTokensMap((prev) => {
          const next = { ...prev };
          itemsToFetch.forEach((item, idx) => {
            next[item.filename] = results[idx] || [];
          });
          return next;
        });
      } catch (err) {
        console.error("Failed to load tokens", err);
      }
    };
    fetchTokens();
  }, [items, tokensMap]);

  // Key Handler for F2
  const handleKey = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    filename: string,
    val: string,
  ) => {
    if (e.key === "F2" || (e.ctrlKey && e.key === "b")) {
      e.preventDefault();
      const input = e.currentTarget;
      const s = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const sel = val.substring(s, end);

      if (sel) {
        const newVal = val.substring(0, s) + `(${sel},)` + val.substring(end);
        setEdits((prev) => ({ ...prev, [filename]: newVal }));
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(s + sel.length + 2, s + sel.length + 2);
        }, 0);
      }
    }
    if (e.code === "Slash" && e.ctrlKey) setIsGuideOpen((prev) => !prev);
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
    const filename = `${employeeId}-fail.tsv`;
    try {
      const data = await audioService.loadTSV(filename);
      if (!data || data.length === 0) {
        alert("Personal log not found.");
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
    if (!window.confirm(`Delete "${filename}" to trash?`)) return;
    try {
      await audioService.moveToTrash(filename, 'fail.tsv');
      // Clear edit state for this file
      setEdits(prev => { const c = { ...prev }; delete c[filename]; return c; });
    } catch (e) {
      alert("Error deleting item: " + (e instanceof Error ? e.message : 'Unknown error'));
    }
  };

  return (
    <div className="edit-container animate-fade-in">
      {/* Header Section */}
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
            <FileText size={16} /> Export My Log TSV
          </button>
          <button
            onClick={() => handleDownload(incorrectData, "fail.tsv")}
            className="btn-download"
          >
            <Download size={16} /> Export All Data
          </button>
        </div>
      </div>

      <div className="edit-layout">
        {/* --- LEFT: Table --- */}
        <div className="main-panel">
          <div className="minimal-card mb-8">
            <table className="custom-table w-full">
              <thead>
                <tr>
                  {/* กำหนดความกว้างให้ชัดเจน */}
                  <th className="w-[35%]">Audio</th>
                  <th className="w-auto">Correction</th>
                  <th className="w-[100px] text-center">Save</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item) => {
                    const val = edits[item.filename] ?? item.text;
                    const isModified = val !== item.text;
                    const isPlaying = playingFile === item.filename;
                    const itemTokens = tokensMap[item.filename] || [];

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
                        {/* Audio Column */}
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

                        {/* Edit Column */}
                        <td className="align-top">
                          <div className="edit-wrapper">
                            <textarea
                              className="edit-textarea"
                              value={val}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [item.filename]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) =>
                                handleKey(e, item.filename, val)
                              }
                              placeholder="Type correction here..."
                              spellCheck={false}
                            />
                            <button
                              className={`btn-reset ${isModified ? "visible" : ""}`}
                              onClick={() =>
                                setEdits((prev) => {
                                  const c = { ...prev };
                                  delete c[item.filename];
                                  return c;
                                })
                              }
                              title="Reset to original"
                            >
                              <RotateCcw size={14} />
                            </button>

                            {/* ✅ ย้าย TokenizedText มาไว้ด้านล่าง Textarea */}
                            <div className="mt-3 pl-1 border-t border-slate-100 pt-2">
                              <div className="text-xs text-slate-400 mb-2 font-semibold tracking-wider flex items-center gap-2">
                                <span>CURRENT TOKENS</span>
                              </div>
                              {itemTokens.length > 0 ? (
                                <TokenizedText
                                  text={item.text} // Pass the original text
                                  onInspect={audioService.tokenize} // Pass the tokenize function
                                  tokens={itemTokens}
                                  suggestions={suggestions} // ADD THIS LINE
                                />
                              ) : (
                                <div className="h-6 w-32 bg-slate-100 rounded animate-pulse"></div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Save Column */}
                        <td className="align-middle text-center relative">
                          {/* ✅ ย้าย Trash Button มาไว้ใน td เพื่อไม่ให้ Layout พัง */}
                          <button
                            className="btn-trash-float"
                            title="Delete to trash"
                            onClick={async (e) => {
                            e.stopPropagation();
                            await handleDelete(item.filename);
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

        {/* --- RIGHT: Guideline Panel --- */}
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
                  &lt;IGNORE&gt;
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
                <span className="flex items-center gap-2 text-slate-500">
                  <Play size={12} /> Play
                </span>
                <span className="key-badge">Space</span>
              </div>
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
                <span className="key-badge">Click</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default EditPage;
