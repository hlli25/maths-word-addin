// Centralized configuration for all mathematical symbols and operators

// Symbol information with Unicode mapping and default styling
export interface SymbolInfo {
  unicode: string;
  defaultItalic: boolean; // true = italic by default (variables), false = upright by default (operators)
  isLargeOperator?: boolean; // true if it is a large operator (sum, prod, etc.)
  dataAttribute?: string; // data-operator attribute value for CSS targeting
  needsInlineScaling?: boolean; // true if operator needs CSS scaling in inline mode
}

// Symbol mappings with styling information
export const SYMBOL_CONFIG: { [key: string]: SymbolInfo } = {
  // Greek lowercase letters (italic by default)
  "\\alpha": { unicode: "α", defaultItalic: true },
  "\\beta": { unicode: "β", defaultItalic: true },
  "\\gamma": { unicode: "γ", defaultItalic: true },
  "\\delta": { unicode: "δ", defaultItalic: true },
  "\\epsilon": { unicode: "ε", defaultItalic: true },
  "\\varepsilon": { unicode: "ε", defaultItalic: true },
  "\\zeta": { unicode: "ζ", defaultItalic: true },
  "\\eta": { unicode: "η", defaultItalic: true },
  "\\theta": { unicode: "θ", defaultItalic: true },
  "\\vartheta": { unicode: "ϑ", defaultItalic: true },
  "\\iota": { unicode: "ι", defaultItalic: true },
  "\\kappa": { unicode: "κ", defaultItalic: true },
  "\\lambda": { unicode: "λ", defaultItalic: true },
  "\\mu": { unicode: "μ", defaultItalic: true },
  "\\nu": { unicode: "ν", defaultItalic: true },
  "\\xi": { unicode: "ξ", defaultItalic: true },
  "\\omicron": { unicode: "ο", defaultItalic: true },
  "\\pi": { unicode: "π", defaultItalic: true },
  "\\varpi": { unicode: "ϖ", defaultItalic: true },
  "\\rho": { unicode: "ρ", defaultItalic: true },
  "\\varrho": { unicode: "ϱ", defaultItalic: true },
  "\\sigma": { unicode: "σ", defaultItalic: true },
  "\\varsigma": { unicode: "ς", defaultItalic: true },
  "\\tau": { unicode: "τ", defaultItalic: true },
  "\\upsilon": { unicode: "υ", defaultItalic: true },
  "\\phi": { unicode: "φ", defaultItalic: true },
  "\\varphi": { unicode: "φ", defaultItalic: true },
  "\\chi": { unicode: "χ", defaultItalic: true },
  "\\psi": { unicode: "ψ", defaultItalic: true },
  "\\omega": { unicode: "ω", defaultItalic: true },
  
  // Greek uppercase letters (upright by default)
  "\\Gamma": { unicode: "Γ", defaultItalic: false },
  "\\Delta": { unicode: "Δ", defaultItalic: false },
  "\\Theta": { unicode: "Θ", defaultItalic: false },
  "\\Lambda": { unicode: "Λ", defaultItalic: false },
  "\\Pi": { unicode: "Π", defaultItalic: false },
  "\\Sigma": { unicode: "Σ", defaultItalic: false },
  "\\Upsilon": { unicode: "Υ", defaultItalic: false },
  "\\Phi": { unicode: "Φ", defaultItalic: false },
  "\\Chi": { unicode: "Χ", defaultItalic: false },
  "\\Psi": { unicode: "Ψ", defaultItalic: false },
  "\\Omega": { unicode: "Ω", defaultItalic: false },

  // Calculus symbols
  "\\partial": { unicode: "∂", defaultItalic: true },
  "\\nabla": { unicode: "∇", defaultItalic: false },
  "\\infty": { unicode: "∞", defaultItalic: false },
  
  // Arithmetic operators (upright by default)
  "\\times": { unicode: "×", defaultItalic: false },
  "\\divsymbol": { unicode: "÷", defaultItalic: false },  // Division symbol (Physics package - MathJax 3.0)
  "\\pm": { unicode: "±", defaultItalic: false },
  "\\mp": { unicode: "∓", defaultItalic: false },
  "\\cdot": { unicode: "·", defaultItalic: false },
  "\\ast": { unicode: "∗", defaultItalic: false },
  "\\star": { unicode: "⋆", defaultItalic: false },
  "\\circ": { unicode: "∘", defaultItalic: false },
  "\\bullet": { unicode: "•", defaultItalic: false },
  
  // Comparison and relations (upright by default)
  "\\neq": { unicode: "≠", defaultItalic: false },
  "\\sim": { unicode: "∼", defaultItalic: false },
  "\\simeq": { unicode: "≃", defaultItalic: false },
  "\\approx": { unicode: "≈", defaultItalic: false },
  "\\equiv": { unicode: "≡", defaultItalic: false },
  "\\cong": { unicode: "≅", defaultItalic: false },
  "\\ncong": { unicode: "≇", defaultItalic: false },
  "\\propto": { unicode: "∝", defaultItalic: false },
  "\\leq": { unicode: "≤", defaultItalic: false },
  "\\geq": { unicode: "≥", defaultItalic: false },
  "\\nless": { unicode: "≮", defaultItalic: false },
  "\\ngtr": { unicode: "≯", defaultItalic: false },
  "\\nleq": { unicode: "≰", defaultItalic: false },
  "\\ngeq": { unicode: "≱", defaultItalic: false },
  "\\prec": { unicode: "≺", defaultItalic: false },
  "\\succ": { unicode: "≻", defaultItalic: false },
  "\\preceq": { unicode: "⪯", defaultItalic: false },
  "\\succeq": { unicode: "⪰", defaultItalic: false },
  "\\ll": { unicode: "≪", defaultItalic: false },
  "\\gg": { unicode: "≫", defaultItalic: false },
  
  // Set operations (upright by default)
  "\\cap": { unicode: "∩", defaultItalic: false },
  "\\cup": { unicode: "∪", defaultItalic: false },
  "\\setminus": { unicode: "∖", defaultItalic: false },
  "\\in": { unicode: "∈", defaultItalic: false },
  "\\ni": { unicode: "∋", defaultItalic: false },
  "\\notin": { unicode: "∉", defaultItalic: false },
  "\\subset": { unicode: "⊂", defaultItalic: false },
  "\\supset": { unicode: "⊃", defaultItalic: false },
  "\\subseteq": { unicode: "⊆", defaultItalic: false },
  "\\supseteq": { unicode: "⊇", defaultItalic: false },
  "\\nsubseteq": { unicode: "⊈", defaultItalic: false },
  "\\nsupseteq": { unicode: "⊉", defaultItalic: false },
  "\\subsetneq": { unicode: "⊊", defaultItalic: false },
  "\\supsetneq": { unicode: "⊋", defaultItalic: false },
  
  // Binary operators (upright by default)
  "\\oplus": { unicode: "⊕", defaultItalic: false },
  "\\ominus": { unicode: "⊖", defaultItalic: false },
  "\\otimes": { unicode: "⊗", defaultItalic: false },
  "\\oslash": { unicode: "⊘", defaultItalic: false },
  "\\odot": { unicode: "⊙", defaultItalic: false },
  "\\triangleleft": { unicode: "◁", defaultItalic: false },
  "\\triangleright": { unicode: "▷", defaultItalic: false },
  "\\wr": { unicode: "≀", defaultItalic: false },
  
  // Logic operators (upright by default)
  "\\wedge": { unicode: "∧", defaultItalic: false },
  "\\vee": { unicode: "∨", defaultItalic: false },
  "\\vdash": { unicode: "⊢", defaultItalic: false },
  "\\models": { unicode: "⊨", defaultItalic: false },
  "\\top": { unicode: "⊤", defaultItalic: false },
  "\\bot": { unicode: "⊥", defaultItalic: false },
  
  // Miscellaneous symbols (upright by default)
  "\\bowtie": { unicode: "⋈", defaultItalic: false },
  "\\diamond": { unicode: "⋄", defaultItalic: false },
  "\\asymp": { unicode: "≍", defaultItalic: false },
  "\\triangleq": { unicode: "≜", defaultItalic: false },
  "\\therefore": { unicode: "∴", defaultItalic: false },
  "\\because": { unicode: "∵", defaultItalic: false },
  
  // Large operators (upright by default)
  "\\sum": {
    unicode: "∑",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "sum",
    needsInlineScaling: true,
  },
  "\\prod": {
    unicode: "∏",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "prod",
    needsInlineScaling: true,
  },
  "\\coprod": {
    unicode: "∐",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "coprod",
    needsInlineScaling: true,
  },
  "\\bigcup": {
    unicode: "∪",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "bigcup",
    needsInlineScaling: true,
  },
  "\\bigcap": {
    unicode: "∩",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "bigcap",
    needsInlineScaling: true,
  },
  "\\bigvee": {
    unicode: "∨",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "bigvee",
    needsInlineScaling: true,
  },
  "\\bigwedge": {
    unicode: "∧",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "bigwedge",
    needsInlineScaling: true,
  },
  "\\bigoplus": {
    unicode: "⨁",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "bigoplus",
    needsInlineScaling: true,
  },
  "\\bigotimes": {
    unicode: "⨂",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "bigotimes",
    needsInlineScaling: true,
  },
  "\\bigodot": {
    unicode: "⨀",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "bigodot",
    needsInlineScaling: true,
  },
  "\\biguplus": {
    unicode: "⨄",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "biguplus",
    needsInlineScaling: true,
  },
  "\\int": { 
    unicode: "∫",
    defaultItalic: false, 
    isLargeOperator: true, 
    dataAttribute: "int",
    // No inline scaling needed
  }, 
  "\\oint": { 
    unicode: "∮", 
    defaultItalic: false, 
    isLargeOperator: true, 
    dataAttribute: "oint",
    // No inline scaling needed 
  },
};

// Map LaTeX commands to Unicode symbols for easy lookup
const configMappings = Object.entries(SYMBOL_CONFIG).reduce(
  (acc, [latex, info]) => {
    acc[latex] = info.unicode;
    return acc;
  },
  {} as { [key: string]: string }
);

export const LATEX_TO_UNICODE: { [key: string]: string } = configMappings;

// Function to get symbol info with default styling
export function getSymbolInfo(latex: string): SymbolInfo | undefined {
  return SYMBOL_CONFIG[latex];
}

// Function to check if a symbol should be italic by default
export function isSymbolDefaultItalic(latex: string): boolean {
  const info = SYMBOL_CONFIG[latex];
  return info ? info.defaultItalic : false;
}

// Reverse mapping: Unicode to LaTeX
export const UNICODE_TO_LATEX: { [key: string]: string } = Object.entries(SYMBOL_CONFIG).reduce(
  (acc, [latex, info]) => {
    acc[info.unicode] = latex;
    return acc;
  },
  {} as { [key: string]: string }
);

// Helper functions for common operations

// Helper functions for large operators
export function getLargeOperators(): string[] {
  return Object.entries(SYMBOL_CONFIG)
    .filter(([_, info]) => info.isLargeOperator)
    .map(([latex, _]) => latex);
}

export function getOperatorsNeedingInlineScaling(): string[] {
  return Object.entries(SYMBOL_CONFIG)
    .filter(([_, info]) => info.isLargeOperator && info.needsInlineScaling)
    .map(([_, info]) => info.dataAttribute!)
    .filter(Boolean);
}

export function getDataAttributeForOperator(latex: string): string | undefined {
  const info = SYMBOL_CONFIG[latex];
  return info?.isLargeOperator ? info.dataAttribute : undefined;
}

// For backward compatibility, maintain the simple array of LaTeX commands
export const LARGE_OPERATORS = getLargeOperators();

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

// Map integral types to their corresponding Unicode symbols
export function getIntegralSymbol(integralType: "single" | "double" | "triple" | "contour"): string {
  switch (integralType) {
    case "single":
      return "∫";
    case "double":
      return "∬";
    case "triple":
      return "∭";
    case "contour":
      return "∮";
    default:
      return "∫";
  }
}

// Bracket pairs configuration for LaTeX processing
export interface BracketPair {
  left: string;
  right: string;
}

export const BRACKET_PAIRS: BracketPair[] = [
  { left: "(", right: ")" },
  { left: "[", right: "]" },
  { left: "{", right: "}" },
  { left: "\\{", right: "\\}" },
  { left: "\\langle", right: "\\rangle" },
  { left: "\\lfloor", right: "\\rfloor" },
  { left: "\\lceil", right: "\\rceil" },
  { left: "\\lvert", right: "\\rvert" },
  { left: "\\lVert", right: "\\rVert" },
  { left: "|", right: "|" },
  { left: "\\|", right: "\\|" }
];

// Integral commands for LaTeX processing
export const INTEGRAL_COMMANDS = [
  '\\inti', '\\intd',
  '\\iinti', '\\iintd', 
  '\\iiinti', '\\iiintd',
  '\\ointi', '\\ointd',
  '\\intil', '\\intdl',
  '\\iintil', '\\iintdl',
  '\\iiintil', '\\iiintdl', 
  '\\ointil', '\\ointdl'
];

// Validate brackets in text for mixed bracket pairs
export function hasMixedBrackets(text: string): boolean {
  if (!text || text.length === 0) return false;
  
  const foundBracketTypes = new Set<string>();
  
  // Check which bracket types are present in the text
  for (const pair of BRACKET_PAIRS) {
    if (text.includes(pair.left) || text.includes(pair.right)) {
      foundBracketTypes.add(`${pair.left}-${pair.right}`);
    }
  }
  
  // If more than one bracket type is found, it's mixed
  return foundBracketTypes.size > 1;
}

// Get the length of the longest LaTeX command that matches at a position
export function getLatexCommandLength(text: string, startIndex: number): number {
  // Check for matches starting with the longest possible commands
  const maxLength = 20;
  for (let len = Math.min(maxLength, text.length - startIndex); len >= 2; len--) {
    const substr = text.substr(startIndex, len);
    if (LATEX_TO_UNICODE[substr]) {
      return len;
    }
  }
  return 0;
}
