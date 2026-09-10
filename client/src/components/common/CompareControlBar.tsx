import React, { useState } from 'react';
import { AnalysisTemplateDTO, TemplateLibrary } from '../../types';
import AdvancedSettingsPanel, { RadarTemplate } from './AdvancedSettingsPanel';
import ColumnCustomizer from './ColumnCustomizer';
import ControlPanel from './ControlPanel';

interface CompareControlBarProps {
    selectedSymbols: Set<string>;
    onCompare: () => void;
    compareLoading: boolean;
    compareError: string | null;
    activeTemplate: RadarTemplate;
    visibleColumns: string[];
    onToggleColumn: (id: string) => void;
    onResetColumns: () => void;
    onApplyScoring: (radar: RadarTemplate, columns: string[]) => void;
    scoringLibrary: TemplateLibrary;
    scoringActiveId: number | null;
    profileRiskTag: string | null;
    onSaveSetup: (name: string, description: string, radar: RadarTemplate, columns: string[]) => Promise<AnalysisTemplateDTO>;
    onUpdateSetup: (id: number, radar: RadarTemplate, columns: string[], meta: { name: string; description: string }) => Promise<AnalysisTemplateDTO>;
    onDeleteSetup: (id: number) => Promise<void>;
    onPersistActive: (id: number) => void;
}

/**
 * CompareControlBar
 *
 * The single, shared control bar that governs BOTH stock tables (watchlist +
 * portfolio). Selection is shared across the tables, so compare and the radar
 * scoring editor belong here once — not duplicated per table. Table-specific
 * actions (add / refresh / sync) live with their own table instead.
 */
const CompareControlBar: React.FC<CompareControlBarProps> = ({
    selectedSymbols,
    onCompare,
    compareLoading,
    compareError,
    activeTemplate,
    visibleColumns,
    onToggleColumn,
    onResetColumns,
    onApplyScoring,
    scoringLibrary,
    scoringActiveId,
    profileRiskTag,
    onSaveSetup,
    onUpdateSetup,
    onDeleteSetup,
    onPersistActive,
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
                    label: showAdvanced ? "Hide scoring" : "Scoring",
                    onClick: () => setShowAdvanced(!showAdvanced),
                },
            ]}
            info={`Selected: ${count} (min 2, max 10)${compareError ? ` - ${compareError}` : ''}`}
            extra={(
                <ColumnCustomizer
                    visibleColumns={visibleColumns}
                    onToggle={onToggleColumn}
                    onReset={onResetColumns}
                />
            )}
        >
            {showAdvanced && (
                <AdvancedSettingsPanel
                    onClose={() => setShowAdvanced(false)}
                    initialTemplate={activeTemplate}
                    visibleColumns={visibleColumns}
                    library={scoringLibrary}
                    activeId={scoringActiveId}
                    profileRiskTag={profileRiskTag}
                    onSaveSetup={onSaveSetup}
                    onUpdateSetup={onUpdateSetup}
                    onDeleteSetup={onDeleteSetup}
                    onPersistActive={onPersistActive}
                    onApply={(radar, columns) => {
                        onApplyScoring(radar, columns);
                        setShowAdvanced(false);
                    }}
                />
            )}
        </ControlPanel>
    );
};

export default CompareControlBar;
