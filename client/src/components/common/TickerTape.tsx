import React from "react";
import { Stock } from "../../types";
import { toneFor } from "../../utils/ledTone";
import LedText, { LedDisplay } from "./LedText";

interface TickerTapeProps {
  stocks: Stock[];
}

const SECONDS_PER_ITEM = 4;
const MIN_DURATION_S = 24;
const MIN_ITEMS = 10;

const TickerItem: React.FC<{ stock: Stock }> = ({ stock }) => {
  const pct = stock.price_change_percent;
  const tone = toneFor(pct);
  const arrow = tone === "up" ? "▲" : tone === "down" ? "▼" : "■";
  return (
    <span className="inline-flex items-baseline gap-3 px-6 whitespace-nowrap">
      <LedText>{stock.symbol}</LedText>
      <LedText>{stock.price != null ? stock.price.toFixed(2) : "—"}</LedText>
      <LedText tone={tone}>
        {arrow} {pct != null ? `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
      </LedText>
    </span>
  );
};

/**
 * Full-width scrolling LED board of the user's symbols. The item list is
 * rendered twice so the -50% marquee loop is seamless.
 */
const TickerTape: React.FC<TickerTapeProps> = ({ stocks }) => {
  if (stocks.length === 0) return null;
  // Short watchlists are repeated so one copy is always wider than the screen.
  const items = Array.from({ length: Math.ceil(MIN_ITEMS / stocks.length) }, () => stocks).flat();
  const duration = Math.max(MIN_DURATION_S, items.length * SECONDS_PER_ITEM);

  return (
    <div role="marquee" aria-label="Ticker tape">
      <LedDisplay
        pitch="md"
        className="w-full overflow-hidden rounded-none border-x-0"
        layerClassName="py-2.5 text-[22px]"
      >
        <div className="tg-marquee" style={{ "--tg-marquee-duration": `${duration}s` } as React.CSSProperties}>
          {[0, 1].map((copy) => (
            <div key={copy} className="flex" aria-hidden={copy === 1}>
              {items.map((s, i) => <TickerItem key={`${copy}-${i}-${s.symbol}`} stock={s} />)}
            </div>
          ))}
        </div>
      </LedDisplay>
    </div>
  );
};

export default TickerTape;
