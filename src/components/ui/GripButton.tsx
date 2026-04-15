import React from 'react';
import { cn } from '../../lib/utils';

interface GripButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  size?: 'md' | 'lg' | 'xl';
}

const GripButton: React.FC<GripButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'lg', 
  className, 
  ...props 
}) => {
  const variants = {
    primary: "bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700",
    secondary: "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200",
    accent: "bg-blue-500 text-black border-blue-600 hover:bg-blue-400",
    danger: "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
  };

  const sizes = {
    md: "py-3 px-6 text-sm",
    lg: "py-5 px-8 text-lg",
    xl: "py-8 px-10 text-2xl"
  };

  return (
    <button 
      className={cn(
        "rounded-2xl border font-black uppercase tracking-tighter transition-all active:scale-[0.98] flex items-center justify-center gap-3",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export default GripButton;
