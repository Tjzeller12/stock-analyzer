  export const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    // Alpha Vantage format: YYYYMMDDTHHMM
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    const hour = dateString.substring(9, 11);
    const minute = dateString.substring(11, 13);
    const formattedDate = `${year}-${month}-${day}T${hour}:${minute}:00Z`;
    return new Date(formattedDate).toLocaleString();
  };

  // Format market cap
  export const formatMarketCap = (value: number) => {
    if (value >= 1e12) {
      return (value / 1e12).toFixed(1) + "T";
    } else if (value >= 1e9) {
      return (value / 1e9).toFixed(1) + "B";
    } else if (value >= 1e6) {
      return (value / 1e6).toFixed(1) + "M";
    } else if (value >= 1e3) {
      return (value / 1e3).toFixed(1) + "K";
    } else {
      return value.toString();
    }
  };

  export const formatFreeCashFlow = (value: number) => {
    if (value >= 1e12) {
      return (value / 1e12).toFixed(1) + "T";
    } else if (value >= 1e9) {
      return (value / 1e9).toFixed(1) + "B";
    }
  };

  export const formatDebtToEquity = (value: number) => {
    return value.toFixed(2);
  };

  export const formatRoic = (value: number) => {
    return value.toFixed(2);
  };

  export const formatPriceToFc = (value: number) => {
    return value.toFixed(2);
  };

  export const formatCashAndCashEquivalents = (value: number) => {
    if (value >= 1e12) {
      return (value / 1e12).toFixed(1) + "T";
    } else if (value >= 1e9) {
      return (value / 1e9).toFixed(1) + "B";
    } else if (value >= 1e6) {
      return (value / 1e6).toFixed(1) + "M";
    }
    return value.toFixed(2);
  };