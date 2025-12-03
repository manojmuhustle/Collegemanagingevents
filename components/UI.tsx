import React from 'react';

// --- BUTTON ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseStyle = "rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg"
  };

  const variants = {
    primary: "bg-brand-primary hover:bg-violet-800 text-white focus:ring-violet-500",
    secondary: "bg-brand-secondary hover:bg-pink-700 text-white focus:ring-pink-500",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    success: "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700",
  };

  return <button className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
};

// --- INPUT ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-300">{label}</label>}
      <input 
        className={`bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all ${className}`}
        {...props} 
      />
    </div>
  );
};

// --- SELECT ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-300">{label}</label>}
      <select 
        className={`bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

// --- MODAL ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      {/* Content */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200 text-slate-100">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- BADGE ---
export const Badge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-900/30 text-yellow-500 border-yellow-700/50",
    APPROVED: "bg-green-900/30 text-green-500 border-green-700/50",
    REJECTED: "bg-red-900/30 text-red-500 border-red-700/50",
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${styles[status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {status}
    </span>
  );
};