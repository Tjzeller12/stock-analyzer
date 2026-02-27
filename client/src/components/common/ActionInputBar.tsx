import { useState } from "react";
import "./ActionInputBar.css";

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
        <div className="action-input-bar">
            <input type="text" placeholder={placeholder} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} />
            <button onClick={handleAction} disabled={disabled}>{buttonLabel}</button>
        </div>
    )
}
export default ActionInputBar;