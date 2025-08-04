// Equation element types and builder functionality
export interface EquationElement {
  id: string;
  type: "text" | "fraction" | "bevelled-fraction" | "sqrt" | "nthroot" | "script" | "bracket";
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
  // text formatting
  bold?: boolean;
  italic?: boolean;
  underline?: "single" | "double";
  strikethrough?: boolean;
  color?: string;
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

  generateElementId(): string {
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
        if (element.superscript) this.updateBracketNestingRecursive(element.superscript, currentDepth);
        if (element.subscript) this.updateBracketNestingRecursive(element.subscript, currentDepth);
      }
    });
  }
}