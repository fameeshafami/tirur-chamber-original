import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const toast = useCallback((msg, type = 'default', duration = 2800) => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" aria-atomic="false" style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        {toasts.map(({ id, msg, type }) => (
          <div
            key={id}
            role="status"
            style={{
              background: type === 'error' ? '#d64545' : type === 'success' ? '#0f6e51' : '#1a2420',
              color: '#fff',
              padding: '11px 22px',
              borderRadius: 30,
              fontSize: 13.5,
              fontWeight: 600,
              boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
              whiteSpace: 'nowrap',
              maxWidth: '90vw',
              animation: 'toastIn 0.22s ease',
            }}
          >
            {msg}
          </div>
        ))}
      </div>
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
