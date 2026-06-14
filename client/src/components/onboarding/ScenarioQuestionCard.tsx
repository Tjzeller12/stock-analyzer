import React from "react";
import { ScenarioQuestion } from "../../types";

interface ScenarioQuestionCardProps {
  question: ScenarioQuestion;
  selectedOptionId: string | null;
  onSelect: (optionId: string) => void;
}

/** Renders a single scenario question with single-select answer options. */
const ScenarioQuestionCard: React.FC<ScenarioQuestionCardProps> = ({
  question,
  selectedOptionId,
  onSelect,
}) => {
  return (
    <div className="text-left">
      <h2 className="text-2xl font-bold mb-2 text-text-main">{question.prompt}</h2>
      {question.helper && (
        <p className="text-sm text-text-main/60 mb-5">{question.helper}</p>
      )}
      <div className="flex flex-col gap-3 mt-4">
        {question.options.map((option) => {
          const isSelected = option.id === selectedOptionId;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              aria-pressed={isSelected}
              className={`w-full text-left px-4 py-3.5 rounded-lg border transition-all duration-150 flex items-center gap-3 ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                  : "border-border-main/30 bg-input-bg hover:border-text-main/40 hover:bg-row-hover"
              }`}
            >
              <span
                className={`flex-none w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? "border-primary" : "border-text-main/40"
                }`}
              >
                {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </span>
              <span className="text-sm font-medium text-text-main">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ScenarioQuestionCard;
