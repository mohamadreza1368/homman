import React from 'react';
import { ShieldAlert, BookOpen, CheckCircle2, Info, X } from 'lucide-react';
import { DISCLAIMER_VERSION } from '../data/disclaimerState';
import { CATALOG_METADATA, KNOWLEDGE_GRAPH_METADATA } from '../data/anatomyRegistry';

interface MedicalDisclaimerModalProps {
  isOpen: boolean;
  requiresAcceptance: boolean;
  onAccept: () => void;
  onClose?: () => void;
}

export const MedicalDisclaimerModal: React.FC<MedicalDisclaimerModalProps> = ({
  isOpen,
  requiresAcceptance,
  onAccept,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      dir="rtl"
    >
      <div className="w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 bg-amber-950/30 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 id="disclaimer-title" className="text-sm font-bold text-amber-200">
                سلب مسئولیت پزشکی و مرزبندی کاربرد آموزشی (هومان 3D)
              </h2>
              <p className="text-[11px] text-amber-400/80 font-mono">
                Educational Atlas Notice • Version {DISCLAIMER_VERSION}
              </p>
            </div>
          </div>
          {!requiresAcceptance && onClose && (
            <button
              onClick={onClose}
              aria-label="بستن"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs leading-relaxed">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30 text-amber-100 font-medium text-sm">
            «هومان 3D یک ابزار آموزشی و مرجع تصویری است. محتوای آن جایگزین نظر پزشک، تشخیص، درمان یا تصمیم‌گیری بالینی نیست.»
          </div>

          <div className="space-y-2 text-slate-300">
            <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-sky-400" />
              محدوده کاربرد مجاز و عدم کاربرد بالینی
            </h3>
            <ul className="list-disc list-inside space-y-1 text-slate-300 pr-1">
              <li>این نرم‌افزار برای مشاهده ساختارهای تشریحی، برش مقطعی، ایزوله‌سازی و مرور مفاهیم پایه طراحی شده است.</li>
              <li>برای تشخیص بیماری، تحلیل تصویر پزشکی یا پرونده بیمار، تجویز دارو، تریاژ یا تصمیم‌گیری بالینی <strong>کاربردی ندارد</strong>.</li>
              <li>هیچ داده‌ی سلامت شخصی یا شناسه‌ی کاربر در این ابزار ثبت یا به سرور ارسال نمی‌شود.</li>
            </ul>
          </div>

          {/* Content Status Legend */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-sky-400" />
              تفاوت سطوح محتوا در این نسخه:
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono shrink-0">
                  reference
                </span>
                <span className="text-slate-300">محتوای مرجع تشریحی منبع‌دار با شناسه استاندارد (FMA / BodyParts3D)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono shrink-0">
                  educational_visualization
                </span>
                <span className="text-slate-300">نمایش آموزشی و مفهومی (نمایان‌گر شدت، پیش‌آگهی یا مدل بالینی معتبر نیست)</span>
              </div>
            </div>
          </div>

          {/* Provenance footer */}
          <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-2.5 space-y-0.5">
            <div>مسئول بازبینی علمی اولیه: {CATALOG_METADATA.reviewedBy}</div>
            <div>نسخه کاتالوگ: {CATALOG_METADATA.schemaVersion} | گراف مفاهیم: {KNOWLEDGE_GRAPH_METADATA.schemaVersion} | تاریخ بازبینی: {CATALOG_METADATA.reviewedAt}</div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-5 py-3.5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-end gap-2">
          {!requiresAcceptance && onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              بستن
            </button>
          )}
          <button
            data-testid="accept-disclaimer-btn"
            onClick={onAccept}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition shadow-lg shadow-sky-500/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>متوجه شدم؛ ورود به اطلس آموزشی</span>
          </button>
        </div>
      </div>
    </div>
  );
};
