import { javascript } from '@codemirror/lang-javascript';
import CodeMirror from '@uiw/react-codemirror';
import { parse } from 'mathjs';
import React from 'react';
import { AVAILABLE_VARIABLES } from '../../constants/radarMetrics';

interface FormulaBuilderProps {
  label: string;
  value: string;
  onChange: (newValue: string) => void;
  availableVariables?: string[]; // Optional: for autocomplete or displaying a legend
}

// Dummy data for the Live Preview feature
const DUMMY_STOCK_DATA: Record<string, number> = {};
AVAILABLE_VARIABLES.forEach(v => {
  DUMMY_STOCK_DATA[v] = 0.5;          // e.g., pe_ratio
  DUMMY_STOCK_DATA[`mm_${v}`] = 0.5;  // e.g., mm_pe_ratio
  DUMMY_STOCK_DATA[`z_${v}`] = 0.5;   // e.g., z_pe_ratio
});

const FormulaBuilder: React.FC<FormulaBuilderProps> = ({ label, value, onChange }) => {
  // Let's refactor to derive the score and error directly from `value` to avoid useEffect entirely!
  let currentError: string | null = null;
  let currentPreview: number | null = null;

  if (value.trim()) {
    try {
      // 1. Client-Side Validation: Syntax check
      const compiledNode = parse(value);
      const compiled = compiledNode.compile();

      // 2. Live Preview: Try to evaluate it with our dummy stock data
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = compiled.evaluate(DUMMY_STOCK_DATA);
        // Clamp between 0 and 100 just like the backend does
        const clamped = Math.max(0, Math.min(100, Number(result)));
        currentPreview = isNaN(clamped) ? null : clamped;
      } catch (_e) {
        // It's valid syntax, but might be using an unknown variable 
        console.error(_e)
        currentPreview = null;
      }

    } catch (err: unknown) {
      // Caught a Syntax Error (e.g. "n_pe * (0.4 + " -> Missing parenthesis)
      currentError = err instanceof Error ? err.message : String(err);
      currentPreview = null;
    }
  }

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex justify-between items-end">
        <label className="text-sm font-semibold text-gray-300">{label}</label>
        
        {/* Live Preview Badge */}
        {currentPreview !== null && !currentError && (
          <div className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30">
            Preview Score: {currentPreview.toFixed(1)}
          </div>
        )}
      </div>
      
      {/* CodeMirror Formula Bar */}
      <div className={`rounded overflow-hidden border ${currentError ? 'border-red-500/50' : 'border-gray-700'} focus-within:border-blue-500 overflow-hidden`}>
        <CodeMirror
          value={value}
          height="auto"
          theme="dark"
          extensions={[javascript()]} // JS highlighting makes math operators and variables look great
          onChange={(val) => onChange(val)}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false
          }}
          className="text-sm"
        />
      </div>

      {/* Syntax Error Warning */}
      {currentError && (
        <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <span>⚠️ {currentError}</span>
        </div>
      )}
    </div>
  );
};

export default FormulaBuilder;
