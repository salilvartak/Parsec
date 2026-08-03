import React, { useEffect, useRef } from 'react';
import { useIsMobile } from '../lib/useMedia.js';

// Centered dialog with a scrim. Escape and outside-click both close.
// On a phone it becomes a bottom sheet — a centered box with a keyboard open
// ends up half off-screen.
export default function Modal({ title, subtitle, onClose, width = 560, children, footer }) {
  const isMobile = useIsMobile();
  const boxRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // Stop the page behind the dialog scrolling while it's open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      onMouseDown={(e) => { if (!boxRef.current?.contains(e.target)) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.4)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        padding: isMobile ? 0 : 20,
      }}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-label={title}
        style={{
          width: isMobile ? '100%' : `min(${width}px, 100%)`,
          maxHeight: isMobile ? '92dvh' : '86dvh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: isMobile ? '14px 14px 0 0' : 12,
          boxShadow: '0 16px 48px rgba(0,0,0,.24)', overflow: 'hidden',
        }}>
        <div style={{ flex: 'none', padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "600 13.5px 'Inter',sans-serif", color: 'var(--text)' }}>{title}</div>
            {subtitle && <div style={{ font: "400 11.5px 'Inter',sans-serif", color: 'var(--text3)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ flex: 'none', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)', font: '15px sans-serif', padding: '0 2px', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 0 }}>{children}</div>

        {footer && (
          <div style={{ flex: 'none', padding: '11px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export const modalBtn = {
  border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 7,
  padding: '0 14px', height: 32, cursor: 'pointer',
  font: "500 12.5px 'Inter',sans-serif", color: 'var(--text)', flex: 'none',
};

export const modalBtnPrimary = {
  ...modalBtn, background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-fg)',
};
