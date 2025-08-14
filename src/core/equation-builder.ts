// Equation element types and builder functionality
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
    | "matrix"
    | "stack"
    | "cases"
    | "wrapper";
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
  nestingDepth?: number;
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
  // for integral (custom format: ∫ f(x) dx)
  integrand?: EquationElement[]; // f(x)
  differentialVariable?: EquationElement[]; // x in dx
  integralStyle?: "italic" | "roman"; // style for d
  hasLimits?: boolean; // whether this is a definite integral
  integralType?: "single" | "double" | "triple" | "contour"; // type of integral (may extend in future)
  // for matrix
  matrixType?: "parentheses" | "brackets" | "braces" | "bars" | "double-bars" | "none";
  rows?: number;
  cols?: number;
  cells?: Record<string, EquationElement[]>; // Object with keys like cell_0_0, cell_1_0, etc.
  // for stack (vertical arrangement without brackets)
  stackType?: "plain"; // Plain vertical arrangement using array environment
  // for cases (piecewise functions with left brace)
  casesType?: "cases"; // Piecewise functions with left curly brace
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
      nestingDepth: 0,
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
    isLongForm: boolean = false
  ): EquationElement {
    return {
      id: this.generateElementId(),
      type: "derivative",
      order: order,
      displayMode: displayMode,
      function: [],
      variable: [],
      isLongForm: isLongForm,
    };
  }

  createIntegralElement(
    integralType: "single" | "double" | "triple" | "contour" = "single",
    displayMode: "inline" | "display" = "inline",
    integralStyle: "italic" | "roman" = "italic",
    hasLimits: boolean = false,
    limitMode: "default" | "nolimits" | "limits" = "default"
  ): EquationElement {
    return {
      id: this.generateElementId(),
      type: "integral",
      integralType: integralType,
      displayMode: displayMode,
      integralStyle: integralStyle,
      hasLimits: hasLimits,
      limitMode: limitMode,
      integrand: [],
      differentialVariable: [],
      lowerLimit: hasLimits ? [] : undefined,
      upperLimit: hasLimits ? [] : undefined
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
          this.findElementById(el.integrand || [], id) ||
          this.findElementById(el.differentialVariable || [], id) ||
          this.findElementById(el.lowerLimit || [], id) ||
          this.findElementById(el.upperLimit || [], id);
        if (found) return found;
      }
      if (el.type === "matrix" || el.type === "stack" || el.type === "cases") {
        if (el.cells) {
          for (const cellKey in el.cells) {
            if (cellKey.startsWith('cell_')) {
              const found = this.findElementById(el.cells[cellKey], id);
              if (found) return found;
            }
          }
        }
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

  private updateParenthesesScalingRecursive(elements: EquationElement[]): void {
    const parenStack: Array<{ element: EquationElement; index: number }> = [];
    const parenPairs: Array<{
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
      } else if (el.type === "script") {
        this.updateParenthesesScalingRecursive(el.base!);
        if (el.superscript) this.updateParenthesesScalingRecursive(el.superscript);
        if (el.subscript) this.updateParenthesesScalingRecursive(el.subscript);
      } else if (el.type === "bracket") {
        this.updateParenthesesScalingRecursive(el.content!);
      } else if (el.type === "large-operator") {
        if (el.lowerLimit) this.updateParenthesesScalingRecursive(el.lowerLimit);
        if (el.upperLimit) this.updateParenthesesScalingRecursive(el.upperLimit);
        if (el.operand) this.updateParenthesesScalingRecursive(el.operand);
      }
    });

    elements.forEach((element, index) => {
      if (element.type === "text" && element.value === "(") {
        parenStack.push({ element, index });
      } else if (element.type === "text" && element.value === ")") {
        if (parenStack.length > 0) {
          const opening = parenStack.pop()!;
          parenPairs.push({
            open: opening,
            close: { element, index },
            content: elements.slice(opening.index + 1, index),
          });
        }
      }
    });

    parenPairs.forEach((pair) => {
      const hasFraction = pair.content.some((el) => el.type === "fraction" || el.type === "bevelled-fraction");
      const scaleFactor = hasFraction ? 1.5 : 1;
      pair.open.element.scaleFactor = scaleFactor;
      pair.close.element.scaleFactor = scaleFactor;
    });
  }

  private updateBracketNestingRecursive(elements: EquationElement[], currentDepth: number): void {
    elements.forEach((element) => {
      if (element.type === "bracket") {
        element.nestingDepth = currentDepth;
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
        if (element.integrand) this.updateBracketNestingRecursive(element.integrand, currentDepth);
        if (element.differentialVariable)
          this.updateBracketNestingRecursive(element.differentialVariable, currentDepth);
        if (element.lowerLimit)
          this.updateBracketNestingRecursive(element.lowerLimit, currentDepth);
        if (element.upperLimit)
          this.updateBracketNestingRecursive(element.upperLimit, currentDepth);
      } else if (element.type === "derivative") {
        if (element.function) this.updateBracketNestingRecursive(element.function, currentDepth);
        if (element.variable) this.updateBracketNestingRecursive(element.variable, currentDepth);
        if (Array.isArray(element.order))
          this.updateBracketNestingRecursive(element.order, currentDepth);
      }
    });
  }
}
