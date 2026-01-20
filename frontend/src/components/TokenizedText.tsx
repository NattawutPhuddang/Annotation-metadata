import React, { useState, useEffect } from "react";
import { Scissors, Loader2, ChevronUp, Wand2, Undo2 } from "lucide-react";

interface TokenizedTextProps {
  text: string;
  onInspect: (text: string) => Promise<string[]>;
  isExpanded?: boolean;
  tokens?: string[];
  suggestions?: Map<string, string>;

  // 🟢 เปลี่ยน: รับ appliedEdits แทนการจัดการ state เอง
  appliedEdits?: Record<number, string>;
  // 🟢 เปลี่ยน: Callback ส่ง index แทน token เดิม
  onApplyCorrection?: (index: number, corrected: string | null) => void;
}

export const TokenizedText: React.FC<TokenizedTextProps> = ({
  text,
  onInspect,
  isExpanded = false,
  tokens: preLoadedTokens,
  suggestions,
  appliedEdits = {}, // รับค่าการแก้ปัจจุบัน
  onApplyCorrection,
}) => {
  const [tokens, setTokens] = useState<string[] | null>(
    preLoadedTokens || null,
  );
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(isExpanded);

  // ลบ localEdits ออกแล้ว เพราะเราใช้ appliedEdits จาก Props

  useEffect(() => {
    if (preLoadedTokens) setTokens(preLoadedTokens);
    else {
      setTokens(null);
      if (isExpanded) loadTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, isExpanded, preLoadedTokens]);

  const loadTokens = async () => {
    if (preLoadedTokens) {
      setTokens(preLoadedTokens);
      return;
    }
    setLoading(true);
    try {
      const result = await onInspect(text);
      setTokens(result);
    } catch (e) {
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!tokens) await loadTokens();
  };

  const handleTokenClick = (idx: number, suggested: string | undefined) => {
    if (!onApplyCorrection) return;

    // เช็คจาก appliedEdits ที่ส่งมาจาก App
    const isEdited = appliedEdits[idx] !== undefined;

    if (isEdited) {
      // Undo: ส่ง null ไปบอก Parent ว่าลบการแก้นี้
      onApplyCorrection(idx, null);
    } else if (suggested) {
      // Apply: ส่งคำใหม่ไป
      onApplyCorrection(idx, suggested);
    }
  };

  return (
    <div className="w-full mb-2">
      <div
        onClick={handleClick}
        className={`cursor-pointer transition-all duration-200 rounded-2xl p-4 border select-none flex items-center justify-between group relative overflow-hidden ${expanded ? "bg-sky-50 border-sky-200 shadow-sm" : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"}`}
      >
        <span
          className={`text-lg leading-relaxed z-10 font-sans ${expanded ? "font-semibold text-sky-700" : "font-medium text-slate-700"}`}
        >
          {/* ใช้ appliedEdits มาแสดงผลแทน Text เดิม */}
          {tokens ? tokens.map((t, i) => appliedEdits[i] || t).join("") : text}
        </span>
        <div
          className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-all z-10 ml-4 ${expanded ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-500"}`}
        >
          {expanded ? <ChevronUp size={20} /> : <Scissors size={20} />}
        </div>
        {expanded && (
          <div className="absolute top-0 left-0 w-1 h-full bg-sky-400"></div>
        )}
      </div>

      {expanded && (
        <div className="mt-3 animate-fade-in pl-1">
          {loading ? (
            <div className="flex items-center justify-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-sky-500 gap-2">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">กำลังประมวลผล...</span>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                padding: "16px",
                backgroundColor: "rgba(240, 249, 255, 0.6)",
                border: "1px solid #e0f2fe",
                borderRadius: "16px",
                alignItems: "flex-start",
                flexDirection: "row",
              }}
            >
              {tokens && tokens.length > 0 ? (
                tokens.map((token, idx) => {
                  const suggestion = suggestions?.get(token);
                  const isEdited = appliedEdits[idx] !== undefined; // เช็คจาก Props
                  const displayToken = isEdited ? appliedEdits[idx] : token;

                  let cardStyle = {
                    bg: "#f0f9ff",
                    border: "#bae6fd",
                    color: "#0369a1",
                    cursor: "default",
                    shadow: "0 2px 4px rgba(0,0,0,0.02)",
                  };

                  if (isEdited) {
                    cardStyle = {
                      bg: "#dcfce7",
                      border: "#86efac",
                      color: "#15803d",
                      cursor: "pointer",
                      shadow: "0 2px 4px rgba(0,0,0,0.05)",
                    };
                  } else if (suggestion) {
                    cardStyle = {
                      bg: "#ffedd5",
                      border: "#fdba74",
                      color: "#9a3412",
                      cursor: "pointer",
                      shadow: "0 4px 6px rgba(251, 146, 60, 0.2)",
                    };
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => handleTokenClick(idx, suggestion)}
                      className="transition-transform duration-200 hover:-translate-y-1"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: "60px",
                        padding: "10px 16px",
                        backgroundColor: cardStyle.bg,
                        border: `1px solid ${cardStyle.border}`,
                        borderRadius: "12px",
                        boxShadow: cardStyle.shadow,
                        position: "relative",
                        color: cardStyle.color,
                        cursor: cardStyle.cursor,
                        userSelect: "none",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "1rem",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          zIndex: 10,
                        }}
                      >
                        {displayToken}
                      </span>

                      {suggestion && !isEdited && (
                        <div
                          style={{
                            position: "absolute",
                            top: "-10px",
                            backgroundColor: "#f97316",
                            color: "white",
                            fontSize: "16px",
                            padding: "2px 6px",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "2px",
                            boxShadow: "0 2px 2px rgba(0,0,0,0.1)",
                            whiteSpace: "nowrap",
                            zIndex: 20,
                          }}
                        >
                          {suggestion}
                        </div>
                      )}

                      {isEdited && (
                        <div
                          style={{
                            position: "absolute",
                            top: "-10px",
                            right: "-5px",
                            backgroundColor: "#efb944",
                            color: "white",
                            padding: "3px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            zIndex: 20,
                          }}
                        >
                          <Undo2 size={12} />
                        </div>
                      )}

                      <span
                        style={{
                          position: "absolute",
                          bottom: "2px",
                          right: "5px",
                          fontSize: "9px",
                          fontWeight: "bold",
                          color: "#94a3b8",
                          opacity: 0.6,
                          pointerEvents: "none",
                        }}
                      >
                        {idx + 1}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="w-full text-center text-slate-400 text-sm">
                  ไม่พบผลลัพธ์
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
