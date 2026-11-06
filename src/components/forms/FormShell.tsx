import React from 'react';
import { X } from 'lucide-react';

/** Shared modal frame for the site-wide forms (Add New Prospect, Add Contact). */
export const FormShell: React.FC<{
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ title, icon, onClose, footer, children, wide }) => (
  <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className={`flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-2xl'}`}>
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
        <span className="text-blue-600">{icon}</span>
        <h2 className="flex-1 text-[20px] font-bold text-slate-900">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">{footer}</div>
    </div>
  </div>
);

export const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; hint?: string; className?: string }> = ({ label, required, children, hint, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-[15px] font-bold text-slate-700">
      {label}
      {required && <span className="text-rose-600"> *</span>}
    </span>
    {children}
    {hint && <span className="mt-1 block text-[13px] text-slate-500">{hint}</span>}
  </label>
);

export const inputCls = 'min-h-[50px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[16px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';
