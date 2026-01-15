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
        `}
        style={{
          backgroundColor: expanded ? '#f8fafc' : '#ffffff',
          borderColor: expanded ? '#cbd5e1' : 'transparent',
          borderWidth: '1px',
          boxShadow: expanded ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'
        }}
      >
        <span 
          className="text-lg leading-relaxed z-10 font-sans"
          style={{ 
            color: '#334155',
            fontWeight: expanded ? 600 : 500 
          }}
        >
          {text}
        </span>
        
        <div 
          className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-all z-10 ml-4"
          style={{
             backgroundColor: expanded ? '#e2e8f0' : '#f1f5f9',
             color: '#64748b',
             transform: expanded ? 'rotate(180deg)' : 'none'
          }}
        >
          {expanded ? <ChevronUp size={20} /> : <Scissors size={20} />}
        </div>
      </div>

      {/* ส่วนแสดงการ์ด (Tokens) */}
      {expanded && (
        <div className="mt-3 animate-fade-in pl-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 rounded-xl border border-dashed" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
              <div className="flex items-center gap-3" style={{ color: '#94a3b8' }}>
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-medium">กำลังตัดคำ...</span>
              </div>
            </div>
          ) : (
            <>
              {tokens && tokens.length > 0 ? (
                // Container
                <div 
                  style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '8px', 
                    flexDirection: 'row',
                    padding: '16px',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  {tokens.map((token, idx) => (
                    // Token Card
                    <div 
                      key={idx} 
                      className="relative flex flex-col items-center justify-center transition-all duration-200 cursor-default shadow-sm hover:shadow-md hover:-translate-y-0.5"
                      style={{
                        backgroundColor: '#e0f2fe', // พื้นหลังฟ้าพาสเทล
                        border: '1px solid #bae6fd',
                        borderRadius: '12px',
                        padding: '6px 14px', // ลด Padding ลงนิดหน่อย
                        paddingBottom: '10px', // เผื่อที่ด้านล่างให้ตัวเลข
                        minWidth: '50px'
                      }}
                    >
                      {/* ข้อความใน token */}
                      <span 
                        style={{ 
                          fontSize: '1rem', 
                          fontWeight: 500, 
                          color: '#334155',
                          whiteSpace: 'nowrap',
                          marginBottom: '2px'
                        }}
                      >
                        {token}
                      </span>

                      {/* เลขลำดับ (ห้อยไว้มุมขวาล่าง แบบจางๆ) */}
                      <span 
                        className="absolute bottom-0.5 right-1.5 select-none"
                        style={{
                          fontSize: '9px',      // ตัวเลขขนาดเล็ก
                          color: '#64748b',     // สีเทาจางๆ
                          opacity: 0.6,         // โปร่งแสงนิดๆ ไม่แย่งสายตา
                          fontWeight: 600,
                          lineHeight: 1
                        }}
                      >
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full py-6 text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                  <Box size={32} className="mb-2 opacity-30"/>
                  <span className="text-sm">ไม่พบคำที่ตัดได้</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};