import React, { useState, useRef, useEffect } from 'react';
import { GripHorizontal, ChevronDown, ChevronUp, X } from 'lucide-react';

interface DraggablePanelProps {
  id: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
  initialPos: { x: number; y: number };
  width?: string;
  className?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  onClose?: () => void;
  allowMinimize?: boolean;
}

export const DraggablePanel: React.FC<DraggablePanelProps> = ({
  title,
  icon,
  initialPos,
  width = 'w-80',
  className = '',
  headerExtra,
  children,
  onClose,
  allowMinimize = true,
}) => {
  // Clamp initial position within window
  const getClampedPos = (x: number, y: number) => {
    const maxX = Math.max(20, window.innerWidth - 320);
    const maxY = Math.max(60, window.innerHeight - 80);
    return {
      x: Math.max(10, Math.min(x, maxX)),
      y: Math.max(60, Math.min(y, maxY)),
    };
  };

  const [pos, setPos] = useState(() => getClampedPos(initialPos.x, initialPos.y));
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [zIndex, setZIndex] = useState(30);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag from header, ignore buttons/inputs inside header
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) {
      return;
    }

    setZIndex(45);
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    const newX = dragStartRef.current.startX + deltaX;
    const newY = dragStartRef.current.startY + deltaY;

    const panelWidth = panelRef.current?.offsetWidth || 300;
    const maxX = Math.max(10, window.innerWidth - panelWidth - 10);
    const maxY = Math.max(60, window.innerHeight - 60);

    setPos({
      x: Math.max(10, Math.min(newX, maxX)),
      y: Math.max(56, Math.min(newY, maxY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if already released
      }
    }
  };

  const bringToFront = () => {
    setZIndex(40);
  };

  return (
    <div
      ref={panelRef}
      onPointerDown={bringToFront}
      style={{
        position: 'absolute',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex,
      }}
      className={`${width} bg-slate-950/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl text-slate-100 flex flex-col select-none transition-shadow ${
        isDragging ? 'shadow-sky-500/10 ring-1 ring-sky-500/40' : ''
      } ${className}`}
      dir="ltr"
    >
      {/* Draggable Header Handle */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex items-center justify-between p-3.5 border-b border-slate-800/70 cursor-grab active:cursor-grabbing hover:bg-slate-900/50 rounded-t-2xl transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
          <GripHorizontal className="w-4 h-4 text-slate-500 hover:text-slate-300 transition-colors shrink-0" />
          {icon && <span className="shrink-0">{icon}</span>}
          <div className="truncate font-semibold text-xs tracking-wide text-slate-100">
            {title}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {headerExtra}

          {allowMinimize && (
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title={isMinimized ? 'بزرگ‌نمایی' : 'کوچک‌نمایی'}
            >
              {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
              title="بستن"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Panel Content (Collapsible) */}
      {!isMinimized && (
        <div className="p-4 flex-1 overflow-y-auto max-h-[calc(100vh-140px)]">
          {children}
        </div>
      )}
    </div>
  );
};
