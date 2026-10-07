import { useState, type CSSProperties, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Notice({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="notice" style={style}>
      {children}
      <button type="button" className="notice-close" aria-label="Dismiss message" onClick={() => setOpen(false)}><X size={15} /></button>
    </div>
  );
}
