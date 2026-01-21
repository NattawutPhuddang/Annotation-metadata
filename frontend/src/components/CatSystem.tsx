import React, { useState, useEffect, useRef } from "react";
import { Fish, Bath, Gamepad2, X, Store, Heart, ShoppingBag } from "lucide-react";
import { CatAvatar } from "./CatAvatar";

export interface CatState {
  coins: number;
  hunger: number;
  clean: number;
  joy: number;
  costume: string;
}

interface Props {
  catState: CatState;
  setCatState: React.Dispatch<React.SetStateAction<CatState>>;
}

export const CatSystem: React.FC<Props> = ({ catState, setCatState }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // --- Physics & Position States ---
  const [catPos, setCatPos] = useState(10); // X Position (%)
  const [catLift, setCatLift] = useState(0); // Y Position (px from bottom)
  const [direction, setDirection] = useState(1); // 1 = หันขวา, -1 = หันซ้าย
  
  // --- Action States ---
  const [isDragging, setIsDragging] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [isPetting, setIsPetting] = useState(false);
  
  // --- Visuals ---
  const [floatText, setFloatText] = useState<{id: string, text: string, x: number, y: number, color?: string}[]>([]);
  
  // Refs
  const nextDecisionTime = useRef(0);
  const dragStartPos = useRef({ x: 0, y: 0 }); // เก็บตำแหน่งเริ่มลาก
  const shopRef = useRef<HTMLDivElement>(null);
  const BOWL_POS = 90; // ย้ายจานข้าวไปขวาสุด (90%)

  const getMood = () => {
    if (isDragging) return "excited";
    if (isPetting) return "excited";
    if (catState.hunger < 30) return "sad";
    if (catState.clean < 30) return "sad";
    if (catState.joy > 80 && catState.hunger > 70) return "happy";
    return "neutral";
  };

  // -------------------------------------------------------------------
  // 🟢 1. ระบบ Drag & Drop (แก้ไขให้ลากติดมือแน่นอน)
  // -------------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent) => {
    // ป้องกันการกดทะลุไปโดนปุ่มอื่น
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // เริ่มโหมดลาก
    setIsDragging(true);
    setIsWalking(false);
    setIsPetting(true);
    
    // Lock Pointer ไว้กับตัวแมว (ลากเมาส์หลุดออกนอกจอก็ยังติดอยู่)
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    // คำนวณ X (%) เต็มจอ 0-100%
    const newPosPercent = (e.clientX / window.innerWidth) * 100;
    // Clamp ให้แมวอยู่ระหว่าง 0-100% (เดินได้สุดขอบ)
    setCatPos(Math.min(100, Math.max(0, newPosPercent)));

    // คำนวณ Y (px จากพื้น)
    // 50 คือระยะชดเชยเพื่อให้เมาส์อยู่กลางตัวแมว
    const newLift = Math.max(0, window.innerHeight - e.clientY - 50);
    setCatLift(newLift);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    setIsDragging(false);
    setIsPetting(false);
    setCatLift(0); // ปล่อยให้ร่วง (Gravity Effect จะทำงานด้วย CSS transition)
    
    // ปลด Lock Pointer
    (e.target as Element).releasePointerCapture(e.pointerId);

    // เช็คว่าหย่อนใส่จานข้าวไหม
    if (catState.hunger < 50 && Math.abs(catPos - BOWL_POS) < 5) {
         showFloatText("Yummy!", "text-green-500");
         setCatState(prev => ({ ...prev, hunger: Math.min(100, prev.hunger + 20) }));
    }
    
    // ตั้งเวลาให้ตัดสินใจทำอะไรต่อหลังจากวางลงพื้น
    nextDecisionTime.current = Date.now() + 1000;
  };

  // -------------------------------------------------------------------
  // 🟢 2. AI Brain & Walking Logic (เดินทั่วจอ)
  // -------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      // ถ้ากำลังยุ่ง (ลาก/ลูบ) ให้หยุดคิด
      if (isDragging || isPetting) return;

      const now = Date.now();

      // --- Mode 1: หิวจัด (Hungry) -> เดินมุ่งหน้าไปหาจานข้าว
      if (catState.hunger < 30) {
          const distance = BOWL_POS - catPos;
          if (Math.abs(distance) < 1) { // ถึงแล้ว
              setIsWalking(false);
              setDirection(1); // หันหน้าหาจาน
          } else { // ยังไม่ถึง
              setIsWalking(true);
              const dir = distance > 0 ? 1 : -1;
              setDirection(dir);
              setCatPos(prev => prev + 0.3 * dir); // เดินเร็วหน่อย
          }
          return;
      }

      // --- Mode 2: เดินเล่น (Normal Life)
      // ถึงเวลาเปลี่ยน Action หรือยัง?
      if (now > nextDecisionTime.current) {
          const choice = Math.random();
          
          if (choice < 0.3) {
              // 30% ยืนเฉยๆ (Idle)
              setIsWalking(false);
              nextDecisionTime.current = now + 2000 + Math.random() * 3000;
          } else {
              // 70% เดินเล่น
              setIsWalking(true);
              // สุ่มทิศทางใหม่
              const newDir = Math.random() > 0.5 ? 1 : -1;
              setDirection(newDir);
              // เดินนานแค่ไหน
              nextDecisionTime.current = now + 3000 + Math.random() * 4000;
          }
      }

      // ถ้าอยู่ในโหมดเดิน ให้ขยับ
      if (isWalking) {
          setCatPos(prev => {
              const next = prev + 0.15 * direction;
              
              // 🟢 แก้ไข: เดินได้สุดขอบจอ 0 - 100
              if (next > 100) { 
                  setDirection(-1); // ชนขอบขวา หันซ้าย
                  nextDecisionTime.current = now + 4000; 
                  return 100;
              }
              if (next < 0) { 
                  setDirection(1); // ชนขอบซ้าย หันขวา
                  nextDecisionTime.current = now + 4000;
                  return 0; 
              }
              return next;
          });
      }
    }, 50); // Update 20 FPS

    return () => clearInterval(interval);
  }, [isDragging, isPetting, catState.hunger, catPos, direction, isWalking]);

  // Stat Decay Loop (หิว/สกปรกตามเวลา)
  useEffect(() => {
    const timer = setInterval(() => {
        setCatState(prev => ({
            ...prev,
            hunger: Math.max(0, prev.hunger - 0.5),
            clean: Math.max(0, prev.clean - 0.3),
            joy: Math.max(0, prev.joy - 0.4),
        }));
    }, 5000);
    return () => clearInterval(timer);
  }, [setCatState]);

  // Floating Text Helper
  const showFloatText = (text: string, color: string = "text-orange-500") => {
      const id = `${Date.now()}-${Math.random()}`;
      setFloatText(prev => [...prev, { id, text, x: Math.random() * 50 + 25, y: 50, color }]);
      setTimeout(() => { setFloatText(prev => prev.filter(i => i.id !== id)); }, 2000);
  };

  // Petting Handler
  const handlePetClick = (e: React.MouseEvent) => {
      if (isDragging) return;
      e.stopPropagation();
      
      setIsPetting(true);
      setCatState(prev => ({ ...prev, joy: Math.min(100, prev.joy + 5) }));
      showFloatText("❤️", "text-red-500");
      setIsWalking(false);
      
      nextDecisionTime.current = Date.now() + 1500;
      setTimeout(() => setIsPetting(false), 1000);
  };

  const buyItem = (cost: number, type: string, value: any, label: string) => {
    if (catState.coins < cost) {
        alert("Meow! Not enough coins 😿");
        return;
    }
    setCatState(prev => {
        const next = { ...prev, coins: prev.coins - cost };
        if (type === 'food') next.hunger = Math.min(100, next.hunger + value);
        if (type === 'bath') next.clean = Math.min(100, next.clean + value);
        if (type === 'toy') next.joy = Math.min(100, next.joy + value);
        if (type === 'costume') next.costume = value;
        return next;
    });
    showFloatText(label);
  };

  return (
    <>
      {/* 🟢 Scene Zone: ครอบคลุมทั้งหน้าจอ และปิด Google Translate */}
      <div 
        className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden notranslate" 
        translate="no"
      >
        {/* จานข้าว (วางขวาสุด) */}
        <div 
            className="absolute bottom-2 text-4xl drop-shadow-sm transition-opacity duration-500"
            style={{ left: `${BOWL_POS}%`, transform: 'translateX(-50%)' }}
        >
            {catState.hunger < 30 ? <div className="animate-bounce origin-bottom">🥣</div> : <div className="opacity-80 scale-90">🍲</div>}
        </div>

        {/* 🟢 ตัวน้องแมว */}
        <div
            // 🟢 เพิ่ม touch-action: none เพื่อให้ลากในมือถือได้ลื่นๆ ไม่ติด Scroll
            className={`absolute select-none pointer-events-auto ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ 
                left: `${catPos}%`, 
                bottom: `${catLift}px`,
                transform: `scaleX(${direction}) translateX(-50%)`,
                width: '60px', 
                height: '60px',
                // Physics Animation: ลาก=ลื่น(none), ปล่อย=เด้ง(cubic-bezier)
                transition: isDragging ? 'none' : 'bottom 0.5s cubic-bezier(0.5, 0.05, 1, 0.5), left 0.1s linear',
                zIndex: 10000,
                touchAction: 'none' // ⚡ สำคัญมาก: ป้องกัน Browser Scroll เวลาลาก
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={handlePetClick}
        >
            {floatText.map(ft => (
                <span key={ft.id} className={`absolute -top-10 left-1/2 text-xs font-bold animate-float-up whitespace-nowrap ${ft.color} drop-shadow-sm block`}>
                    {ft.text}
                </span>
            ))}

            <div className="w-full h-full pointer-events-none">
                <CatAvatar mood={getMood()} costume={catState.costume} isWalking={isWalking && !isDragging} />
            </div>

            {catState.hunger < 30 && !isDragging && (
                <div className="absolute -top-8 -right-8 bg-white border border-red-200 text-red-500 text-[9px] px-2 py-1 rounded-lg rounded-bl-none animate-bounce shadow-sm whitespace-nowrap z-50">
                   <span>หิวแล้วน้า.. 😿</span>
                </div>
            )}
        </div>
      </div>

      {/* --- Shop UI --- */}
      <div 
        className="fixed left-4 bottom-4 z-[9999] flex flex-col-reverse items-start gap-3 notranslate"
        translate="no"
      >
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`
                relative w-12 h-12 rounded-full shadow-lg border-2 border-white 
                flex items-center justify-center transition-all duration-300 hover:scale-110
                ${isOpen ? 'bg-orange-500 rotate-90' : 'bg-white/80 backdrop-blur-md hover:bg-orange-50'}
            `}
        >
            {isOpen ? <X className="text-white" size={24} /> : (
                <>
                    <ShoppingBag className="text-orange-400" size={20} />
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white">
                        {catState.coins}
                    </span>
                </>
            )}
        </button>

        {isOpen && (
            <div ref={shopRef} className="animate-in slide-in-from-bottom-5 duration-200 origin-bottom-left">
                <div className="bg-white/95 backdrop-blur-xl border border-white/60 shadow-2xl rounded-2xl p-4 w-[300px] max-h-[500px] overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Store size={16} className="text-orange-500"/> Cat Shop
                        </h3>
                        <div className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">
                            {catState.coins} 🟡
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                         <MiniStat label="Hunger" val={catState.hunger} color="bg-green-500" />
                         <MiniStat label="Clean" val={catState.clean} color="bg-blue-500" />
                         <MiniStat label="Joy" val={catState.joy} color="bg-pink-500" />
                    </div>
                    <div className="space-y-4">
                        <div>
                            <SectionTitle>Care & Play</SectionTitle>
                            <div className="grid grid-cols-2 gap-2">
                                <ShopBtn icon={<Fish size={14} className="text-orange-500"/>} label="Tuna" cost={20} onClick={() => buyItem(20,'food',30,'Yum!')} />
                                <ShopBtn icon={<Bath size={14} className="text-blue-500"/>} label="Bath" cost={30} onClick={() => buyItem(30,'bath',100,'Fresh!')} />
                                <ShopBtn icon={<Gamepad2 size={14} className="text-purple-500"/>} label="Play" cost={15} onClick={() => buyItem(15,'toy',20,'Fun!')} />
                                <ShopBtn icon={<Heart size={14} className="text-red-500"/>} label="Love" cost={50} onClick={() => buyItem(50,'toy',100,'Happy!')} />
                            </div>
                        </div>
                        <div>
                            <SectionTitle>Fashion (Costumes)</SectionTitle>
                            <div className="grid grid-cols-4 gap-2">
                                {['🎩','👒','👑','👓','🎀','🧣','🎧','🎒'].map(item => (
                                    <button 
                                        key={item} 
                                        onClick={() => buyItem(100,'costume',item,'Cool!')}
                                        className="flex flex-col items-center justify-center p-1 bg-slate-50 rounded-lg border border-slate-200 hover:bg-orange-50 hover:border-orange-300 transition-all active:scale-95 h-14"
                                    >
                                        <span className="text-lg leading-none mb-1">{item}</span>
                                        <span className="text-[9px] font-bold text-orange-500 bg-white px-1 rounded shadow-sm">100🟡</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </>
  );
};

// Sub-components (ส่วนแสดงผลย่อย)
const MiniStat = ({ label, val, color }: any) => (
    <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
        <div className="flex justify-between items-end mb-1">
            <span className="text-[10px] text-slate-500 font-bold">{label}</span>
            <span className="text-[9px] text-slate-400 font-mono">{Math.round(val)}%</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full ${color}`} style={{ width: `${val}%` }}></div>
        </div>
    </div>
);

const SectionTitle = ({ children }: any) => (
    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">{children}</h4>
);

const ShopBtn = ({ icon, label, cost, onClick }: any) => (
    <button onClick={onClick} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl hover:bg-orange-50 hover:border-orange-200 transition-all active:scale-95 text-left shadow-sm">
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600">{icon}</div>
        <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-slate-700 truncate">{label}</div>
            <div className="text-[10px] font-bold text-orange-500">{cost}🟡</div>
        </div>
    </button>
);