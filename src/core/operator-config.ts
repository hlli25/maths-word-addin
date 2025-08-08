// Centralized configuration for large operators
export interface OperatorInfo {
  symbol: string;
  name: string;
  isIntegral: boolean;
}

// Map of LaTeX commands to operator info
export const OPERATOR_CONFIG: { [key: string]: OperatorInfo } = {
  "\\sum": { symbol: "∑", name: "sum", isIntegral: false },
  "\\prod": { symbol: "∏", name: "prod", isIntegral: false },
  "\\coprod": { symbol: "∐", name: "coprod", isIntegral: false },
  "\\bigcup": { symbol: "∪", name: "bigcup", isIntegral: false },
  "\\bigcap": { symbol: "∩", name: "bigcap", isIntegral: false },
  "\\bigvee": { symbol: "∨", name: "bigvee", isIntegral: false },
  "\\bigwedge": { symbol: "∧", name: "bigwedge", isIntegral: false },
  "\\bigoplus": { symbol: "⨁", name: "bigoplus", isIntegral: false },
  "\\bigotimes": { symbol: "⨂", name: "bigotimes", isIntegral: false },
  "\\bigodot": { symbol: "⨀", name: "bigodot", isIntegral: false },
  "\\biguplus": { symbol: "⨄", name: "biguplus", isIntegral: false },
  "\\int": { symbol: "∫", name: "int", isIntegral: true },
  "\\oint": { symbol: "∮", name: "oint", isIntegral: true },
  // Future integral operators can be added here with isIntegral: true
};

// Helper functions for common operations

// Get operator map for LaTeX converter (LaTeX command -> symbol)
export function getLatexToSymbolMap(): { [key: string]: string } {
  const map: { [key: string]: string } = {};
  for (const [command, info] of Object.entries(OPERATOR_CONFIG)) {
    map[command] = info.symbol;
  }
  return map;
}

// Get operator map for display renderer (symbol -> name)
export function getSymbolToNameMap(): { [key: string]: string } {
  const map: { [key: string]: string } = {};
  for (const info of Object.values(OPERATOR_CONFIG)) {
    map[info.symbol] = info.name;
  }
  return map;
}

// Check if an operator is an integral type
export function isIntegralOperator(symbol: string): boolean {
  for (const info of Object.values(OPERATOR_CONFIG)) {
    if (info.symbol === symbol) {
      return info.isIntegral;
    }
  }
  return false;
}

// Get operator name from symbol
export function getOperatorName(symbol: string): string {
  for (const info of Object.values(OPERATOR_CONFIG)) {
    if (info.symbol === symbol) {
      return info.name;
    }
  }
  return 'unknown';
}