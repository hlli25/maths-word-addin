// Centralized configuration for all mathematical symbols and operators

// LaTeX to Unicode symbol mappings
// Includes all mathematical symbols, operators, relations, etc.
export const LATEX_TO_UNICODE: { [key: string]: string } = {
  // Basic arithmetic operators
  "\\times": "×",
  "\\div": "÷",
  "\\pm": "±",
  "\\mp": "∓",
  "\\cdot": "·",
  "\\ast": "∗",
  "\\star": "⋆",
  "\\circ": "∘",
  "\\bullet": "•",
  
  // Comparison and relations
  "\\neq": "≠",
  "\\sim": "∼",
  "\\simeq": "≃",
  "\\approx": "≈",
  "\\equiv": "≡",
  "\\cong": "≅",
  "\\ncong": "≇",
  "\\propto": "∝",
  "\\leq": "≤",
  "\\geq": "≥",
  "\\nless": "≮",
  "\\ngtr": "≯",
  "\\nleq": "≰",
  "\\ngeq": "≱",
  "\\prec": "≺",
  "\\succ": "≻",
  "\\preceq": "⪯",
  "\\succeq": "⪰",
  "\\ll": "≪",
  "\\gg": "≫",
  
  // Set operations
  "\\cap": "∩",
  "\\cup": "∪",
  "\\setminus": "∖",
  "\\in": "∈",
  "\\ni": "∋",
  "\\notin": "∉",
  "\\subset": "⊂",
  "\\supset": "⊃",
  "\\subseteq": "⊆",
  "\\supseteq": "⊇",
  "\\nsubseteq": "⊈",
  "\\nsupseteq": "⊉",
  "\\subsetneq": "⊊",
  "\\supsetneq": "⊋",
  
  // Binary operators
  "\\oplus": "⊕",
  "\\ominus": "⊖",
  "\\otimes": "⊗",
  "\\oslash": "⊘",
  "\\odot": "⊙",
  "\\triangleleft": "◁",
  "\\triangleright": "▷",
  "\\wr": "≀",
  
  // Logic operators
  "\\wedge": "∧",
  "\\vee": "∨",
  "\\vdash": "⊢",
  "\\models": "⊨",
  "\\top": "⊤",
  "\\bot": "⊥",
  
  // Miscellaneous symbols
  "\\bowtie": "⋈",
  "\\diamond": "⋄",
  "\\asymp": "≍",
  "\\triangleq": "≜",
  "\\therefore": "∴",
  "\\because": "∵",
};

// Configuration for large operators (sum, integral, etc.)
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

// Reverse mapping: Unicode to LaTeX
export const UNICODE_TO_LATEX: { [key: string]: string } = Object.entries(LATEX_TO_UNICODE).reduce(
  (acc, [latex, unicode]) => {
    acc[unicode] = latex;
    return acc;
  },
  {} as { [key: string]: string }
);

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

// Convert LaTeX command to Unicode symbol
export function latexToUnicode(latex: string): string | undefined {
  return LATEX_TO_UNICODE[latex];
}

// Convert Unicode symbol to LaTeX command
export function unicodeToLatex(unicode: string): string | undefined {
  return UNICODE_TO_LATEX[unicode];
}

// Check if a string is a LaTeX command that maps to a symbol
export function isLatexSymbolCommand(latex: string): boolean {
  return latex in LATEX_TO_UNICODE;
}

// Get the length of the longest LaTeX command that matches at a position
export function getLatexCommandLength(text: string, startIndex: number): number {
  // Check for matches starting with the longest possible commands
  const maxLength = 15; // Longest command is about 13 chars (\\triangleright)
  for (let len = Math.min(maxLength, text.length - startIndex); len >= 2; len--) {
    const substr = text.substr(startIndex, len);
    if (LATEX_TO_UNICODE[substr]) {
      return len;
    }
  }
  return 0;
}