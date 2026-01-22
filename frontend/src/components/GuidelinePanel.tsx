// frontend/src/components/GuidelinePanel.tsx
import React, { ReactNode } from "react";
import { BookOpen, ChevronsRight, Info, Play, Check, X } from "lucide-react";

interface GuidePanelProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  type?: "edit" | "annotation"; // Type เพื่อ determine layout
  children?: ReactNode;
}

export const GuidelinePanel: React.FC<GuidePanelProps> = ({
  isOpen,
  onToggle,
  title,
  subtitle,
  type = "edit",
  children,
}) => {
  // Default content สำหรับ EditPage
  const editDefaultContent = (
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
          หนึ่งสอง ใช้{" "}
          <span className="highlight">ตัวเลขอารบิก</span>{" "}
          <div className="text-slate-400 text-xs">"10คน", "10:30"</div>
          ยกเว้นชื่อเฉพาะ "คลองหนึ่ง"
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
        <div className="guide-icon"></div>
        <div>
          เปลี่ยนแปลง{" "}
          <span className="highlight bg-red-50 text-red-600 border-red-200">
            ตัวเลข เวลา
          </span>
          <div className="text-slate-400 text-xs">"10:30" → "10:30น."</div>
          <div className="text-slate-400 text-xs">"สองทุ่ม" → "20:00น."</div>
          <div className="text-slate-400 text-xs">"สองทุ่มกว่าๆ" → ไม่เปลี่ยนแปลง</div>
          <div className="text-slate-400 text-xs">"หนึ่งถึงสอง" → "1-2"</div>
          <div className="text-slate-400 text-xs">"ยี่สิบห้ายี่สิบหก" → "25,26"</div>
          <div className="text-slate-400 text-xs">"สองแสน" → "2แสน"</div>
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
            คลุมข้อความแล้วกด <b>F2</b> เพื่อสร้าง Pattern
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
  );

  // Default content สำหรับ AnnotationPage
  const annotationDefaultContent = (
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
          หนึ่งสอง ใช้ <span className="highlight">ตัวเลขอารบิก</span>{" "}
          <div className="text-slate-400 text-xs">"10คน", "10:30"</div>
          ยกเว้นชื่อเฉพาะ "คลองหนึ่ง"
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
        <div className="guide-icon"></div>
        <div>
          เปลี่ยนแปลง{" "}
          <span className="highlight bg-red-50 text-red-600 border-red-200">
            ตัวเลข เวลา
          </span>
          <div className="text-slate-400 text-xs">"10:30" → "10:30น."</div>
          <div className="text-slate-400 text-xs">"สองทุ่ม" → "20:00น."</div>
          <div className="text-slate-400 text-xs">"สองทุ่มกว่าๆ" → ไม่เปลี่ยนแปลง</div>
          <div className="text-slate-400 text-xs">"หนึ่งถึงสอง" → "1-2"</div>
          <div className="text-slate-400 text-xs">"ยี่สิบห้ายี่สิบหก" → "25,26"</div>
          <div className="text-slate-400 text-xs">"สองแสน" → "2แสน"</div>
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
          <span className="flex items-center gap-2 text-green-600">
            <Check size={12} /> Correct
          </span>
          <span className="key-badge">Enter</span>
        </div>
        <div className="shortcut-item">
          <span className="flex items-center gap-2 text-red-600">
            <X size={12} /> Fail
          </span>
          <span className="key-badge">Backspace</span>
        </div>
      </div>
    </div>
  );

  const defaultTitle = type === "annotation" ? "คำแนะนำ" : "Guidelines";
  const defaultSubtitle =
    type === "annotation" ? "คำแนะนำการตรวจสอบ" : "GUIDELINES";
  const defaultContent =
    type === "annotation" ? annotationDefaultContent : editDefaultContent;

  return (
    <aside
      className={`guideline-panel ${!isOpen ? "collapsed" : ""}`}
      onClick={() => !isOpen && onToggle(true)}
    >
      <div className="guide-header">
        <h3>
          <BookOpen size={18} className="text-primary" /> {title || defaultTitle}
        </h3>
        <div
          className="btn-collapse"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(!isOpen);
          }}
        >
          <ChevronsRight
            size={18}
            className={`transition-transform ${!isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </div>
      <div className="vertical-label">
        <Info size={16} /> {subtitle || defaultSubtitle}
      </div>
      {children || defaultContent}
    </aside>
  );
};