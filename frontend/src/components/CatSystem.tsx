import React, { useState, useEffect } from "react";
import { Fish, Bath, Gamepad2, Shirt, X, Store, Heart, Sparkles } from "lucide-react";
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
  const [catPos, setCatPos] = useState(10);
  const [direction, setDirection] = useState(1);
  const [isWalking, setIsWalking] = useState(true);
  const [floatText, setFloatText] = useState<{id: number, text: string, x: number, y: number, color?: string}[]>([]);
  
  // 🟢 State สำหรับเอฟเฟกต์โดนลูบ
  const [isPetting, setIsPetting] = useState(false);

  const getMood = () => {
    if (isPetting) return "excited"; // อารมณ์ดีสุดๆ ตอนโดนลูบ
    if (catState.hunger < 30 || catState.clean < 30) return "sad";
    if (catState.joy > 80 && catState.hunger > 70) return "happy";
    return "neutral";
  };

  useEffect(() => {
    const interval = setInterval(() => {
      // ถ้ากำลังโดนลูบ ให้หยุดเดินแป๊บนึง
      if (isPetting) return;

      if (Math.random() > 0.8) setIsWalking(prev => !prev);
      if (isWalking) {
        setCatPos((prev) => {
          let next = prev + 0.15 * direction;
          if (next > 90) { setDirection(-1); return 90; }
          if (next < 5) { setDirection(1); return 5; }
          return next;
        });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [direction, isWalking, isPetting]);

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

  const showFloatText = (text: string, color: string = "text-orange-500") => {
      const id = Date.now();
      setFloatText(prev => [...prev, { id, text, x: Math.random() * 50 + 25, y: 50, color }]);
      setTimeout(() => {
          setFloatText(prev => prev.filter(i => i.id !== id));
      }, 2000);
  };

  // 🟢 ฟังก์ชันลูบหัวแมว
  const handlePetCat = () => {
      setIsPetting(true);
      
      // เพิ่มความสุขเล็กน้อย
      setCatState(prev => ({ ...prev, joy: Math.min(100, prev.joy + 5) }));
      
      // แสดงหัวใจ
      showFloatText("❤️ Love!", "text-red-500");
      showFloatText("Purr...", "text-slate-400");

      // หยุดเดินชั่วคราวแล้วกลับมาเดินต่อ
      setIsWalking(false);
      setTimeout(() => {
          setIsPetting(false);
          setIsWalking(true);
      }, 1000);
  };

  const buyItem = (cost: number, type: string, value: any, label: string) => {
    if (catState.coins < cost) {
        alert("เหรียญไม่พอจ้า! ไปทำงานก่อนนะ 😿");
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
      {/* 🟢 Scene: ปรับ z-index ให้คลิกได้ และ position */}
      <div 
        className="fixed bottom-0 z-50 transition-all duration-500 ease-linear pointer-events-none" // Container บังคับไม่ให้บัง UI อื่น
        style={{ 
            left: `${catPos}%`, 
            transform: `scaleX(${direction}) translateX(-50%)`,
            bottom: '10px' // ปรับให้ต่ำลงมานิดนึงเพราะตัวเล็กแล้ว
        }}
      >
         {/* Floating Text */}
         {floatText.map(ft => (
             <div key={ft.id} className={`absolute -top-16 left-1/2 text-sm font-bold animate-float-up whitespace-nowrap bg-white/90 px-2 py-1 rounded-full shadow-sm z-50 ${ft.color}`}>
                 {ft.text}
             </div>
         ))}

         {/* 🟢 ตัว Wrapper ของแมว ต้องรับ Pointer Events เพื่อให้คลิกได้ */}
         <div className="pointer-events-auto" onClick={(e) => { e.stopPropagation(); handlePetCat(); }}>
            <CatAvatar 
                mood={getMood()} 
                costume={catState.costume} 
                isWalking={isWalking}
                onClick={handlePetCat}
            />
         </div>

         {/* บอลลูนหิว */}
         {catState.hunger < 30 && (
            <div className="absolute -top-8 -right-8 bg-white border border-red-200 text-red-500 text-[10px] px-2 py-0.5 rounded-lg rounded-bl-none animate-bounce shadow-sm">
               หิวจัง..
            </div>
         )}
      </div>

      {/* --- Shop Button (เหมือนเดิม) --- */}
      <div className="fixed left-6 bottom-6 z-40 group">
        <button 
            onClick={() => setIsOpen(true)}
            className="relative w-14 h-14 bg-white/40 backdrop-blur-md border border-white/60 rounded-full shadow-lg hover:bg-orange-100/60 transition-all duration-300 hover:scale-110 flex items-center justify-center group-hover:shadow-orange-200/50"
        >
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-400 to-pink-400 opacity-20 rounded-full"></div>
            <img src="https://cdn-icons-png.flaticon.com/512/616/616430.png" alt="Cat Icon" className="w-7 h-7 opacity-80" />
            
            <span className="absolute -top-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white">
                {catState.coins}
            </span>
        </button>
      </div>

      {/* --- Shop Modal (เหมือนเดิม) --- */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
             {/* ... (Shop UI Code เดิม) ... */}
             <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-white/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-orange-100 to-pink-100 opacity-50 z-0"></div>
                <div className="relative z-10 flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Store className="text-orange-500" size={20}/> Pet Shop</h3>
                    <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors"><X size={16}/></button>
                </div>

                {/* Stats */}
                <div className="relative z-10 grid grid-cols-3 gap-2 mb-4">
                    <StatBox icon="🐟" label="Hunger" value={catState.hunger} color="bg-green-500" />
                    <StatBox icon="✨" label="Clean" value={catState.clean} color="bg-blue-500" />
                    <StatBox icon="❤️" label="Joy" value={catState.joy} color="bg-pink-500" />
                </div>

                {/* Items */}
                <div className="relative z-10 space-y-4">
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Foods & Toys</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <ShopItem icon={<Fish size={16} className="text-orange-500"/>} name="Tuna" price={20} desc="+30 Hunger" onClick={() => buyItem(20, 'food', 30, 'Yummy!')} />
                            <ShopItem icon={<Bath size={16} className="text-blue-500"/>} name="Bath" price={30} desc="+100 Clean" onClick={() => buyItem(30, 'bath', 100, 'So fresh!')} />
                            <ShopItem icon={<Gamepad2 size={16} className="text-purple-500"/>} name="Laser" price={15} desc="+20 Joy" onClick={() => buyItem(15, 'toy', 20, 'Fun!')} />
                            <ShopItem icon={<Heart size={16} className="text-red-500"/>} name="Catnip" price={50} desc="Max Joy" onClick={() => buyItem(50, 'toy', 100, 'High!')} />
                        </div>
                    </div>
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Costumes</h4>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                             {['🎩','👒','👑','👓','🎀','🧣','🎧','🎒'].map(item => (
                                <button key={item} onClick={() => buyItem(100, 'costume', item, 'So cute!')} className="flex-shrink-0 w-10 h-10 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-xl hover:bg-orange-50 hover:border-orange-300 transition-all">{item}</button>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="relative z-10 mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-500">Balance</span>
                    <span className="text-sm font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">{catState.coins} 🟡</span>
                </div>
             </div>
        </div>
      )}
    </>
  );
};

const StatBox = ({ icon, label, value, color }: any) => (
    <div className="bg-white/60 p-1.5 rounded-lg border border-slate-100 flex flex-col items-center">
        <span className="text-sm mb-1">{icon}</span>
        <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mb-0.5">
            <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${value}%` }}></div>
        </div>
        <span className="text-[8px] font-bold text-slate-400">{label}</span>
    </div>
);

const ShopItem = ({ icon, name, price, desc, onClick }: any) => (
    <button onClick={onClick} className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-xl hover:shadow-sm hover:border-orange-200 transition-all text-left group">
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:scale-105 transition-transform">{icon}</div>
        <div>
            <div className="text-xs font-bold text-slate-700">{name}</div>
            <div className="text-[10px] text-orange-500 font-bold">{price} 🟡</div>
        </div>
    </button>
);