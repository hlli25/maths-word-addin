// Centralized configuration for all mathematical symbols and operators

// LaTeX to Unicode symbol mappings
// Includes all mathematical symbols, operators, relations, etc.
export const LATEX_TO_UNICODE: { [key: string]: string } = {
  // Basic arithmetic operators
  "\\times": "×",
  "\\divsymbol": "÷",  // Division symbol (Physics package)
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

  // Calculus operators
  "\\partial": "∂",
  "\\infty": "∞",
  // Physics package symbols
  "\\div": "∇",
  
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
  
  // Large operators
  "\\sum": "∑",
  "\\prod": "∏",
  "\\coprod": "∐",
  "\\bigcup": "∪",
  "\\bigcap": "∩",
  "\\bigvee": "∨",
  "\\bigwedge": "∧",
  "\\bigoplus": "⨁",
  "\\bigotimes": "⨂",
  "\\bigodot": "⨀",
  "\\biguplus": "⨄",
  "\\int": "∫",
  "\\oint": "∮",
  
  // Greek letters - lowercase
  "\\alpha": "α",
  "\\beta": "β",
  "\\gamma": "γ",
  "\\delta": "δ",
  "\\epsilon": "ϵ",
  "\\varepsilon": "ε",
  "\\zeta": "ζ",
  "\\eta": "η",
  "\\theta": "θ",
  "\\vartheta": "ϑ",
  "\\iota": "ι",
  "\\kappa": "κ",
  "\\lambda": "λ",
  "\\mu": "μ",
  "\\nu": "ν",
  "\\xi": "ξ",
  "\\omicron": "ο",
  "\\pi": "π",
  "\\varpi": "ϖ",
  "\\rho": "ρ",
  "\\varrho": "ϱ",
  "\\sigma": "σ",
  "\\varsigma": "ς",
  "\\tau": "τ",
  "\\upsilon": "υ",
  "\\phi": "ϕ",
  "\\varphi": "φ",
  "\\chi": "χ",
  "\\psi": "ψ",
  "\\omega": "ω",
  
  // Greek letters - uppercase
  "\\Gamma": "Γ",
  "\\Delta": "Δ",
  "\\Theta": "Θ",
  "\\Lambda": "Λ",
  "\\Pi": "Π",
  "\\Sigma": "Σ",
  "\\Upsilon": "Υ",
  "\\Phi": "Φ",
  "\\Psi": "Ψ",
  "\\Omega": "Ω",
};

// Reverse mapping: Unicode to LaTeX
export const UNICODE_TO_LATEX: { [key: string]: string } = Object.entries(LATEX_TO_UNICODE).reduce(
  (acc, [latex, unicode]) => {
    acc[unicode] = latex;
    return acc;
  },
  {} as { [key: string]: string }
);

// Helper functions for common operations

// Centralized list of large operators for easy maintenance
export const LARGE_OPERATORS = [
  "\\sum", "\\prod", "\\coprod", "\\bigcup", "\\bigcap", 
  "\\bigvee", "\\bigwedge", "\\bigoplus", "\\bigotimes", 
  "\\bigodot", "\\biguplus", "\\int", "\\oint"
];

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