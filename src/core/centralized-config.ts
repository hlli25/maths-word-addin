// Centralized configuration for all mathematical symbols and operators

// Comprehensive function configuration
interface FunctionConfig {
  structureType: "simple" | "functionsub" | "functionlim" | "function";
  hasBuiltinLatex?: boolean; // whether it has a built-in LaTeX command like \sin
}

export const FUNCTION_CONFIG: { [key: string]: FunctionConfig } = {
  // Basic trigonometric functions
  "sin": { structureType: "simple", hasBuiltinLatex: true },
  "cos": { structureType: "simple", hasBuiltinLatex: true },
  "tan": { structureType: "simple", hasBuiltinLatex: true },
  "sec": { structureType: "simple", hasBuiltinLatex: true },
  "csc": { structureType: "simple", hasBuiltinLatex: true },
  "cot": { structureType: "simple", hasBuiltinLatex: true },
  // Inverse trigonometric functions (no built-in LaTeX)
  "asin": { structureType: "simple" },
  "acos": { structureType: "simple" },
  "atan": { structureType: "simple" },
  // Hyperbolic functions
  "sinh": { structureType: "simple", hasBuiltinLatex: true },
  "cosh": { structureType: "simple", hasBuiltinLatex: true },
  "tanh": { structureType: "simple", hasBuiltinLatex: true },
  // Inverse hyperbolic functions (no built-in LaTeX)
  "asinh": { structureType: "simple" },
  "acosh": { structureType: "simple" },
  "atanh": { structureType: "simple" },
  // Logarithmic functions
  "log": { structureType: "simple", hasBuiltinLatex: true },
  "logn": { structureType: "functionsub" }, // log with subscript base
  "ln": { structureType: "simple", hasBuiltinLatex: true },
  // Limit operators
  "max": { structureType: "functionlim", hasBuiltinLatex: true },
  "min": { structureType: "functionlim", hasBuiltinLatex: true },
  "lim": { structureType: "functionlim", hasBuiltinLatex: true },
  "argmax": { structureType: "functionlim" },
  "argmin": { structureType: "functionlim" },
  // General function types for user-defined functions
  "function": { structureType: "function" },
  "functionsub": { structureType: "functionsub" },
  "functionlim": { structureType: "functionlim" }
};

// Derived arrays for backward compatibility
export const FUNCTION_TYPE_MAP: { [key: string]: string } = Object.entries(FUNCTION_CONFIG).reduce(
  (acc, [name, config]) => {
    acc[name] = config.structureType;
    return acc;
  },
  {} as { [key: string]: string }
);

export const FUNCTION_NAMES = Object.keys(FUNCTION_CONFIG).filter(name => 
  !["function", "functionsub", "functionlim"].includes(name)
);

export const BUILTIN_FUNCTION_COMMANDS = Object.entries(FUNCTION_CONFIG)
  .filter(([_, config]) => config.hasBuiltinLatex)
  .map(([name, _]) => `\\${name}`);

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

  // Greek uppercase letters 
  // Letters with LaTeX commands
  "\\Gamma": { unicode: "Γ", defaultItalic: false },
  "\\Delta": { unicode: "Δ", defaultItalic: false },
  "\\Theta": { unicode: "Θ", defaultItalic: false },
  "\\Lambda": { unicode: "Λ", defaultItalic: false },
  "\\Xi": { unicode: "Ξ", defaultItalic: false },
  "\\Pi": { unicode: "Π", defaultItalic: false },
  "\\Sigma": { unicode: "Σ", defaultItalic: false },
  "\\Upsilon": { unicode: "Υ", defaultItalic: false },
  "\\Phi": { unicode: "Φ", defaultItalic: false },
  "\\Psi": { unicode: "Ψ", defaultItalic: false },
  "\\Omega": { unicode: "Ω", defaultItalic: false },
  
  // Letters without LaTeX commands (use Unicode as keys for direct insertion)
  "Α": { unicode: "Α", defaultItalic: false },
  "Β": { unicode: "Β", defaultItalic: false },
  "Ε": { unicode: "Ε", defaultItalic: false },
  "Ζ": { unicode: "Ζ", defaultItalic: false },
  "Η": { unicode: "Η", defaultItalic: false },
  "Ι": { unicode: "Ι", defaultItalic: false },
  "Κ": { unicode: "Κ", defaultItalic: false },
  "Μ": { unicode: "Μ", defaultItalic: false },
  "Ν": { unicode: "Ν", defaultItalic: false },
  "Ο": { unicode: "Ο", defaultItalic: false },
  "Ρ": { unicode: "Ρ", defaultItalic: false },
  "Τ": { unicode: "Τ", defaultItalic: false },
  "Χ": { unicode: "Χ", defaultItalic: false },

  // Calculus symbols
  "\\partial": { unicode: "∂", defaultItalic: true },
  "\\nabla": { unicode: "∇", defaultItalic: false },
  "\\infty": { unicode: "∞", defaultItalic: false },

  // Arithmetic operators (upright by default)
  "\\times": { unicode: "×", defaultItalic: false },
  "\\divsymbol": { unicode: "÷", defaultItalic: false }, // Division symbol (Physics package - MathJax 3.0)
  "\\pm": { unicode: "±", defaultItalic: false },
  "\\mp": { unicode: "∓", defaultItalic: false },
  "\\cdot": { unicode: "·", defaultItalic: false },
  "\\ast": { unicode: "∗", defaultItalic: false },
  "\\star": { unicode: "⋆", defaultItalic: false },
  "\\circ": { unicode: "∘", defaultItalic: false },
  "\\bullet": { unicode: "•", defaultItalic: false },

  // Comparison and relations (upright by default)
  "=": { unicode: "=", defaultItalic: false },
  "<": { unicode: "<", defaultItalic: false },
  ">": { unicode: ">", defaultItalic: false },
  "+": { unicode: "+", defaultItalic: false },
  "-": { unicode: "-", defaultItalic: false },
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

  // Arrow symbols (upright by default)
  "\\rightarrow": { unicode: "→", defaultItalic: false },
  "\\leftarrow": { unicode: "←", defaultItalic: false },
  "\\uparrow": { unicode: "↑", defaultItalic: false },
  "\\downarrow": { unicode: "↓", defaultItalic: false },
  "\\leftrightarrow": { unicode: "↔", defaultItalic: false },
  "\\updownarrow": { unicode: "↕", defaultItalic: false },
  "\\nearrow": { unicode: "↗", defaultItalic: false },
  "\\searrow": { unicode: "↘", defaultItalic: false },
  "\\Rightarrow": { unicode: "⇒", defaultItalic: false },
  "\\Leftarrow": { unicode: "⇐", defaultItalic: false },
  "\\Uparrow": { unicode: "⇑", defaultItalic: false },
  "\\Downarrow": { unicode: "⇓", defaultItalic: false },
  "\\Leftrightarrow": { unicode: "⇔", defaultItalic: false },
  "\\Updownarrow": { unicode: "⇕", defaultItalic: false },
  "\\longrightarrow": { unicode: "⟶", defaultItalic: false },
  "\\longleftarrow": { unicode: "⟵", defaultItalic: false },
  "\\longleftrightarrow": { unicode: "⟷", defaultItalic: false },
  "\\Longrightarrow": { unicode: "⟹", defaultItalic: false },
  "\\Longleftarrow": { unicode: "⟸", defaultItalic: false },
  "\\Longleftrightarrow": { unicode: "⟺", defaultItalic: false },
  "\\circlearrowleft": { unicode: "↺", defaultItalic: false },
  "\\circlearrowright": { unicode: "↻", defaultItalic: false },
  "\\curvearrowleft": { unicode: "↶", defaultItalic: false },
  "\\curvearrowright": { unicode: "↷", defaultItalic: false },
  "\\hookleftarrow": { unicode: "↩", defaultItalic: false },
  "\\hookrightarrow": { unicode: "↪", defaultItalic: false },

  // Miscellaneous symbols (upright by default)
  "\\bowtie": { unicode: "⋈", defaultItalic: false },
  "\\diamond": { unicode: "⋄", defaultItalic: false },
  "\\asymp": { unicode: "≍", defaultItalic: false },
  "\\triangleq": { unicode: "≜", defaultItalic: false },
  "\\therefore": { unicode: "∴", defaultItalic: false },
  "\\because": { unicode: "∵", defaultItalic: false },

  // Logic symbols (upright by default)
  "\\forall": { unicode: "∀", defaultItalic: false },
  "\\exists": { unicode: "∃", defaultItalic: false },
  "\\nexists": { unicode: "∄", defaultItalic: false },
  "\\emptyset": { unicode: "∅", defaultItalic: false },
  "\\varnothing": { unicode: "∅", defaultItalic: false },

  // Letter-like symbols (upright by default)
  "\\mathbb{R}": { unicode: "ℝ", defaultItalic: false },
  "\\mathbb{Z}": { unicode: "ℤ", defaultItalic: false },
  "\\mathbb{Q}": { unicode: "ℚ", defaultItalic: false },
  "\\mathbb{N}": { unicode: "ℕ", defaultItalic: false },
  "\\mathbb{C}": { unicode: "ℂ", defaultItalic: false },
  "\\mathbb{H}": { unicode: "ℍ", defaultItalic: false },
  "\\mathbb{P}": { unicode: "ℙ", defaultItalic: false },
  "\\wp": { unicode: "℘", defaultItalic: false },
  "\\aleph": { unicode: "ℵ", defaultItalic: false },
  "\\beth": { unicode: "ℶ", defaultItalic: false },
  "\\gimel": { unicode: "ℷ", defaultItalic: false },
  "\\daleth": { unicode: "ℸ", defaultItalic: false },

  // Geometry symbols (upright by default)
  "\\angle": { unicode: "∠", defaultItalic: false },
  "\\measuredangle": { unicode: "∡", defaultItalic: false },
  "\\sphericalangle": { unicode: "∢", defaultItalic: false },
  "\\parallel": { unicode: "∥", defaultItalic: false },
  "\\nparallel": { unicode: "∦", defaultItalic: false },
  "\\triangle": { unicode: "△", defaultItalic: false },
  "\\square": { unicode: "□", defaultItalic: false },
  "\\blacksquare": { unicode: "■", defaultItalic: false },
  "\\lozenge": { unicode: "◊", defaultItalic: false },
  "\\blacklozenge": { unicode: "⧫", defaultItalic: false },
  "\\bigcirc": { unicode: "○", defaultItalic: false },
  "\\degree": { unicode: "°", defaultItalic: false },

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
    unicode: "⋃",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "bigcup",
    needsInlineScaling: true,
  },
  "\\bigcap": {
    unicode: "⋂",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "bigcap",
    needsInlineScaling: true,
  },
  "\\bigvee": {
    unicode: "⋁",
    defaultItalic: false,
    isLargeOperator: true,
    dataAttribute: "bigvee",
    needsInlineScaling: true,
  },
  "\\bigwedge": {
    unicode: "⋀",
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
  leftDisplay: string;  // Display character for left bracket
  rightDisplay: string; // Display character for right bracket
}

export const BRACKET_PAIRS: BracketPair[] = [
  { left: "(", right: ")", leftDisplay: "(", rightDisplay: ")" },
  { left: "[", right: "]", leftDisplay: "[", rightDisplay: "]" },
  { left: "{", right: "}", leftDisplay: "{", rightDisplay: "}" },
  { left: "\\{", right: "\\}", leftDisplay: "{", rightDisplay: "}" },
  { left: "\\langle", right: "\\rangle", leftDisplay: "⟨", rightDisplay: "⟩" },
  { left: "\\lfloor", right: "\\rfloor", leftDisplay: "⌊", rightDisplay: "⌋" },
  { left: "\\lceil", right: "\\rceil", leftDisplay: "⌈", rightDisplay: "⌉" },
  { left: "\\lvert", right: "\\rvert", leftDisplay: "|", rightDisplay: "|" },
  { left: "\\lVert", right: "\\rVert", leftDisplay: "‖", rightDisplay: "‖" },
  { left: "|", right: "|", leftDisplay: "|", rightDisplay: "|" },
  { left: "\\|", right: "\\|", leftDisplay: "‖", rightDisplay: "‖" },
];

// Integral commands for LaTeX processing
export const INTEGRAL_COMMANDS = [
  // Indefinite integrals (2 parameters)
  "\\inti", "\\intd",
  "\\iinti", "\\iintd", 
  "\\iiinti", "\\iiintd",
  "\\ointi", "\\ointd",
  
  // Multiple integrals with subscript (3 parameters)
  "\\intisub", "\\intdsub",
  "\\iintisub", "\\iintdsub",
  "\\iiintisub", "\\iiintdsub",
  "\\ointisub", "\\ointdsub",
  
  // Multiple integrals with lower limit (3 parameters)
  "\\iintilower", "\\iintdlower",
  "\\iiintilower", "\\iiintdlower",
  
  // Definite integrals - no limits (4 parameters)
  "\\intinolim", "\\intdnolim",
  "\\iintinolim", "\\iintdnolim",
  "\\iiintinolim", "\\iiintdnolim",
  "\\ointinolim", "\\ointdnolim",
  
  // Definite integrals - with limits (4 parameters)
  "\\intilim", "\\intdlim",
  "\\iintilim", "\\iintdlim",
  "\\iiintilim", "\\iiintdlim",
];

// Helper functions for bracket matching
export function getBracketPairMap(): { [key: string]: string } {
  const map: { [key: string]: string } = {};
  BRACKET_PAIRS.forEach(pair => {
    map[pair.leftDisplay] = pair.rightDisplay;
  });
  return map;
}

export function getOpenBrackets(): Set<string> {
  const set = new Set<string>();
  BRACKET_PAIRS.forEach(pair => {
    set.add(pair.leftDisplay);
  });
  return set;
}

export function getCloseBrackets(): Set<string> {
  const set = new Set<string>();
  BRACKET_PAIRS.forEach(pair => {
    set.add(pair.rightDisplay);
  });
  return set;
}

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

// Structure navigation field configuration
export const STRUCTURE_FIELD_LISTS: { [structureType: string]: string[] } = {
  "fraction": ["numerator", "denominator"],
  "bevelled-fraction": ["numerator", "denominator"],
  "nthroot": ["radicand", "index"],
  "script": ["base", "superscript", "subscript"],
  "integral": ["upperLimit", "lowerLimit", "integrand", "differentialVariable"],
  "derivative": ["order", "function", "variable"],
  "large-operator": ["lowerLimit", "upperLimit", "operand"],
  "function": ["functionName", "functionConstraint", "functionBase", "functionArgument"],
  "accent": ["accentBase", "accentLabel"],
  "matrix": [], // Dynamic based on rows/cols
  "stack": [],  // Dynamic based on rows/cols
  "cases": []   // Dynamic based on rows/cols
};

// Helper function to check if an element is a navigable structure
export function isNavigableStructure(elementType: string): boolean {
  return elementType in STRUCTURE_FIELD_LISTS;
}

// Function to get structure fields for navigation
export function getStructureNavigationFields(element: any): string[] {
  const baseFields = STRUCTURE_FIELD_LISTS[element.type] || [];
  
  // Handle dynamic fields for matrix-like structures
  if (element.type === "matrix" || element.type === "stack" || element.type === "cases") {
    const fields = [];
    if (element.cells) {
      for (let row = 0; row < element.rows; row++) {
        for (let col = 0; col < element.cols; col++) {
          fields.push(`cell_${row}_${col}`);
        }
      }
    }
    return fields;
  }
  
  // Filter out fields that don't exist on this specific element
  return baseFields.filter(field => {
    if (field === "superscript") return element.superscript;
    if (field === "subscript") return element.subscript;
    if (field === "upperLimit") return element.upperLimit;
    if (field === "lowerLimit") return element.lowerLimit;
    if (field === "order") return Array.isArray(element.order);
    if (field === "functionName") return ["function", "functionsub", "functionlim"].includes(element.functionType || "");
    if (field === "functionConstraint") return element.functionConstraint;
    if (field === "functionBase") return element.functionBase;
    if (field === "accentLabel") return element.accentLabel; // Only include if accent has a label
    return true; // Include field by default
  });
}
