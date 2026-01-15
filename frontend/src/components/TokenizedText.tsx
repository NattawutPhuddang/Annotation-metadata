import React, { useState } from 'react';
import { Scissors, Loader2, ChevronUp, Box } from 'lucide-react';

interface TokenizedTextProps {
  text: string;
  onInspect: (text: string) => Promise<string[]>;
}

export const TokenizedText: React.FC<TokenizedTextProps> = ({ text, onInspect }) => {
  const [tokens, setTokens] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleClick = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (tokens) return;

    setLoading(true);
    const result = await onInspect(text);
    setTokens(result);
    setLoading(false);
  };

  return (
    <div className="w-full mb-2">
      {/* ส่วนข้อความหลัก */}
      <div 
        onClick={handleClick}
        className={`
          cursor-pointer transition-all duration-300 rounded-2xl p-4 border select-none
          flex items-center justify-between group relative overflow-hidden
          ${expanded 
            ? 'bg-sky-50 border-sky-200 shadow-sm' 
            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
          }
        `}
      >
        <span className={`text-lg leading-relaxed z-10 ${expanded ? 'font-semibold text-sky-700' : 'font-medium text-slate-700'}`}>
          {text}
        </span>
        
        <div className={`
          flex items-center justify-center w-10 h-10 rounded-xl transition-all z-10 ml-4
          ${expanded ? 'bg-sky-100 text-sky-600 rotate-180' : 'bg-slate-100 text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-500'}
        `}>
          {expanded ? <ChevronUp size={20} /> : <Scissors size={20} />}
        </div>

        {expanded && <div className="absolute top-0 left-0 w-1 h-full bg-sky-400"></div>}
      </div>

      {/* ส่วนแสดงการ์ด (ใช้ CSS Class ใหม่) */}
      {expanded && (
        <div className="mt-2 animate-fade-in">
          {loading ? (
            <div className="flex items-center justify-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="flex items-center gap-2 text-sky-500">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">กำลังตัดคำ...</span>
              </div>
            </div>
          ) : (
            <div className="token-grid">
              {tokens && tokens.length > 0 ? (
                tokens.map((token, idx) => (
                  <div key={idx} className="token-card">
                    <span className="token-text">{token}</span>
                    <span className="token-badge">{idx + 1}</span>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center w-full py-4 text-slate-400">
                  <Box size={24} className="mb-2 opacity-50"/>
                  <span className="text-sm">ไม่พบผลลัพธ์</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};