import React, { useState } from "react";

type AddState = "idle" | "adding" | "added" | "error";

interface AddToListButtonProps {
  symbol: string;
  /** Wired to the existing add-stock path (POST /portfolio/add). The single source
   *  of truth for adding a stock — no parallel add logic lives here (P12). */
  onAdd: (symbol: string) => Promise<void>;
  size?: "sm" | "md";
}

/**
 * Canonical "＋ add to my list" affordance shown anywhere a stock is listed
 * (discovery cards, and later peer rows / thematic-news cards). Adding an
 * already-held stock is a safe no-op server-side, so repeat clicks are harmless.
 */
const AddToListButton: React.FC<AddToListButtonProps> = ({ symbol, onAdd, size = "md" }) => {
  const [state, setState] = useState<AddState>("idle");

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // don't trigger a parent card's onOpen
    if (state === "adding" || state === "added") return;
    setState("adding");
    try {
      await onAdd(symbol);
      setState("added");
    } catch (err) {
      console.error(`Add to list failed for ${symbol}:`, err);
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  };

  const dims = size === "sm" ? "h-7 w-7 text-sm" : "h-8 w-8 text-base";
  const label =
    state === "added"
      ? "✓"
      : state === "adding"
        ? "…"
        : state === "error"
          ? "!"
          : "+";

  const tone =
    state === "added"
      ? "bg-primary/20 text-ink-up border-ink-up/40"
      : state === "error"
        ? "bg-ink-down/15 text-ink-down border-ink-down/40"
        : "bg-[color-mix(in_srgb,var(--text-color)_6%,transparent)] text-text-main/70 border-[var(--tg-pane-border)] hover:border-primary/60 hover:text-ink-up hover:shadow-[0_0_14px_-4px_var(--signal-up)]";

  return (
    <button
      type="button"
      onClick={(e) => void handleClick(e)}
      disabled={state === "adding" || state === "added"}
      aria-label={state === "added" ? `${symbol} added to your list` : `Add ${symbol} to your list`}
      title={state === "added" ? "Added to your list" : "Add to your list"}
      className={`flex items-center justify-center rounded-full border font-bold leading-none transition-all duration-200 active:scale-90 disabled:cursor-default ${dims} ${tone}`}
    >
      {label}
    </button>
  );
};

export default AddToListButton;
