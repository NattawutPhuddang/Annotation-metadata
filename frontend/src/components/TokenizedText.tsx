import React, { useState, useEffect } from 'react';
import { Scissors, Loader2, ChevronUp, ChevronDown } from 'lucide-react';

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
          cursor-pointer transition-all duration-200 rounded-2xl p-4 border select-none
          flex items-center justify-between group relative overflow-hidden
          ${expanded 
            ? 'bg-sky-50 border-sky-200 shadow-sm' 
            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
          }
        `}
      >
        <span className={`text-lg leading-relaxed z-10 font-sans ${expanded ? 'font-semibold text-sky-700' : 'font-medium text-slate-700'}`}>
          {text}
        </span>
        
        <div className={`
          flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-all z-10 ml-4
          ${expanded ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-500'}
        `}>
          {expanded ? <ChevronUp size={20} /> : <Scissors size={20} />}
        </div>

        {/* แถบสีด้านซ้ายตอนเปิด */}
        {expanded && <div className="absolute top-0 left-0 w-1 h-full bg-sky-400"></div>}
      </div>

      {/* ส่วนแสดงการ์ดตัดคำ */}
      {expanded && (
        <div className="mt-3 animate-fade-in pl-1">
          {loading ? (
            <div className="flex items-center justify-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="flex items-center gap-2 text-sky-500">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">กำลังประมวลผล...</span>
              </div>
            </div>
          ) : (
            <div 
              style={{
                display: 'flex',
                flexWrap: 'wrap',    
                gap: '12px',         
                padding: '16px',
                backgroundColor: 'rgba(240, 249, 255, 0.6)', 
                border: '1px solid #e0f2fe',
                borderRadius: '16px',
                alignItems: 'flex-start', 
                flexDirection: 'row' 
              }}
            >
              {tokens && tokens.length > 0 ? (
                tokens.map((token, idx) => (
                  <div 
                    key={idx} 
                    className="group relative transition-all duration-200 cursor-default hover:-translate-y-1 hover:shadow-md"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '60px',
                      padding: '10px 16px', // เพิ่ม Padding นิดหน่อย
                      backgroundColor: '#f0f9ff', 
                      border: '1px solid #bae6fd', 
                      borderRadius: '12px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      position: 'relative' // สำคัญสำหรับการจัดตำแหน่งตัวเลข
                    }}
                  >
                    {/* ข้อความ Token */}
                    <span 
                      style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: '#0369a1', 
                        whiteSpace: 'nowrap',
                        zIndex: 10
                      }}
                    >
                      {token}
                    </span>

                    {/* เลขลำดับ (ย้ายมามุมขวาล่าง แบบ Minimal) */}
                    <span 
                      style={{
                        position: 'absolute',
                        bottom: '3px',
                        right: '6px',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        color: '#94a3b8', // สีเทาจางๆ
                        opacity: 0.6,
                        pointerEvents: 'none'
                      }}
                    >
                      {idx + 1}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center w-full py-4 text-slate-400">
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