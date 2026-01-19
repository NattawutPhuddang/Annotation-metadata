import React from 'react';
import { Download } from 'lucide-react';

interface Props {
  onClick: () => void;
  variant?: 'success' | 'danger' | 'primary';
  label?: string;
  className?: string;
}

export const DownloadButton: React.FC<Props> = ({ 
  onClick, 
  variant = 'primary', 
  label = 'Download TSV',
  className = ''
}) => {
  return (
    <button
      onClick={onClick}
      className={`btn-download btn-download-${variant} ${className}`}
    >
      <Download size={18} strokeWidth={2.5} />
      {label}
    </button>
  );
};