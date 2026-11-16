import { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, CheckCircle, XCircle, HelpCircle } from 'lucide-react';

const ConfirmContext = createContext(null);

const ICONS = {
  danger: <Trash2 size={28} />,
  warning: <AlertTriangle size={28} />,
  success: <CheckCircle size={28} />,
  info: <HelpCircle size={28} />,
};

const COLORS = {
  danger: { bg: '#FEE2E2', color: '#DC2626', btn: 'btn-danger' },
  warning: { bg: '#FEF3C7', color: '#D97706', btn: 'btn-warning' },
  success: { bg: '#D1FAE5', color: '#059669', btn: 'btn-primary' },
  info: { bg: '#DBEAFE', color: '#2563EB', btn: 'btn-primary' },
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback(({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger' }) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmText, cancelText, type, resolve });
    });
  }, []);

  const handleConfirm = () => { state?.resolve(true); setState(null); };
  const handleCancel = () => { state?.resolve(false); setState(null); };

  const style = state ? COLORS[state.type] || COLORS.info : COLORS.info;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={handleCancel} style={{ zIndex: 10000 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, animation: 'slideUp 0.2s ease-out' }}>
            <div style={{ padding: '28px 24px 16px', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: style.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', color: style.color,
              }}>
                {ICONS[state.type] || ICONS.info}
              </div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: 8 }}>{state.title}</h3>
              <p className="text-muted text-sm" style={{ lineHeight: 1.5 }}>{state.message}</p>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '12px 24px 24px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={handleCancel} style={{ flex: 1 }}>{state.cancelText}</button>
              <button className={`btn ${style.btn}`} onClick={handleConfirm} style={{ flex: 1 }}>{state.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within ConfirmProvider');
  return confirm;
}
