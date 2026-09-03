import { javascript } from '@codemirror/lang-javascript';
import CodeMirror from '@uiw/react-codemirror';
import { parse } from 'mathjs';
import React, { useContext } from 'react';
import { AVAILABLE_VARIABLES } from '../../constants/radarMetrics';
import { ThemeContext } from '../../ThemeContext';

interface FormulaBuilderProps {
  label: string;
  value: string;
  onChange: (newValue: string) => void;
  availableVariables?: string[];
  headerExtra?: React.ReactNode;
}

const DUMMY_STOCK_DATA: Record<string, number> = {};
AVAILABLE_VARIABLES.forEach(v => {
  DUMMY_STOCK_DATA[v] = 0.5;
  DUMMY_STOCK_DATA[`mm_${v}`] = 0.5;
  DUMMY_STOCK_DATA[`z_${v}`] = 0.5;
});

export function evaluateFormula(value: string): { error: string | null; preview: number | null } {
  if (!value.trim()) {
    return { error: "Equation is empty.", preview: null };
  }
  try {
    const compiled = parse(value).compile();
    try {
      const result = compiled.evaluate(DUMMY_STOCK_DATA);
      const clamped = Math.max(0, Math.min(100, Number(result)));
      return { error: null, preview: Number.isNaN(clamped) ? null : clamped };
    } catch {
      return { error: null, preview: null };
    }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err), preview: null };
  }
}

const FormulaBuilder: React.FC<FormulaBuilderProps> = ({ label, value, onChange, headerExtra }) => {
  const { theme } = useContext(ThemeContext);
  const { error: currentError, preview: currentPreview } = evaluateFormula(value);

  return (
    <div className="flex flex-col gap-2 mb-1">
      <div className="flex justify-between items-end gap-2">
        <label className="text-sm font-semibold text-text-main">{label}</label>
        <div className="flex items-center gap-2">
          {currentPreview !== null && !currentError && (
            <div className="text-xs bg-primary/15 text-primary px-2 py-1 rounded border border-primary/30">
              Preview Score: {currentPreview.toFixed(1)}
            </div>
          )}
          {headerExtra}
        </div>
      </div>

      <div className={`rounded overflow-hidden border ${currentError ? 'border-red-500/50' : 'border-border-main/30'} focus-within:border-primary`}>
        <CodeMirror
          value={value}
          height="auto"
          theme={theme === "dark" ? "dark" : "light"}
          extensions={[javascript()]}
          onChange={(val) => onChange(val)}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false
          }}
          className="text-sm"
        />
      </div>

      {currentError && (
        <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <span>⚠️ {currentError}</span>
        </div>
      )}
    </div>
  );
};

export default FormulaBuilder;
