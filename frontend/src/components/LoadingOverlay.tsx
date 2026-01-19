import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  isVisible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<Props> = ({ isVisible, message = "Loading..." }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-white/90 z-[9999] flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center border border-indigo-50 animate-fade-in">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h3 className="text-xl font-semibold text-slate-700">Just a moment</h3>
        <p className="text-slate-500 mt-2">{message}</p>
      </div>
    </div>
  );
};