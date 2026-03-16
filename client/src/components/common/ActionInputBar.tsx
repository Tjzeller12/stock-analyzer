import { useState } from "react";

/**
 * Props for the ActionInputBar component.
 */
export interface ActionInputBarProps {
    onClick: (input: string) => void;
    disabled: boolean;
    placeholder: string;
    buttonLabel: string;
}

/**
 * ActionInputBar Component
 * 
 * A reusable UI component that provides a text input field accompanied by an action button.
 * It manages its own internal string state for the input, and fires the `onClick` prop 
 * with the current input value when the button is clicked or the Enter key is pressed.
 */
const ActionInputBar = ({ onClick, disabled, placeholder, buttonLabel }: ActionInputBarProps) => {
    const [input, setInput] = useState<string>("");

    // Triggers the provided onClick callback if the input is not empty, then clears the input
    const handleAction = () => {
        if (input.trim()) {
            onClick(input);
            setInput("");
        }
    }
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !disabled) {
            handleAction();
        }
    }
    return (
        <div className="bg-input-bg border border-border-main/40 rounded-lg px-2 py-0.5 my-0.5 flex items-center shadow-inner transition-all hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary">
            <input 
                className="mr-0 h-8 border-none bg-transparent outline-none flex-1 text-sm text-text-main placeholder-text-main/50 px-2"
                type="text" 
                placeholder={placeholder} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={handleKeyDown} 
            />
            <button 
                className={`ml-2 h-7 px-3 font-semibold text-xs rounded-md transition-all duration-200 shrink-0 ${
                    disabled
                    ? 'bg-list-bg text-text-main/50 cursor-not-allowed shadow-none border border-transparent'
                    : 'bg-primary text-white hover:bg-btn-bg hover:shadow-md hover:shadow-primary/20 active:scale-95 border border-primary/20'
                }`}
                onClick={handleAction} 
                disabled={disabled}
            >
                {buttonLabel}
            </button>
        </div>
    )
}
export default ActionInputBar;