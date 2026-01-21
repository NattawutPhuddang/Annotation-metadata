import React, { useEffect, useState } from "react";

interface CatAvatarProps {
  mood: "happy" | "sad" | "neutral" | "sleeping" | "excited";
  costume?: string;
  isWalking: boolean;
  onClick?: () => void;
}

export const CatAvatar: React.FC<CatAvatarProps> = ({ mood, costume, isWalking, onClick }) => {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 200);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const catColor = "#fb923c";
  const bellyColor = "#ffedd5";

  return (
    // 🟢 แก้ไข: ใช้ style กำหนดขนาดตายตัว (60px) ป้องกันการขยายเต็มจอ
    <div 
      onClick={onClick}
      style={{ width: '60px', height: '60px' }} // <-- บังคับขนาดตรงนี้เลย
      className={`
        relative cursor-pointer transition-transform duration-200 
        hover:scale-110 active:scale-95 
        ${isWalking ? "animate-bounce-walk" : ""}
      `}
      title="Pet me!"
    >
      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
        {/* หาง */}
        <g className="origin-bottom-left animate-tail-wag">
          <path d="M140 150 Q 180 120 160 80 Q 150 60 170 70" fill="none" stroke={catColor} strokeWidth="15" strokeLinecap="round" />
        </g>

        {/* ตัว */}
        <ellipse cx="100" cy="140" rx="60" ry="45" fill={catColor} />
        <ellipse cx="100" cy="145" rx="35" ry="25" fill={bellyColor} />

        {/* เท้า */}
        <circle cx="70" cy="180" r="12" fill={catColor} />
        <circle cx="130" cy="180" r="12" fill={catColor} />
        
        {/* หัว */}
        <g className="origin-center">
            <path d="M60 70 L 40 30 L 90 50 Z" fill={catColor} />
            <path d="M140 70 L 160 30 L 110 50 Z" fill={catColor} />
            <circle cx="100" cy="90" r="55" fill={catColor} />
            
            {/* หน้าตา */}
            {mood === "sleeping" ? (
                <>
                    <path d="M75 90 Q 85 95 95 90" fill="none" stroke="#333" strokeWidth="4" />
                    <path d="M105 90 Q 115 95 125 90" fill="none" stroke="#333" strokeWidth="4" />
                </>
            ) : mood === "excited" ? (
                <>
                     <path d="M75 85 L 85 95 L 75 105" fill="none" stroke="#333" strokeWidth="4" />
                     <path d="M125 85 L 115 95 L 125 105" fill="none" stroke="#333" strokeWidth="4" />
                </>
            ) : blink ? (
                <>
                    <line x1="75" y1="90" x2="95" y2="90" stroke="#333" strokeWidth="4" />
                    <line x1="105" y1="90" x2="125" y2="90" stroke="#333" strokeWidth="4" />
                </>
            ) : mood === "sad" ? (
                 <>
                    <circle cx="85" cy="90" r="6" fill="#333" />
                    <circle cx="115" cy="90" r="6" fill="#333" />
                    <path d="M75 80 L 95 75" stroke="#333" strokeWidth="3" />
                    <path d="M125 80 L 105 75" stroke="#333" strokeWidth="3" />
                </>
            ) : (
                <>
                    <circle cx="85" cy="90" r={6} fill="#333" />
                    <circle cx="115" cy="90" r={6} fill="#333" />
                    <circle cx="87" cy="88" r="2" fill="white" />
                    <circle cx="117" cy="88" r="2" fill="white" />
                </>
            )}

            <path d="M95 105 L 105 105 L 100 110 Z" fill="pink" />
            <path d="M100 110 Q 90 120 80 110" fill="none" stroke="#333" strokeWidth="3" />
            <path d="M100 110 Q 110 120 120 110" fill="none" stroke="#333" strokeWidth="3" />
            
            <circle cx="70" cy="105" r="10" fill="#fca5a5" opacity="0.6" />
            <circle cx="130" cy="105" r="10" fill="#fca5a5" opacity="0.6" />
        </g>
      </svg>
      
      {/* Costume */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -mt-3 text-2xl drop-shadow-md pointer-events-none select-none">
        {costume}
      </div>
    </div>
  );
};