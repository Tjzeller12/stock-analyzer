import React, { ReactNode } from "react";
import { LedTone } from "../../utils/ledTone";

export type LedPitch = "sm" | "md" | "lg";

interface LedTextProps {
  children: ReactNode;
  tone?: LedTone;
  className?: string;
}

const TONE_CLASS: Record<LedTone, string> = {
  text: "",
  up: "tg-led-up",
  down: "tg-led-down",
  flat: "tg-led-flat",
};

/**
 * Dot-matrix LED text (Ticker Glass "signal" layer).
 *
 * Renders solid glowing glyphs; it only becomes dots inside a `LedDisplay`,
 * whose mask lines the lit dots up with the display's unlit ones. Only use at >= 14px.
 */
const LedText: React.FC<LedTextProps> = ({ children, tone = "text", className = "" }) => (
  <span className={`tg-led ${TONE_CLASS[tone]} ${className}`}>{children}</span>
);

interface LedDisplayProps {
  children: ReactNode;
  pitch?: LedPitch;
  /** Classes for the outer dark module (size, radius, layout in its parent). */
  className?: string;
  /** Classes for the masked content layer (padding, flex layout). */
  layerClassName?: string;
}

/**
 * A dark LED module. Padding belongs on the layer, never on the display, so
 * the lit-dot mask and the unlit-dot background share the same origin.
 */
export const LedDisplay: React.FC<LedDisplayProps> = ({
  children,
  pitch = "sm",
  className = "",
  layerClassName = "",
}) => (
  <div className={`tg-display tg-pitch-${pitch} ${className}`}>
    <div className={`tg-led-layer ${layerClassName}`}>{children}</div>
  </div>
);

export default LedText;
