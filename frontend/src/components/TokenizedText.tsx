import React, { useState, useEffect } from 'react';
import { Scissors, Loader2, ChevronUp, Box } from 'lucide-react';

interface TokenizedTextProps {
  text: string;
  onInspect: (text: string) => Promise<string[]>;
  isExpanded?: boolean;
}

export const TokenizedText: React.FC<TokenizedTextProps> = ({ text, onInspect, isExpanded = false }) => {
  const [tokens, setTokens] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(isExpanded);

  useEffect(() => {
    setExpanded(isExpanded);
    setTokens(null);
    if (isExpanded) {
       loadTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, isExpanded]);

  const loadTokens = async () => {
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
    if (!tokens) {
      await loadTokens();
    }
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
            ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' 
            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
          }
        `}
      >
        <span className={`text-lg leading-relaxed z-10 font-sans ${expanded ? 'font-semibold text-indigo-700' : 'font-medium text-slate-700'}`}>
          {text}
        </span>
        
        <div className={`
          flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-all z-10 ml-4
          ${expanded ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}
        `}>
          {expanded ? <ChevronUp size={20} /> : <Scissors size={20} />}
        </div>

        {/* Decorative bar */}
        {expanded && <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400"></div>}
      </div>

      {/* ส่วนแสดงการ์ด (Tokens) */}
      {expanded && (
        <div className="mt-3 animate-fade-in pl-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <div className="flex items-center gap-3 text-indigo-500">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-medium">Processing tokens...</span>
              </div>
            </div>
          ) : (
            <>
              {tokens && tokens.length > 0 ? (
                // ใช้ Inline Style บังคับ Layout ให้เป็น Flex Row แน่นอน
                <div 
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flexDirection: 'row' }}
                  className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100"
                >
                  {tokens.map((token, idx) => (
                    <div 
                      key={idx} 
                      className="
                        group relative flex flex-col items-center justify-center
                        bg-white border border-slate-200 rounded-xl px-4 py-2 
                        shadow-sm hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5
                        transition-all duration-200 cursor-default
                      "
                      // กำหนด min-width เล็กน้อยเพื่อให้การ์ดไม่หดจนเกินไป
                      style={{ minWidth: '60px' }}
                    >
                      {/* Badge เลขลำดับ */}
                      <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-slate-100 text-[10px] font-bold text-slate-400 rounded-full border border-slate-200 group-hover:bg-indigo-500 group-hover:text-white group-hover:border-indigo-500 transition-colors z-10">
                        {idx + 1}
                      </span>
                      
                      {/* ข้อความใน token */}
                      <span className="text-base font-medium text-slate-700 group-hover:text-indigo-600 whitespace-nowrap">
                        {token}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full py-6 text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                  <Box size={32} className="mb-2 opacity-30"/>
                  <span className="text-sm">No tokens found</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};