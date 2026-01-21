import React, { useState } from 'react';
import { User, ArrowRight } from 'lucide-react';
import { useAnnotation } from '../../context/AnnotationContext';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const { setEmployeeId } = useAnnotation();
  const [tempId, setTempId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempId.trim()) {
      setEmployeeId(tempId.trim());
    }
  };

  return (
    <div className="login-container">
      <div className="login-card animate-fade-in">
        <div className="login-icon">
          <User size={32} />
        </div>
        <h1 className="login-title">Employee Login</h1>
        <p className="login-subtitle">
          Enter your ID to access workspace
        </p>
        
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            className="login-input"
            placeholder="e.g., EMP001"
            value={tempId}
            onChange={(e) => setTempId(e.target.value)}
          />
          <button
            type="submit"
            className="login-btn"
            disabled={!tempId.trim()}
          >
            Enter Workspace <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;