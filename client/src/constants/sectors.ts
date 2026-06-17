import { SectorInfo } from "../types";

/**
 * Sector matrix content. `key` MUST match the exact strings Alpha Vantage's
 * OVERVIEW endpoint stores in StockMaster.sector so `preferred_sectors` is
 * join-compatible with downstream features without a translation layer
 * (design Property P12). These are the 7 canonical Alpha Vantage sectors.
 */
export const SECTORS: SectorInfo[] = [
  {
    key: "TECHNOLOGY",
    label: "Technology",
    pitch: [
      "Highest historical growth and scalability",
      "Home to dominant, wide-moat platform companies",
    ],
    realityCheck: [
      "Very sensitive to interest rates",
      "Rich valuations can imply an AI/hype bubble",
    ],
  },
  {
    key: "FINANCE",
    label: "Finance",
    pitch: [
      "Banks and insurers benefit from higher rates",
      "Often pays steady, meaningful dividends",
    ],
    realityCheck: [
      "Cyclical — hit hard in recessions and credit crunches",
      "Heavily regulated and leverage-sensitive",
    ],
  },
  {
    key: "LIFE SCIENCES",
    label: "Life Sciences",
    pitch: [
      "Healthcare demand is durable and demographic-driven",
      "Breakthroughs can re-rate a company overnight",
    ],
    realityCheck: [
      "Binary clinical-trial and FDA approval risk",
      "Exposed to drug-pricing and policy changes",
    ],
  },
  {
    key: "MANUFACTURING",
    label: "Manufacturing",
    pitch: [
      "Tangible assets and real pricing power",
      "Benefits from reshoring and infrastructure spend",
    ],
    realityCheck: [
      "Capital-intensive with thin margins",
      "Supply-chain and commodity-cost exposure",
    ],
  },
  {
    key: "ENERGY & TRANSPORTATION",
    label: "Energy & Transportation",
    pitch: [
      "Strong cash flows and dividends when prices are high",
      "A practical inflation hedge",
    ],
    realityCheck: [
      "Commodity prices are volatile and unpredictable",
      "Long-term disruption risk from the energy transition",
    ],
  },
  {
    key: "TRADE & SERVICES",
    label: "Trade & Services",
    pitch: [
      "Broad exposure to consumer and business spending",
      "Includes resilient, recognizable brands",
    ],
    realityCheck: [
      "Sensitive to the consumer and economic cycle",
      "Margins squeezed by labor and logistics costs",
    ],
  },
  {
    key: "REAL ESTATE & CONSTRUCTION",
    label: "Real Estate & Construction",
    pitch: [
      "Hard assets and reliable income via REITs",
      "Another hedge against long-run inflation",
    ],
    realityCheck: [
      "Extremely interest-rate sensitive",
      "Illiquid and vulnerable to property downturns",
    ],
  },
];
