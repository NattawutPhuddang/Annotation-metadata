import React from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import './Modal.css';

export type ModalType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'secondary';
  isLoading?: boolean;
}

interface ModalProps {
  isOpen: boolean;
  type?: ModalType;
  title: string;
  message: string;
  actions?: ModalAction[];
  onClose?: () => void;
  icon?: React.ReactNode;
  closeButton?: boolean;
}

const getDefaultIcon = (type: ModalType) => {
  switch (type) {
    case 'success':
      return <CheckCircle size={40} />;
    case 'error':
      return <AlertCircle size={40} />;
    case 'warning':
      return <AlertTriangle size={40} />;
    case 'confirm':
      return <AlertCircle size={40} />;
    case 'info':
    default:
      return <Info size={40} />;
  }
};

const getIconColor = (type: ModalType) => {
  switch (type) {
    case 'success':
      return '#10b981';
    case 'error':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    case 'confirm':
      return '#ef4444';
    case 'info':
    default:
      return '#3b82f6';
  }
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  type = 'info',
  title,
  message,
  actions = [],
  onClose,
  icon,
  closeButton = true,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  const defaultActions: ModalAction[] = actions.length > 0 ? actions : [
    {
      label: 'Close',
      onClick: onClose || (() => {}),
      variant: 'primary',
    },
  ];

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className={`modal-content modal-${type}`}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-icon-wrapper" style={{ color: getIconColor(type) }}>
            {icon || getDefaultIcon(type)}
          </div>
          {closeButton && onClose && (
            <button className="modal-close-btn" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="modal-body">
          <h2 className="modal-title">{title}</h2>
          <p className="modal-message">{message}</p>
        </div>

        {/* Footer */}
        {defaultActions.length > 0 && (
          <div className={`modal-footer ${defaultActions.length === 1 ? 'single-action' : ''}`}>
            {defaultActions.map((action, idx) => (
              <button
                key={idx}
                className={`modal-btn modal-btn-${action.variant || 'primary'}`}
                onClick={action.onClick}
                disabled={action.isLoading}
              >
                {action.isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="spinner-small" />
                    Loading...
                  </span>
                ) : (
                  action.label
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;