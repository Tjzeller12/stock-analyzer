import React, { useState } from 'react';
import { AVAILABLE_VARIABLES } from '../../constants/radarMetrics';
import FormulaBuilder from './FormulaBuilder';

export interface RadarTemplate {
  name: string;
  normalization_method: 'min-max' | 'z-score';
  scope: 'global' | 'sector' | 'industry';
  equations: Record<string, string>;
}

// Default Starting Template (Prefixes REMOVED for user friendliness)
export const DEFAULT_TEMPLATE: RadarTemplate = {
  name: "Custom Template",
  normalization_method: "min-max",
  scope: "global",
  equations: {
// Valuation: Lower multiples are better. Fwd P/E and Free Cash Flow are king.
    "Valuation": "(1 - forward_pe) * 0.4 + (1 - ev_to_ebitda) * 0.3 + (1 - price_to_fc) * 0.3",
    
    // Growth: Rewarding strong top and bottom line expansion. We will also factor in insider trading as an indictator.
    "Growth": "0.4 + (eps_growth_qoq * 0.3) + (rev_growth_qoq * 0.3) + (insider_volume / (market_cap + 0.2)) * 0.2",
    
    // Stability: Low debt, low volatility (beta), and a dividend kicker.
    "Stability": "(1 - debt_to_equity) * 0.4 + (1 - beta) * 0.4 + dividend_yield * 0.2",
    
    // Sentiment: Long-term investors care heavily about a wide economic moat.
    "Sentiment": "ai_moat_score * 0.6 + ai_news_score * 0.4",
    
    // Efficiency: ROIC is the holy grail for long-term holds.
    "Efficiency": "roe * 0.4 + roa * 0.3 + profit_margin * 0.3",

    // Insider Confidence: Must be a ratio to account for lower trading with smaller companies
    "Insider Confidence": "0.5 + (insider_volume / (market_cap + 0.2)) * 0.5"
  }
};


interface AdvancedSettingsPanelProps {
  initialTemplate?: RadarTemplate;
  onApply: (template: RadarTemplate) => void;
  onClose: () => void;
}

const AdvancedSettingsPanel: React.FC<AdvancedSettingsPanelProps> = ({ initialTemplate, onApply, onClose }) => {
  const [template, setTemplate] = useState<RadarTemplate>(initialTemplate || DEFAULT_TEMPLATE);
  const [showVariablesGuide, setShowVariablesGuide] = useState(false);

  const handleEquationChange = (category: string, newEquation: string) => {
    setTemplate(prev => ({
      ...prev,
      equations: {
        ...prev.equations,
        [category]: newEquation
      }
    }));
  };

  const setNormalization = (method: 'min-max' | 'z-score') => {
    setTemplate({ ...template, normalization_method: method });
  };
  
  const setScope = (scope: 'global' | 'sector' | 'industry') => {
    setTemplate({ ...template, scope: scope });
  };

const handleApply = () => {
    console.log("Applying template:", template);
    onApply(template);
  }

  return (
    <div className="bg-form-bg p-4 rounded-xl border border-border-main/20 mt-3 shadow-xl mb-4">
      <div className="flex justify-between items-center mb-4 border-b border-border-main/20 pb-3">
        <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-[#057a37] text-transparent bg-clip-text">
          Advanced Engine Settings
        </h2>
        <button 
          onClick={onClose}
          className="text-text-main/50 hover:text-red-400 transition-colors text-sm"
        >
          ✕ Close
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Normalization Format */}
        <div className="bg-[#1a1c23] p-3 rounded-lg border border-white/5">
            <h3 className="text-xs font-semibold mb-2 text-gray-300">Data Normalization Formatting</h3>
            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-md w-fit">
            <button 
                onClick={() => setNormalization('min-max')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                template.normalization_method === 'min-max' 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-text-main/60 hover:text-white'
                }`}
            >
                Min-Max (Bounded 0-1)
            </button>
            <button 
                onClick={() => setNormalization('z-score')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                template.normalization_method === 'z-score' 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-text-main/60 hover:text-white'
                }`}
            >
                Z-Score (Outliers)
            </button>
            </div>
            <p className="text-[10px] text-text-main/40 mt-1.5 ml-1 leading-tight">
            {template.normalization_method === 'min-max' 
                ? "Values are strictly scaled between the lowest and highest stats in the group." 
                : "Highlights extreme outliers by measuring standard deviations from the mean."}
            </p>
        </div>

        {/* Global/Sector Scope (Only applies to Individual Stock Views) */}
        <div className="bg-[#1a1c23] p-3 rounded-lg border border-white/5">
            <h3 className="text-xs font-semibold mb-2 text-gray-300">Single Stock Comparison Scope</h3>
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-md w-fit">
            {(['global', 'sector', 'industry'] as const).map(scope_val => (
                <button 
                    key={scope_val}
                    onClick={() => setScope(scope_val)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all capitalize ${
                    template.scope === scope_val 
                        ? 'bg-primary text-white shadow-md' 
                        : 'text-text-main/60 hover:text-white'
                    }`}
                >
                    {scope_val}
                </button>
            ))}
            </div>
            <p className="text-[10px] text-text-main/40 mt-1.5 ml-1 leading-tight">
               Select which peer group to compare against when viewing a single stock's profile.
            </p>
        </div>
      </div>

       {/* Reference Guide Dropdown */}
       <div className="mb-4">
        <button 
            onClick={() => setShowVariablesGuide(!showVariablesGuide)}
            className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-green-400 transition-colors"
        >
            <span>{showVariablesGuide ? '▼' : '▶'}</span>
            Variables & Operators Guide
        </button>
        {showVariablesGuide && (
            <div className="mt-2 flex flex-col gap-3">
                <div className="p-3 bg-black/30 rounded-lg border border-border-main/10 text-[11px] text-gray-400">
                    <h4 className="text-gray-300 font-semibold mb-1.5 text-xs">Available Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                        {AVAILABLE_VARIABLES.map(v => (
                            <div key={v} className="bg-black/40 px-1.5 py-0.5 rounded font-mono select-all truncate">{v}</div>
                        ))}
                    </div>
                </div>
                <div className="p-3 bg-black/30 rounded-lg border border-border-main/10 text-[11px] text-gray-400">
                    <h4 className="text-gray-300 font-semibold mb-1.5 text-xs">Math Operators</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                        <div className="bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1.5"><span className="font-mono text-primary font-bold bg-white/10 px-1 rounded">+</span> Add</div>
                        <div className="bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1.5"><span className="font-mono text-primary font-bold bg-white/10 px-1 rounded">-</span> Subtract</div>
                        <div className="bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1.5"><span className="font-mono text-primary font-bold bg-white/10 px-1 rounded">*</span> Multiply</div>
                        <div className="bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1.5"><span className="font-mono text-primary font-bold bg-white/10 px-1 rounded">/</span> Divide</div>
                        <div className="bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1.5"><span className="font-mono text-primary font-bold bg-white/10 px-1 rounded">**</span> Exponent</div>
                        <div className="bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1.5"><span className="font-mono text-primary font-bold bg-white/10 px-1 rounded">sqrt()</span> Sq Root</div>
                        <div className="bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1.5"><span className="font-mono text-primary font-bold bg-white/10 px-1 rounded">log10()</span> Log 10</div>
                        <div className="bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1.5"><span className="font-mono text-primary font-bold bg-white/10 px-1 rounded">abs()</span> Abs Val</div>
                        <div className="bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1.5"><span className="font-mono text-primary font-bold bg-white/10 px-1 rounded">( )</span> Group</div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* The 6 Formula Builders */}
      <h3 className="text-xs font-semibold mb-2 text-gray-300 border-b border-border-main/10 pb-1.5">Radar Grid Algorithms</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {Object.entries(template.equations).map(([category, equation]) => (
          <FormulaBuilder 
            key={category}
            label={category}
            value={equation}
            onChange={(val) => handleEquationChange(category, val)}
          />
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-border-main/20 pt-3">
        <button 
          onClick={onClose}
          className="px-4 py-1.5 rounded-md text-xs font-semibold bg-list-bg hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={handleApply}
          className="px-4 py-1.5 rounded-md text-xs font-semibold bg-gradient-to-r from-primary to-[#057a37] text-white hover:scale-105 transition-transform"
        >
          Apply Template
        </button>
      </div>
    </div>
  );
};

export default AdvancedSettingsPanel;
