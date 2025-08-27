// Equation element types and builder functionality
import { getBracketPairMap, getOpenBrackets, getCloseBrackets } from './centralized-config';

export interface EquationElement {
  id: string;
  type:
    | "text"
    | "fraction"
    | "bevelled-fraction"
    | "sqrt"
    | "nthroot"
    | "script"
    | "bracket"
    | "large-operator"
    | "derivative"
    | "integral"
    | "differential"
    | "matrix"
    | "stack"
    | "cases"
    | "wrapper"
    | "accent"
    | "function";
  value?: string;
  // for fraction and bevelled-fraction
  numerator?: EquationElement[];
  denominator?: EquationElement[];
  // for sqrt and nthroot
  radicand?: EquationElement[];
  // for nthroot
  index?: EquationElement[];
  // for script
  base?: EquationElement[];
  superscript?: EquationElement[];
  subscript?: EquationElement[];
  // for bracket
  content?: EquationElement[];
  leftBracketSymbol?: string;
  rightBracketSymbol?: string;
  scaleFactor?: number;
  // for large operators (sum, product, union, intersection, etc. & definite integral)
  operator?: string;
  displayMode?: "inline" | "display";
  limitMode?: "default" | "nolimits" | "limits"; // how to position limits
  lowerLimit?: EquationElement[];
  upperLimit?: EquationElement[];
  operand?: EquationElement[]; // the expression after the operator
  // text formatting
  bold?: boolean;
  italic?: boolean;
  underline?: "single" | "double";
  strikethrough?: boolean;
  cancel?: boolean;
  color?: string;
  textMode?: boolean;
  // for derivative (df/dx)
  order?: number | EquationElement[]; // derivative order (1 or n for nth)
  function?: EquationElement[]; // f in df/dx
  variable?: EquationElement[]; // x in df/dx
  isLongForm?: boolean; // true for \dv{x}(\grande{f}) format
  isPartial?: boolean; // true for partial derivatives (∂f/∂x)
  // for integral (flexible format with single content area)
  content?: EquationElement[]; // Full integral content (user places differential anywhere)
  integralStyle?: "italic" | "roman"; // style for d when exporting
  isDefinite?: boolean; // whether this is a definite integral
  integralType?: "single" | "double" | "triple" | "contour"; // type of integral (may extend in future)
  // for differential (standalone d + variable like dx, dy, dt)
  differentialStyle?: "italic" | "roman"; // style for d
  variable?: EquationElement[]; // the variable part (x, y, t, etc.)
  // for matrix
  matrixType?: "parentheses" | "brackets" | "braces" | "bars" | "double-bars" | "none";
  rows?: number;
  cols?: number;
  cells?: Record<string, EquationElement[]>; // Object with keys like cell_0_0, cell_1_0, etc.
  // for stack (vertical arrangement without brackets)
  stackType?: "plain"; // Plain vertical arrangement using array environment
  // for cases (piecewise functions with left brace)
  casesType?: "cases"; // Piecewise functions with left curly brace
  // for accent
  accentType?:
    | "hat"
    | "tilde"
    | "bar"
    | "dot"
    | "ddot"
    | "vec"
    | "widehat"
    | "widetilde"
    | "widebar"
    | "overrightarrow"
    | "overleftarrow"
    | "overleftrightarrow"
    | "overbrace"
    | "underbrace"
    | "labeledoverbrace"
    | "labeledunderbrace"
    | "overparen"
    | "underparen";
  accentPosition?: "over" | "under";
  accentBase?: EquationElement[]; // Content under/over the accent
  accentLabel?: EquationElement[]; // Optional label for braces
  // for function
  functionType?: string; // Type of function
  functionName?: EquationElement[];
  functionArgument?: EquationElement[]; // Main argument of the function
  functionBase?: EquationElement[]; // Base/subscript for functions like log_n
  functionConstraint?: EquationElement[]; // Constraint for limit functions
  // For elements that are part of wrapper groups (multi-wrapper support)
  wrappers?: {
    underline?: { id: string; type: "single" | "double" };
    cancel?: { id: string };
    color?: { id: string; value: string };
    textMode?: { id: string };
  };
  // Order in which wrappers were applied by the user
  wrapperOrder?: string[];
}

export class EquationBuilder {
  private equation: EquationElement[] = [];
  private elementIdCounter = 0;

  constructor() {
    this.clear();
  }

  getEquation(): EquationElement[] {
    return this.equation;
  }

  setEquation(equation: EquationElement[]): void {
    this.equation = equation;
  }

  clear(): void {
    this.equation = [];
    this.elementIdCounter = 0;
  }

  isEmpty(): boolean {
    return this.equation.length === 0;
  }

  public generateElementId(): string {
    return `element-${this.elementIdCounter++}`;
  }

  insertElement(element: EquationElement, context: EquationElement[], position: number): void {
    context.splice(position, 0, element);
  }

  removeElement(context: EquationElement[], position: number): void {
    if (position >= 0 && position < context.length) {
      context.splice(position, 1);
    }
  }

  createTextElement(text: string): EquationElement {
    return {
      id: this.generateElementId(),
      type: "text",
      value: text,
    };
  }

  createFractionElement(): EquationElement {
    return {
      id: this.generateElementId(),
      type: "fraction",
      numerator: [],
      denominator: [],
    };
  }

  createDisplayFractionElement(): EquationElement {
    return {
      id: this.generateElementId(),
      type: "fraction",
      numerator: [],
      denominator: [],
      displayMode: "display",
    };
  }

  createBevelledFractionElement(): EquationElement {
    return {
      id: this.generateElementId(),
      type: "bevelled-fraction",
      numerator: [],
      denominator: [],
    };
  }

  createSquareRootElement(): EquationElement {
    return {
      id: this.generateElementId(),
      type: "sqrt",
      radicand: [],
    };
  }

  createNthRootElement(): EquationElement {
    return {
      id: this.generateElementId(),
      type: "nthroot",
      index: [],
      radicand: [],
    };
  }

  createScriptElement(hasSuper: boolean = false, hasSub: boolean = false): EquationElement {
    return {
      id: this.generateElementId(),
      type: "script",
      base: [],
      superscript: hasSuper ? [] : undefined,
      subscript: hasSub ? [] : undefined,
    };
  }

  createBracketElement(leftSymbol: string, rightSymbol: string): EquationElement {
    return {
      id: this.generateElementId(),
      type: "bracket",
      leftBracketSymbol: leftSymbol,
      rightBracketSymbol: rightSymbol,
      content: [],
    };
  }

  createEvaluationBracketElement(bracketType: "bar" | "square"): EquationElement {
    // Bar evaluation: \left.{F}\right|^{b}_{a}
    // Square evaluation: \left[{F}\right]^{b}_{a}
    const leftSymbol = bracketType === "bar" ? "." : "[";
    const rightSymbol = bracketType === "bar" ? "|" : "]";
    
    return {
      id: this.generateElementId(),
      type: "bracket",
      leftBracketSymbol: leftSymbol,
      rightBracketSymbol: rightSymbol,
      content: [],
      superscript: [],
      subscript: [],
    };
  }

  createLargeOperatorElement(
    operator: string,
    displayMode: "inline" | "display" = "inline",
    limitMode: "default" | "nolimits" | "limits" = "default"
  ): EquationElement {
    return {
      id: this.generateElementId(),
      type: "large-operator",
      operator: operator,
      displayMode: displayMode,
      limitMode: limitMode,
      lowerLimit: [],
      upperLimit: [],
      operand: [],
    };
  }

  createDerivativeElement(
    order: number | EquationElement[] = 1,
    displayMode: "inline" | "display" = "inline",
    isLongForm: boolean = false,
    isPartial: boolean = false
  ): EquationElement {
    return {
      id: this.generateElementId(),
      type: "derivative",
      order: order,
      displayMode: displayMode,
      function: [],
      variable: [],
      isLongForm: isLongForm,
      isPartial: isPartial,
    };
  }

  createIntegralElement(
    integralType: "single" | "double" | "triple" | "contour" = "single",
    displayMode: "inline" | "display" = "inline",
    integralStyle: "italic" | "roman" = "italic",
    isDefinite: boolean = false,
    limitMode: "default" | "nolimits" | "limits" = "default",
    limitConfig: "both" | "lower-only" | "upper-only" | "none" = "both"
  ): EquationElement {
    let lowerLimit: EquationElement[] | undefined = undefined;
    let upperLimit: EquationElement[] | undefined = undefined;

    if (isDefinite) {
      switch (limitConfig) {
        case "both":
          lowerLimit = [];
          upperLimit = [];
          break;
        case "lower-only":
          lowerLimit = [];
          break;
        case "upper-only":
          upperLimit = [];
          break;
        case "none":
          // No limits
          break;
      }
    }

    return {
      id: this.generateElementId(),
      type: "integral",
      integralType: integralType,
      displayMode: displayMode,
      integralStyle: integralStyle,
      isDefinite: isDefinite,
      limitMode: limitMode,
      content: [], // Single content area for flexible differential placement
      lowerLimit: lowerLimit,
      upperLimit: upperLimit,
    };
  }

  createDifferentialElement(
    differentialStyle: "italic" | "roman" = "italic"
  ): EquationElement {
    return {
      id: this.generateElementId(),
      type: "differential",
      differentialStyle: differentialStyle,
      variable: [], // Empty array for user to type variable (x, y, t, etc.)
    };
  }

  createMatrixElement(
    rows: number,
    cols: number,
    matrixType:
      | "parentheses"
      | "brackets"
      | "braces"
      | "bars"
      | "double-bars"
      | "none" = "parentheses"
  ): EquationElement {
    // Create cells object with keys like "cell_0_0", "cell_0_1", etc.
    const cells: { [key: string]: EquationElement[] } = {};
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        cells[`cell_${row}_${col}`] = [];
      }
    }

    return {
      id: this.generateElementId(),
      type: "matrix",
      matrixType: matrixType,
      rows: rows,
      cols: cols,
      cells: cells,
    };
  }

  createStackElement(
    rows: number,
    cols: number = 1
  ): EquationElement {
    // Create cells object with keys like "cell_0_0", "cell_0_1", etc.
    const cells: { [key: string]: EquationElement[] } = {};
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        cells[`cell_${row}_${col}`] = [];
      }
    }

    return {
      id: this.generateElementId(),
      type: "stack",
      stackType: "plain",
      rows: rows,
      cols: cols,
      cells: cells,
    };
  }

  createCasesElement(
    rows: number,
    cols: number = 2
  ): EquationElement {
    // Create cells object with keys like "cell_0_0", "cell_0_1", etc.
    const cells: { [key: string]: EquationElement[] } = {};
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        cells[`cell_${row}_${col}`] = [];
      }
    }

    return {
      id: this.generateElementId(),
      type: "cases",
      casesType: "cases",
      rows: rows,
      cols: cols,
      cells: cells,
    };
  }

  findElementById(elements: EquationElement[], id: string): EquationElement | null {
    for (const el of elements) {
      if (el.id === id) return el;
      if (el.type === "fraction" || el.type === "bevelled-fraction") {
        const found = this.findElementById(el.numerator!, id) || this.findElementById(el.denominator!, id);
        if (found) return found;
      }
      if (el.type === "sqrt") {
        const found = this.findElementById(el.radicand!, id);
        if (found) return found;
      }
      if (el.type === "nthroot") {
        const found = this.findElementById(el.index!, id) || this.findElementById(el.radicand!, id);
        if (found) return found;
      }
      if (el.type === "script") {
        const found =
          this.findElementById(el.base || [], id) ||
          this.findElementById(el.superscript || [], id) ||
          this.findElementById(el.subscript || [], id);
        if (found) return found;
      }
      if (el.type === "bracket") {
        const found = this.findElementById(el.content || [], id);
        if (found) return found;
      }
      if (el.type === "large-operator") {
        const found =
          this.findElementById(el.lowerLimit || [], id) ||
          this.findElementById(el.upperLimit || [], id) ||
          this.findElementById(el.operand || [], id);
        if (found) return found;
      }
      if (el.type === "derivative") {
        const found =
          this.findElementById(el.function || [], id) ||
          this.findElementById(el.variable || [], id) ||
          (Array.isArray(el.order) ? this.findElementById(el.order, id) : null);
        if (found) return found;
      }
      if (el.type === "integral") {
        const found =
          this.findElementById(el.content || [], id) ||
          this.findElementById(el.lowerLimit || [], id) ||
          this.findElementById(el.upperLimit || [], id);
        if (found) return found;
      }
      if (el.type === "differential") {
        const found = this.findElementById(el.variable || [], id);
        if (found) return found;
      }
      if (el.type === "matrix" || el.type === "stack" || el.type === "cases") {
        if (el.cells) {
          for (const cellKey in el.cells) {
            if (cellKey.startsWith("cell_")) {
              const found = this.findElementById(el.cells[cellKey], id);
              if (found) return found;
            }
          }
        }
      }
      if (el.type === "accent") {
        const found =
          this.findElementById(el.accentBase || [], id) ||
          this.findElementById(el.accentLabel || [], id);
        if (found) return found;
      }
      if (el.type === "function") {
        const found =
          this.findElementById(el.functionArgument || [], id) ||
          this.findElementById(el.functionBase || [], id) ||
          this.findElementById(el.functionConstraint || [], id) ||
          this.findElementById(el.functionName || [], id);
        if (found) return found;
      }
    }
    return null;
  }

  updateParenthesesScaling(): void {
    this.updateParenthesesScalingRecursive(this.equation);
  }

  updateBracketNesting(): void {
    this.updateBracketNestingRecursive(this.equation, 0);
  }

  private calculateContentHeight(content: EquationElement[]): number {
    // Create a temporary container for measurement
    const measureContainer = document.createElement('div');
    measureContainer.style.position = 'absolute';
    measureContainer.style.visibility = 'hidden';
    measureContainer.style.whiteSpace = 'nowrap';
    measureContainer.style.fontSize = '16px'; // Base font size
    measureContainer.style.fontFamily = 'Cambria Math, serif';
    document.body.appendChild(measureContainer);

    // Create baseline text element for comparison
    const baselineElement = document.createElement('span');
    baselineElement.textContent = 'x';
    baselineElement.style.fontSize = '16px';
    measureContainer.appendChild(baselineElement);
    const baselineHeight = baselineElement.getBoundingClientRect().height;
    measureContainer.removeChild(baselineElement);

    // Create content elements and measure
    const contentElement = document.createElement('span');
    contentElement.style.display = 'inline-block';
    
    // Recursively build DOM representation of content
    const buildContentDOM = (elements: EquationElement[], parent: HTMLElement) => {
      elements.forEach(el => {
        if (el.type === 'text') {
          const textSpan = document.createElement('span');
          textSpan.textContent = el.value || '';
          parent.appendChild(textSpan);
        } else if (el.type === 'fraction' || el.type === 'bevelled-fraction') {
          const fracContainer = document.createElement('span');
          fracContainer.style.display = 'inline-flex';
          fracContainer.style.flexDirection = 'column';
          fracContainer.style.alignItems = 'center';
          fracContainer.style.verticalAlign = 'middle';
          
          const numerator = document.createElement('span');
          numerator.style.fontSize = '0.8em';
          if (el.numerator) buildContentDOM(el.numerator, numerator);
          
          const line = document.createElement('span');
          line.style.borderTop = '1px solid black';
          line.style.width = '100%';
          line.style.height = '0';
          
          const denominator = document.createElement('span');
          denominator.style.fontSize = '0.8em';
          if (el.denominator) buildContentDOM(el.denominator, denominator);
          
          fracContainer.appendChild(numerator);
          if (el.type === 'fraction') fracContainer.appendChild(line);
          fracContainer.appendChild(denominator);
          parent.appendChild(fracContainer);
        } else if (el.type === 'script') {
          const scriptContainer = document.createElement('span');
          scriptContainer.style.display = 'inline-block';
          scriptContainer.style.position = 'relative';
          
          const base = document.createElement('span');
          if (el.base) buildContentDOM(el.base, base);
          scriptContainer.appendChild(base);
          
          if (el.superscript) {
            const sup = document.createElement('sup');
            sup.style.fontSize = '0.7em';
            buildContentDOM(el.superscript, sup);
            scriptContainer.appendChild(sup);
          }
          
          if (el.subscript) {
            const sub = document.createElement('sub');
            sub.style.fontSize = '0.7em';
            buildContentDOM(el.subscript, sub);
            scriptContainer.appendChild(sub);
          }
          
          parent.appendChild(scriptContainer);
        } else if (el.type === 'sqrt' || el.type === 'nthroot') {
          const rootContainer = document.createElement('span');
          rootContainer.style.display = 'inline-block';
          rootContainer.style.borderTop = '2px solid black';
          rootContainer.style.paddingTop = '2px';
          rootContainer.style.paddingLeft = '4px';
          rootContainer.style.paddingRight = '4px';
          
          if (el.radicand) buildContentDOM(el.radicand, rootContainer);
          parent.appendChild(rootContainer);
        } else if (el.type === 'large-operator' || el.type === 'integral') {
          const opContainer = document.createElement('span');
          opContainer.style.display = 'inline-flex';
          opContainer.style.flexDirection = 'column';
          opContainer.style.alignItems = 'center';
          opContainer.style.fontSize = '1.5em';
          
          const symbol = document.createElement('span');
          symbol.textContent = el.type === 'integral' ? '∫' : (el.operator || 'Σ');
          opContainer.appendChild(symbol);
          
          parent.appendChild(opContainer);
        } else if (el.type === 'matrix' || el.type === 'stack' || el.type === 'cases') {
          const matrixContainer = document.createElement('span');
          matrixContainer.style.display = 'inline-table';
          matrixContainer.style.verticalAlign = 'middle';
          
          // Approximate matrix height based on number of rows
          if (el.cells) {
            const rows = Math.max(...Object.keys(el.cells).map(key => {
              const match = key.match(/cell_(\d+)_/);
              return match ? parseInt(match[1]) : 0;
            })) + 1;
            matrixContainer.style.minHeight = `${rows * 1.5}em`;
          }
          
          parent.appendChild(matrixContainer);
        }
        // Add more element type handling as needed
      });
    };

    buildContentDOM(content, contentElement);
    measureContainer.appendChild(contentElement);
    
    const contentHeight = contentElement.getBoundingClientRect().height;
    
    // Clean up
    document.body.removeChild(measureContainer);
    
    // Return height ratio (k = k times baseline height)
    return contentHeight / baselineHeight;
  }

  private updateParenthesesScalingRecursive(elements: EquationElement[]): void {
    const bracketPairMap = getBracketPairMap();
    const openBrackets = getOpenBrackets();
    const closeBrackets = getCloseBrackets();
    
    const bracketStack: Array<{ element: EquationElement; index: number; bracketType: string }> = [];
    const bracketPairs: Array<{
      open: { element: EquationElement; index: number };
      close: { element: EquationElement; index: number };
      content: EquationElement[];
    }> = [];

    elements.forEach((el) => {
      if (el.type === "text" && /[()]/.test(el.value || "")) {
        el.scaleFactor = 1;
      } else if (el.type === "fraction" || el.type === "bevelled-fraction") {
        this.updateParenthesesScalingRecursive(el.numerator!);
        this.updateParenthesesScalingRecursive(el.denominator!);
      } else if (el.type === "sqrt") {
        this.updateParenthesesScalingRecursive(el.radicand!);
      } else if (el.type === "nthroot") {
        if (el.index) this.updateParenthesesScalingRecursive(el.index);
        this.updateParenthesesScalingRecursive(el.radicand!);
      } else if (el.type === "script") {
        this.updateParenthesesScalingRecursive(el.base!);
        if (el.superscript) this.updateParenthesesScalingRecursive(el.superscript);
        if (el.subscript) this.updateParenthesesScalingRecursive(el.subscript);
      } else if (el.type === "bracket") {
        this.updateParenthesesScalingRecursive(el.content!);
        if (el.superscript) this.updateParenthesesScalingRecursive(el.superscript);
        if (el.subscript) this.updateParenthesesScalingRecursive(el.subscript);
      } else if (el.type === "large-operator") {
        if (el.lowerLimit) this.updateParenthesesScalingRecursive(el.lowerLimit);
        if (el.upperLimit) this.updateParenthesesScalingRecursive(el.upperLimit);
        if (el.operand) this.updateParenthesesScalingRecursive(el.operand);
      } else if (el.type === "integral") {
        if (el.content) this.updateParenthesesScalingRecursive(el.content);
        if (el.lowerLimit) this.updateParenthesesScalingRecursive(el.lowerLimit);
        if (el.upperLimit) this.updateParenthesesScalingRecursive(el.upperLimit);
      } else if (el.type === "derivative") {
        if (el.function) this.updateParenthesesScalingRecursive(el.function);
        if (el.variable) this.updateParenthesesScalingRecursive(el.variable);
        if (Array.isArray(el.order)) this.updateParenthesesScalingRecursive(el.order);
      } else if (el.type === "differential") {
        if (el.variable) this.updateParenthesesScalingRecursive(el.variable);
      } else if (el.type === "matrix" || el.type === "stack" || el.type === "cases") {
        // Cells object is defined as cells[`cell_${row}_${col}`]
        if (el.cells) {
          for (const cellKey in el.cells) {
            if (el.cells.hasOwnProperty(cellKey)) {
              this.updateParenthesesScalingRecursive(el.cells[cellKey]);
            }
          }
        }
      } else if (el.type === "accent") {
        if (el.accentBase) this.updateParenthesesScalingRecursive(el.accentBase);
        if (el.accentLabel) this.updateParenthesesScalingRecursive(el.accentLabel);
      } else if (el.type === "function") {
        if (el.functionName) this.updateParenthesesScalingRecursive(el.functionName);
        if (el.functionArgument) this.updateParenthesesScalingRecursive(el.functionArgument);
        if (el.functionBase) this.updateParenthesesScalingRecursive(el.functionBase);
        if (el.functionConstraint) this.updateParenthesesScalingRecursive(el.functionConstraint);
      }
    });

    elements.forEach((element, index) => {
      if (element.type === "text" && element.value && openBrackets.has(element.value)) {
        bracketStack.push({ element, index, bracketType: element.value });
      } else if (element.type === "text" && element.value && closeBrackets.has(element.value)) {
        // Find the most recent matching open bracket (search backwards)
        let matchingOpenIndex = -1;
        for (let i = bracketStack.length - 1; i >= 0; i--) {
          if (bracketPairMap[bracketStack[i].bracketType] === element.value) {
            matchingOpenIndex = i;
            break;
          }
        }
        if (matchingOpenIndex >= 0) {
          const opening = bracketStack.splice(matchingOpenIndex, 1)[0];
          bracketPairs.push({
            open: opening,
            close: { element, index },
            content: elements.slice(opening.index + 1, index),
          });
        }
      }
    });

    bracketPairs.forEach((pair) => {
      // Calculate the height ratio of the content between brackets
      const heightRatio = this.calculateContentHeight(pair.content);
      
      // Scale brackets based on content height
      // 1.0 = baseline height (no scaling)
      // 1.5+ = content is 50% taller than baseline (needs scaling)
      let scaleFactor = 1;
      
      if (heightRatio > 2.5) {
        scaleFactor = 2;      // Very tall content (e.g., nested fractions, tall matrices)
      } else if (heightRatio > 1.8) {
        scaleFactor = 1.75;   // Tall content (e.g., fractions with complex elements)
      } else if (heightRatio > 1.4) {
        scaleFactor = 1.5;    // Moderately tall content (e.g., simple fractions, superscripts)
      } else if (heightRatio > 1.2) {
        scaleFactor = 1.25;   // Slightly tall content
      }
      // else scaleFactor remains 1 for normal height content
      
      pair.open.element.scaleFactor = scaleFactor;
      pair.close.element.scaleFactor = scaleFactor;
    });
  }

  private updateBracketNestingRecursive(elements: EquationElement[], currentDepth: number): void {
    elements.forEach((element) => {
      if (element.type === "bracket") {
        this.updateBracketNestingRecursive(element.content!, currentDepth + 1);
      } else if (element.type === "fraction" || element.type === "bevelled-fraction") {
        this.updateBracketNestingRecursive(element.numerator!, currentDepth);
        this.updateBracketNestingRecursive(element.denominator!, currentDepth);
      } else if (element.type === "sqrt") {
        this.updateBracketNestingRecursive(element.radicand!, currentDepth);
      } else if (element.type === "nthroot") {
        this.updateBracketNestingRecursive(element.index!, currentDepth);
        this.updateBracketNestingRecursive(element.radicand!, currentDepth);
      } else if (element.type === "script") {
        this.updateBracketNestingRecursive(element.base!, currentDepth);
        if (element.superscript)
          this.updateBracketNestingRecursive(element.superscript, currentDepth);
        if (element.subscript) this.updateBracketNestingRecursive(element.subscript, currentDepth);
      } else if (element.type === "large-operator") {
        if (element.lowerLimit)
          this.updateBracketNestingRecursive(element.lowerLimit, currentDepth);
        if (element.upperLimit)
          this.updateBracketNestingRecursive(element.upperLimit, currentDepth);
        if (element.operand) this.updateBracketNestingRecursive(element.operand, currentDepth);
      } else if (element.type === "integral") {
        if (element.content) this.updateBracketNestingRecursive(element.content, currentDepth);
        if (element.lowerLimit)
          this.updateBracketNestingRecursive(element.lowerLimit, currentDepth);
        if (element.upperLimit)
          this.updateBracketNestingRecursive(element.upperLimit, currentDepth);
      } else if (element.type === "derivative") {
        if (element.function) this.updateBracketNestingRecursive(element.function, currentDepth);
        if (element.variable) this.updateBracketNestingRecursive(element.variable, currentDepth);
      } else if (element.type === "differential") {
        if (element.variable) this.updateBracketNestingRecursive(element.variable, currentDepth);
        if (Array.isArray(element.order))
          this.updateBracketNestingRecursive(element.order, currentDepth);
      } else if (element.type === "accent") {
        if (element.accentBase)
          this.updateBracketNestingRecursive(element.accentBase, currentDepth);
        if (element.accentLabel)
          this.updateBracketNestingRecursive(element.accentLabel, currentDepth);
      } else if (element.type === "function") {
        if (element.functionName)
          this.updateBracketNestingRecursive(element.functionName, currentDepth);
        if (element.functionArgument)
          this.updateBracketNestingRecursive(element.functionArgument, currentDepth);
        if (element.functionBase)
          this.updateBracketNestingRecursive(element.functionBase, currentDepth);
        if (element.functionConstraint)
          this.updateBracketNestingRecursive(element.functionConstraint, currentDepth);
      } else if (element.type === "matrix" || element.type === "stack" || element.type === "cases") {
        // Cells object is defined as cells[`cell_${row}_${col}`]
        if (element.cells) {
          for (const cellKey in element.cells) {
            if (element.cells.hasOwnProperty(cellKey)) {
              this.updateBracketNestingRecursive(element.cells[cellKey], currentDepth);
            }
          }
        }
      }
    });
  }

  createAccentElement(
    accentType: string,
    position: "over" | "under",
    base?: EquationElement[],
    label?: EquationElement[]
  ): EquationElement {
    // For labeled braces, always initialize an empty label array if none provided
    const shouldInitializeLabel = accentType === "labeledoverbrace" || accentType === "labeledunderbrace";
    const accentLabel = label || (shouldInitializeLabel ? [] : undefined);
    
    return {
      id: this.generateElementId(),
      type: "accent",
      accentType: accentType as any,
      accentPosition: position,
      accentBase: base || [],
      accentLabel: accentLabel,
    };
  }

  createFunctionElement(functionType: string): EquationElement {
    return {
      id: this.generateElementId(),
      type: "function",
      functionType: functionType,
      functionName: [],
      functionArgument: [],
      functionBase: [],
      functionConstraint: [],
    };
  }
}
