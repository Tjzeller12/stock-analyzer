import { useState } from "react";
import "./ActionInputBar.css";
export interface ActionInputBarProps {
    onClick: (input: string) => void;
    disabled: boolean;
    placeholder: string;
    buttonLabel: string;
}

const ActionInputBar = ({ onClick, disabled, placeholder, buttonLabel }: ActionInputBarProps) => {
    const [input, setInput] = useState<string>("");
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