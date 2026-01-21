import React, { useState, useEffect } from "react";
import { Scissors, ChevronUp, Loader2, Undo2 } from "lucide-react";
import './TokenizedText.css';

interface TokenizedTextProps {
  text: string;
  onInspect: (text: string) => Promise<string[]>;
  isExpanded?: boolean;
  tokens?: string[];
  suggestions?: Map<string, string>;
  appliedEdits?: Record<number, string>;
  onApplyCorrection?: (index: number, corrected: string | null) => void;
}

export const TokenizedText: React.FC<TokenizedTextProps> = ({
  text,
  onInspect,
  isExpanded = false,
  tokens: preLoadedTokens,
  suggestions,
  appliedEdits = {},
  onApplyCorrection,
}) => {
  const [tokens, setTokens] = useState<string[] | null>(preLoadedTokens || null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(isExpanded);

  useEffect(() => {
    if (preLoadedTokens) setTokens(preLoadedTokens);
    else {
      setTokens(null);
      if (isExpanded) loadTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, isExpanded, preLoadedTokens]);

  const loadTokens = async () => {
    if (preLoadedTokens) {
      setTokens(preLoadedTokens);
      return;
    }
    setLoading(true);
    try {
      const result = await onInspect(text);
      setTokens(result);
    } catch (e) {
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!tokens) await loadTokens();
  };

  const handleTokenClick = (idx: number, suggested: string | undefined) => {
    if (!onApplyCorrection) return;
    const isEdited = appliedEdits[idx] !== undefined;

    if (isEdited) {
      onApplyCorrection(idx, null); // Undo
    } else if (suggested) {
      onApplyCorrection(idx, suggested); // Apply
    }
  };

  return (
    <div className="token-wrapper">
      <div
        onClick={handleClick}
        className={`token-summary ${expanded ? "expanded" : ""}`}
      >
        <span className="text-content">
          {tokens ? tokens.map((t, i) => appliedEdits[i] || t).join("") : text}
        </span>
        
        <div className="icon-box">
          {expanded ? <ChevronUp size={20} /> : <Scissors size={20} />}
        </div>
        {expanded && <div className="active-bar"></div>}
      </div>

      {expanded && (
        <div className="mt-3 pl-1">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Processing text...</span>
            </div>
          ) : (
            <div className="tokens-grid">
              {tokens && tokens.length > 0 ? (
                tokens.map((token, idx) => {
                  const suggestion = suggestions?.get(token);
                  const isEdited = appliedEdits[idx] !== undefined;
                  const displayToken = isEdited ? appliedEdits[idx] : token;

                  let className = "token-chip";
                  if (isEdited) className += " edited";
                  else if (suggestion) className += " suggested";

                  return (
                    <div
                      key={idx}
                      onClick={() => handleTokenClick(idx, suggestion)}
                      className={className}
                    >
                      <span className="text-base font-semibold z-10">{displayToken}</span>

                      {suggestion && !isEdited && (
                        <div className="suggestion-tag">{suggestion}</div>
                      )}

                      {isEdited && (
                        <div className="undo-tag"><Undo2 size={10} /></div>
                      )}

                      <span className="token-idx">{idx + 1}</span>
                    </div>
                  );
                })
              ) : (
                <div className="w-full text-center text-slate-400 text-sm">No tokens found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};