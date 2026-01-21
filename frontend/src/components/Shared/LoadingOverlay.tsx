import React from 'react';
import { Loader2 } from 'lucide-react';
import './LoadingOverlay.css';

interface Props {
  isVisible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<Props> = ({ isVisible, message = "Loading..." }) => {
  if (!isVisible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-card">
        <Loader2 className="spinner" />
        <h3 className="loading-title">Just a moment</h3>
        <p className="loading-msg">{message}</p>
      </div>
    </div>
  );
};