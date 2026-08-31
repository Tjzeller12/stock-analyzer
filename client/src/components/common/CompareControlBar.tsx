import React, { useState } from 'react';
import AdvancedSettingsPanel, { RadarTemplate } from './AdvancedSettingsPanel';
import ControlPanel from './ControlPanel';

interface CompareControlBarProps {
    selectedSymbols: Set<string>;
    onCompare: () => void;
    compareLoading: boolean;
    compareError: string | null;
    activeTemplate: RadarTemplate;
    setActiveTemplate: (template: RadarTemplate) => void;
}

/**
 * CompareControlBar
 *
 * The single, shared control bar that governs BOTH stock tables (watchlist +
 * portfolio). Selection is shared across the tables, so compare and the Advanced
 * radar-template editor belong here once — not duplicated per table. Table-specific
 * actions (add / refresh / sync) live with their own table instead.
 */
const CompareControlBar: React.FC<CompareControlBarProps> = ({
    selectedSymbols,
    onCompare,
    compareLoading,
    compareError,
    activeTemplate,
    setActiveTemplate,
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const count = selectedSymbols.size;

    return (
        <ControlPanel
            buttons={[
                {
                    label: compareLoading ? "Comparing..." : `Compare Selected (${count})`,
                    onClick: onCompare,
                    disabled: count < 2 || count > 10 || compareLoading,
                },
                {
                    label: showAdvanced ? "Hide Advanced" : "Advanced",
                    onClick: () => setShowAdvanced(!showAdvanced),
                },
            ]}
            info={`Selected: ${count} (min 2, max 10)${compareError ? ` - ${compareError}` : ''}`}
        >
            {showAdvanced && (
                <AdvancedSettingsPanel
                    onClose={() => setShowAdvanced(false)}
                    initialTemplate={activeTemplate}
                    onApply={(template: RadarTemplate) => {
                        setActiveTemplate(template);
                        setShowAdvanced(false);
                    }}
                />
            )}
        </ControlPanel>
    );
};

export default CompareControlBar;
