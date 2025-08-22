import { EquationElement } from "../core/equation-builder";
import { ContextManager } from "../core/context-manager";
import { getIntegralSymbol, UNICODE_TO_LATEX, FUNCTION_NAMES, FUNCTION_TYPE_MAP } from "../core/centralized-config";

export class DisplayRenderer {
  private contextManager: ContextManager;
  private globalFontSize: number = 12;
  private inputHandler: any = null;

  constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
  }

  setInputHandler(inputHandler: any): void {
    this.inputHandler = inputHandler;
  }

  setGlobalFontSize(size: number): void {
    this.globalFontSize = size;
  }

  getGlobalFontSize(): number {
    return this.globalFontSize;
  }

  renderEquation(elements: EquationElement[]): string {
    const activeContextPath = this.contextManager.getActiveContextPath();

    if (activeContextPath === null && elements.length === 0) {
      return '<span class="empty-state">Click here and start typing your equation</span>';
    }

    return this.generateMathML(elements, "root");
  }

  updateDisplay(displayElement: HTMLElement, elements: EquationElement[]): void {
    const activeContextPath = this.contextManager.getActiveContextPath();

    if (activeContextPath === null && elements.length === 0) {
      displayElement.innerHTML =
        '<span class="empty-state">Click here and start typing your equation</span>';
      displayElement.classList.remove("active");
      return;
    }

    displayElement.classList.toggle("active", activeContextPath !== null);

    const mathmlContent = this.generateMathML(elements, "root");
    const visualHTML = `
      <div class="visual-equation-container" style="font-size: ${this.globalFontSize * 1.5}px; position: relative;">
        ${mathmlContent}
        <div class="wrapper-overlays" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;"></div>
      </div>
    `;

    displayElement.innerHTML = visualHTML;

    // Create wrapper overlays after DOM is updated
    requestAnimationFrame(() => {
      this.createWrapperOverlays(displayElement, elements);
    });
  }

  private generateMathML(elements: EquationElement[], contextPath: string): string {
    const activeContextPath = this.contextManager.getActiveContextPath();
    const cursorPosition = this.contextManager.getCursorPosition();
    const selection = this.contextManager.getSelection();

    // Add active-context class to the container mrow if this is the active context
    const isActiveContext = activeContextPath === contextPath;
    const containerClass = isActiveContext ? "active-context" : "";
    const containerClassAttr = containerClass ? ` class="${containerClass}"` : "";

    let mathmlContent = `<math><mrow data-context-path="${contextPath}"${containerClassAttr}>`;

    if (elements.length === 0 && contextPath === activeContextPath) {
      mathmlContent += '<mspace class="cursor" data-context-path="' + contextPath + '" data-position="0" />';
    }

    elements.forEach((element, index) => {
      if (contextPath === activeContextPath && index === cursorPosition) {
        mathmlContent += '<mspace class="cursor" data-context-path="' + contextPath + '" data-position="' + index + '" />';
      }
      const elementPath = contextPath === 'root' ? `root/${element.id}` : `${contextPath}/${element.id}`;

      // Check if this element is in the selection range
      const isSelected = selection.isActive && 
        selection.contextPath === contextPath &&
        index >= selection.startPosition &&
        index < selection.endPosition;

      mathmlContent += this.elementToMathML(element, elementPath, index, isSelected);
    });

    if (contextPath === activeContextPath && elements.length === cursorPosition) {
      mathmlContent += '<mspace class="cursor" data-context-path="' + contextPath + '" data-position="' + elements.length + '" />';
    }

    mathmlContent += "</mrow></math>";
    return mathmlContent;
  }

  private elementToMathML(element: EquationElement, contextPath: string, position: number, isSelected: boolean = false): string {
    const activeContextPath = this.contextManager.getActiveContextPath();
    const isActive = activeContextPath === contextPath;

    switch (element.type) {
      case "text":
        return this.textToMathML(element, isActive, contextPath, position, isSelected);
      case "fraction":
        return this.fractionToMathML(element, contextPath, isActive, position, isSelected);
      case "bevelled-fraction":
        return this.bevelledFractionToMathML(element, contextPath, isActive, position, isSelected);
      case "sqrt":
        return this.sqrtToMathML(element, contextPath, isActive, position, isSelected);
      case "nthroot":
        return this.nthRootToMathML(element, contextPath, isActive, position, isSelected);
      case "script":
        return this.scriptToMathML(element, contextPath, isActive, position, isSelected);
      case "bracket":
        return this.bracketToMathML(element, contextPath, isActive, position, isSelected);
      case "large-operator":
        return this.largeOperatorToMathML(element, contextPath, isActive, position, isSelected);
      case "derivative":
        return this.derivativeToMathML(element, contextPath, isActive, position, isSelected);
      case "integral":
        return this.integralToMathML(element, contextPath, isActive, position, isSelected);
      case "matrix":
        return this.matrixToMathML(element, contextPath, isActive, position, isSelected);
      case "stack":
        return this.stackToMathML(element, contextPath, isActive, position, isSelected);
      case "cases":
        return this.casesToMathML(element, contextPath, isActive, position, isSelected);
      case "accent":
        return this.accentToMathML(element, contextPath, isActive, position, isSelected);
      case "function":
        return this.functionToMathML(element, contextPath, isActive, position, isSelected);
      default:
        return "";
    }
  }

  private textToMathML(element: EquationElement, isActive: boolean, contextPath: string, position: number, isSelected: boolean = false): string {
    let value = element.value || '&#x25A1;'; // Default to a placeholder square
    
    // Check if element is in text mode early to handle space escaping
    const isTextMode = element.textMode === true || (element.wrappers && element.wrappers.textMode);

    // Handle LaTeX spacing commands that might be parsed as text
    if (value === "\\,") {
      value = "&#8201;"; // Thin space (U+2009)
    }

    // In text mode, convert spaces to non-breaking spaces for proper display
    if (isTextMode && value === " ") {
      value = "&#160;"; // Non-breaking space
    }
    const isOperator = /[+\-−×÷=<>≤≥≠±∓·∗⋆∘•∼≃≈≡≅≇∝≮≯≰≱≺≻⪯⪰≪≫∩∪∖∈∋∉⊂⊃⊆⊇⊈⊉⊊⊋⊕⊖⊗⊘⊙◁▷≀∧∨⊢⊨⊤⊥⋈⋄≍≜∴∵]/.test(value);
    const isVariable = /[a-zA-Z]/.test(value);
    const isNumber = /[0-9]/.test(value);
    const isSymbol = /[^\w\s]/.test(value);

    let tag = "mi";
    // In text mode, use mtext tag for proper text rendering
    if (isTextMode) {
      tag = "mtext";
    } else if (isOperator) {
      tag = "mo";
    } else if (isNumber) {
      tag = "mn";
    }

    let style = "";
    // Check for direct color property (legacy)
    if (element.color) style += `color: ${element.color};`;
    // Check for wrapper color (multi-wrapper system)
    if (element.wrappers?.color?.value) {
      style += `color: ${element.wrappers.color.value};`;
    }
    if (element.bold) style += "font-weight: bold;";

    // Add selection highlighting
    if (isSelected) {
      style += "background-color: #0078d4; color: white; border-radius: 2px; padding: 1px 2px;";
    }

    const styleAttr = style ? `style="${style}"` : "";

    // Handle italic styling using mathvariant attribute for mi elements, inline styles for others
    let mathVariantAttr = "";
    if (tag === "mi") {
      // For <mi> elements, use mathvariant attribute to control italic behavior
      let shouldBeItalic = false;

      // Check if this is a function name that should be upright
      const isFunctionName = FUNCTION_NAMES.includes(value);

      if (element.italic === true) {
        shouldBeItalic = true;
      } else if (element.italic === false || isFunctionName) {
        shouldBeItalic = false;
      } else if (isVariable && !element.bold && element.italic !== false && !isTextMode) {
        // Variables default to italic unless bold or explicitly set to normal or in text mode
        shouldBeItalic = true;
      }

      // Set mathvariant to "normal" to override default italic behavior of <mi>
      if (!shouldBeItalic) {
        mathVariantAttr = 'mathvariant="normal"';
      }
      // If shouldBeItalic is true, we don't set mathvariant and let <mi> use its default italic
    } else if (tag === "mtext") {
      // For mtext elements, ensure roman (non-italic) font by default
      mathVariantAttr = 'mathvariant="normal"';
    } else {
      // For non-mi elements (mo, mn), use inline styles as before
      if (element.italic === true) {
        style += "font-style: italic;";
      } else if (element.italic === false) {
        style += "font-style: normal;";
      } else if (isVariable && !element.bold && element.italic !== false && !isTextMode) {
        // Variables default to italic unless bold or explicitly set to normal or in text mode
        style += "font-style: italic;";
      }
    }

    const classNames = [];
    if (isActive) classNames.push("active-element");
    if (isSelected) classNames.push("selected");

    // Add active-context class if this is the active context
    const activeContextPath = this.contextManager.getActiveContextPath();
    if (activeContextPath === contextPath) {
      classNames.push("active-context");
    }

    const classAttr = classNames.length > 0 ? `class="${classNames.join(" ")}"` : "";
    const dataAttrs = `data-context-path="${contextPath}" data-position="${position}" data-element-id="${element.id}"`;

    // Update styleAttr if we modified style for non-mi elements
    const finalStyleAttr = style ? `style="${style}"` : "";

    return `<${tag} ${finalStyleAttr} ${mathVariantAttr} ${classAttr} ${dataAttrs}>${value}</${tag}>`;
  }

  // Helper method to build style attributes for structure elements
  private buildStructureStyle(element: EquationElement, isSelected: boolean): string {
    let style = "";
    
    // Check for direct color property (legacy)
    if (element.color) style += `color: ${element.color};`;
    
    // Check for wrapper color (multi-wrapper system)
    if (element.wrappers?.color?.value) {
      style += `color: ${element.wrappers.color.value};`;
    }
    
    if (element.bold) style += "font-weight: bold;";
    if (isSelected) {
      style += "background-color: #0078d4; color: white; border-radius: 3px; padding: 2px;";
    }
    return style ? `style="${style}"` : "";
  }

  private fractionToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const numeratorML = this.generateMathMLContent(`${elementPath}/numerator`, element.numerator);
    const denominatorML = this.generateMathMLContent(`${elementPath}/denominator`, element.denominator);

    // Add classes for active element, selection, and display mode
    const classes = [];
    if (isActive) classes.push("active-element");
    if (isSelected) classes.push("selected-structure");
    if (element.displayMode === "display") classes.push("display-fraction");
    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";

    const styleAttr = this.buildStructureStyle(element, isSelected);

    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    // Add displaystyle attribute for display mode fractions
    const displayStyle = element.displayMode === "display" ? 'displaystyle="true"' : "";

    return `<mfrac ${displayStyle} ${classAttr} ${styleAttr} ${dataAttrs}>
      <mrow data-context-path="${elementPath}/numerator">${numeratorML}</mrow>
      <mrow data-context-path="${elementPath}/denominator">${denominatorML}</mrow>
    </mfrac>`;
  }

  private bevelledFractionToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const numeratorML = this.generateMathMLContent(`${elementPath}/numerator`, element.numerator);
    const denominatorML = this.generateMathMLContent(`${elementPath}/denominator`, element.denominator);
    const classAttr = isActive ? 'class="active-element"' : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;

    return `<mrow ${classAttr} ${dataAttrs}>
      <mrow data-context-path="${elementPath}/numerator">${numeratorML}</mrow>
      <mo>/</mo>
      <mrow data-context-path="${elementPath}/denominator">${denominatorML}</mrow>
    </mrow>`;
  }

  private sqrtToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const radicandML = this.generateMathMLContent(`${elementPath}/radicand`, element.radicand);
    const classes = [];
    if (isActive) classes.push("active-element");
    if (isSelected) classes.push("selected-structure");

    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";

    const styleAttr = this.buildStructureStyle(element, isSelected);

    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    return `<msqrt ${classAttr} ${styleAttr} ${dataAttrs}>
      <mrow data-context-path="${elementPath}/radicand">${radicandML}</mrow>
    </msqrt>`;
  }

  private nthRootToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const indexML = this.generateMathMLContent(`${elementPath}/index`, element.index);
    const radicandML = this.generateMathMLContent(`${elementPath}/radicand`, element.radicand);
    const classes = [];
    if (isActive) classes.push("active-element");
    if (isSelected) classes.push("selected-structure");
    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";
    const styleAttr = this.buildStructureStyle(element, isSelected);
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    return `<mroot ${classAttr} ${styleAttr} ${dataAttrs}>
      <mrow data-context-path="${elementPath}/radicand">${radicandML}</mrow>
      <mrow data-context-path="${elementPath}/index">${indexML}</mrow>
    </mroot>`;
  }

  private scriptToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const baseML = this.generateMathMLContent(`${elementPath}/base`, element.base);
    const classes = [];
    if (isActive) classes.push("active-element");
    if (isSelected) classes.push("selected-structure");
    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";

    const styleAttr = this.buildStructureStyle(element, isSelected);

    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    if (element.superscript && element.subscript) {
      const supML = this.generateMathMLContent(`${elementPath}/superscript`, element.superscript);
      const subML = this.generateMathMLContent(`${elementPath}/subscript`, element.subscript);
      return `<msubsup ${classAttr} ${styleAttr} ${dataAttrs}>
        <mrow data-context-path="${elementPath}/base">${baseML}</mrow>
        <mrow data-context-path="${elementPath}/subscript">${subML}</mrow>
        <mrow data-context-path="${elementPath}/superscript">${supML}</mrow>
      </msubsup>`;
    } else if (element.superscript) {
      const supML = this.generateMathMLContent(`${elementPath}/superscript`, element.superscript);
      return `<msup ${classAttr} ${styleAttr} ${dataAttrs}>
        <mrow data-context-path="${elementPath}/base">${baseML}</mrow>
        <mrow data-context-path="${elementPath}/superscript">${supML}</mrow>
      </msup>`;
    } else if (element.subscript) {
      const subML = this.generateMathMLContent(`${elementPath}/subscript`, element.subscript);
      return `<msub ${classAttr} ${styleAttr} ${dataAttrs}>
        <mrow data-context-path="${elementPath}/base">${baseML}</mrow>
        <mrow data-context-path="${elementPath}/subscript">${subML}</mrow>
      </msub>`;
    }
    return `<mrow data-context-path="${elementPath}">${baseML}</mrow>`;
  }

  private bracketToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const contentML = this.generateMathMLContent(`${elementPath}/content`, element.content);

    // Brackets will automatically size based on their content
    // Using stretchy="true" allows brackets to stretch to match content height
    const leftBracket = element.leftBracketSymbol ? 
      `<mo stretchy="true" symmetric="true">${element.leftBracketSymbol}</mo>` : '';
    const rightBracket = element.rightBracketSymbol ? 
      `<mo stretchy="true" symmetric="true">${element.rightBracketSymbol}</mo>` : '';

    const classes = [];
    if (isActive) classes.push("active-element");
    if (isSelected) classes.push("selected-structure");
    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;

    // Create the basic bracket structure
    const bracketContent = `<mrow ${classAttr} ${dataAttrs}>
      ${leftBracket}
      <mrow data-context-path="${elementPath}/content">${contentML}</mrow>
      ${rightBracket}
    </mrow>`;

    // Check if this bracket has superscript/subscript (evaluation brackets)
    if (element.superscript && element.subscript) {
      const supML = this.generateMathMLContent(`${elementPath}/superscript`, element.superscript);
      const subML = this.generateMathMLContent(`${elementPath}/subscript`, element.subscript);
      return `<msubsup ${classAttr} ${dataAttrs}>
        ${bracketContent}
        <mrow data-context-path="${elementPath}/subscript">${subML}</mrow>
        <mrow data-context-path="${elementPath}/superscript">${supML}</mrow>
      </msubsup>`;
    } else if (element.superscript) {
      const supML = this.generateMathMLContent(`${elementPath}/superscript`, element.superscript);
      return `<msup ${classAttr} ${dataAttrs}>
        ${bracketContent}
        <mrow data-context-path="${elementPath}/superscript">${supML}</mrow>
      </msup>`;
    } else if (element.subscript) {
      const subML = this.generateMathMLContent(`${elementPath}/subscript`, element.subscript);
      return `<msub ${classAttr} ${dataAttrs}>
        ${bracketContent}
        <mrow data-context-path="${elementPath}/subscript">${subML}</mrow>
      </msub>`;
    }

    return bracketContent;
  }

  private largeOperatorToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const operator = element.operator || '&#x2211;';
    const operandML = this.generateMathMLContent(`${elementPath}/operand`, element.operand);
    const classes = [];
    if (isActive) classes.push("active-element");
    if (isSelected) classes.push("selected-structure");
    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";
    const styleAttr = this.buildStructureStyle(element, isSelected);
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    // Check if this is marked as an indefinite integral
    const isIndefiniteIntegral = (element as any).isIndefiniteIntegral === true;

    // Add displaystyle attribute for display mode OR limits mode (to force proper limit positioning)
    const displayStyle = (element.displayMode === 'display' || element.limitMode === 'limits') ? 'displaystyle="true"' : '';

    // Get data-operator attribute for all operator types
    const operatorData = this.getOperatorDataAttribute(operator);

    let operatorML = "";
    if (isIndefiniteIntegral) {
      // Simple indefinite integral without limits
      operatorML = `<mo ${classAttr} ${dataAttrs}>${operator}</mo>`;
    } else if (element.limitMode === "limits") {
      const upperML = this.generateMathMLContent(`${elementPath}/upperLimit`, element.upperLimit);
      const lowerML = this.generateMathMLContent(`${elementPath}/lowerLimit`, element.lowerLimit);
      // Distinguish regular limits from display limits for sizing
      const limitsClass = element.displayMode === "display" ? "display-limits" : "inline-limits";
      const limitsClasses = [limitsClass];
      if (isSelected) limitsClasses.push("selected-structure");
      operatorML = `<munderover class="${limitsClasses.join(" ")}" ${operatorData} ${dataAttrs}>
        <mo>${operator}</mo>
        <mrow data-context-path="${elementPath}/lowerLimit">${lowerML}</mrow>
        <mrow data-context-path="${elementPath}/upperLimit">${upperML}</mrow>
      </munderover>`;
    } else {
      const upperML = this.generateMathMLContent(`${elementPath}/upperLimit`, element.upperLimit);
      const lowerML = this.generateMathMLContent(`${elementPath}/lowerLimit`, element.lowerLimit);
      operatorML = `<msubsup ${classAttr} ${dataAttrs}>
        <mo>${operator}</mo>
        <mrow data-context-path="${elementPath}/lowerLimit">${lowerML}</mrow>
        <mrow data-context-path="${elementPath}/upperLimit">${upperML}</mrow>
      </msubsup>`;
    }

    // Wrap everything in mrow with displaystyle and include operand
    // Add data-operator to the wrapper so CSS can target cursors within any integral
    const wrapperClasses = [];
    if (isSelected) wrapperClasses.push("selected-structure");
    const wrapperClassAttr =
      wrapperClasses.length > 0 ? ` class="${wrapperClasses.join(" ")}"` : "";
    return `<mrow ${displayStyle} ${operatorData}${wrapperClassAttr} ${styleAttr} data-element-id="${element.id}">
      ${operatorML}
      <mrow data-context-path="${elementPath}/operand">${operandML}</mrow>
    </mrow>`;
  }

  private getOperatorDataAttribute(operator: string): string {
    // Convert operator symbol to LaTeX command, then use that as the name
    const latexCommand = UNICODE_TO_LATEX[operator];
    const operatorName = latexCommand ? latexCommand.substring(1) : "unknown"; // Remove the backslash
    return `data-operator="${operatorName}"`;
  }

  private derivativeToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const classes = [];
    if (isActive) classes.push("active-element");
    if (isSelected) classes.push("selected-structure");
    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    // Add displaystyle attribute for display mode derivatives
    const displayStyle = element.displayMode === "display" ? 'displaystyle="true"' : "";

    // Check current differential style preference from context manager
    const isDifferentialItalic = this.getDifferentialStylePreference();
    // For partial derivatives, ∂ is always italic regardless of differential style preference
    const mathVariantAttr = (isDifferentialItalic || element.isPartial) ? "" : 'mathvariant="normal"';
    
    // Determine differential symbol: ∂ for partial derivatives, d for regular derivatives
    const differentialSymbol = element.isPartial ? "∂" : "d";

    // Check if this is long form derivative
    if (element.isLongForm) {
      return this.derivativeLongFormToMathML(element, elementPath, isActive, position, isSelected, displayStyle, mathVariantAttr, differentialSymbol);
    }

    // Generate content for each part (standard form)
    const functionML = this.generateMathMLContent(`${elementPath}/function`, element.function);
    const variableML = this.generateMathMLContent(`${elementPath}/variable`, element.variable);

    let numeratorContent = "";
    let denominatorContent = "";

    if (typeof element.order === "number") {
      // Numeric order (1, 2, 3, ...)
      if (element.order === 1) {
        numeratorContent = `<mi ${mathVariantAttr}>${differentialSymbol}</mi>${functionML}`;
        denominatorContent = `<mi ${mathVariantAttr}>${differentialSymbol}</mi>${variableML}`;
      } else {
        numeratorContent = `<msup>
          <mi ${mathVariantAttr}>${differentialSymbol}</mi>
          <mn>${element.order}</mn>
        </msup>${functionML}`;
        denominatorContent = `<mi ${mathVariantAttr}>${differentialSymbol}</mi><msup>
          ${variableML}
          <mn>${element.order}</mn>
        </msup>`;
      }
    } else {
      // nth order with custom expression
      const orderML = this.generateMathMLContent(`${elementPath}/order`, element.order);
      numeratorContent = `<msup>
        <mi ${mathVariantAttr}>${differentialSymbol}</mi>
        <mrow data-context-path="${elementPath}/order">${orderML}</mrow>
      </msup>${functionML}`;

      // For denominator, create a read-only copy without editable context
      const readOnlyOrderML = element.order && element.order.length > 0 ? 
        element.order.map(el => el.value || '').join('') : '';
      denominatorContent = `<mi ${mathVariantAttr}>${differentialSymbol}</mi><msup>
        ${variableML}
        <mi>${readOnlyOrderML || "&#x25A1;"}</mi>
      </msup>`;
    }

    return `<mfrac ${displayStyle} ${classAttr} ${dataAttrs}>
      <mrow data-context-path="${elementPath}/function">${numeratorContent}</mrow>
      <mrow data-context-path="${elementPath}/variable">${denominatorContent}</mrow>
    </mfrac>`;
  }

  private getDifferentialStylePreference(): boolean {
    // Get differential style from input handler (true = italic, false = roman)
    if (this.inputHandler && typeof this.inputHandler.getDifferentialStyleForLatex === "function") {
      // Invert the logic since getDifferentialStyleForLatex returns true for roman (physics package)
      // but we need true for italic display
      return !this.inputHandler.getDifferentialStyleForLatex();
    }
    return true; // Default to italic if no input handler
  }

  private derivativeLongFormToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean, displayStyle: string, mathVariantAttr: string, differentialSymbol: string = "d"): string {
    const classes = [];
    if (isActive) classes.push("active-element");
    if (isSelected) classes.push("selected-structure");
    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    // Generate content for each part
    const functionML = this.generateMathMLContent(`${elementPath}/function`, element.function);
    const variableML = this.generateMathMLContent(`${elementPath}/variable`, element.variable);

    let fractionContent = "";

    if (typeof element.order === "number") {
      // Numeric order (1, 2, 3, ...)
      if (element.order === 1) {
        // d/dx or ∂/∂x format
        fractionContent = `<mfrac ${displayStyle}>
          <mi ${mathVariantAttr}>${differentialSymbol}</mi>
          <mrow data-context-path="${elementPath}/variable">
            <mi ${mathVariantAttr}>${differentialSymbol}</mi>
            ${variableML}
          </mrow>
        </mfrac>`;
      } else {
        // d^n/dx^n or ∂^n/∂x^n format
        fractionContent = `<mfrac ${displayStyle}>
          <msup>
            <mi ${mathVariantAttr}>${differentialSymbol}</mi>
            <mn>${element.order}</mn>
          </msup>
          <mrow data-context-path="${elementPath}/variable">
            <mi ${mathVariantAttr}>${differentialSymbol}</mi>
            <msup>
              ${variableML}
              <mn>${element.order}</mn>
            </msup>
          </mrow>
        </mfrac>`;
      }
    } else {
      // nth order with custom expression
      const orderML = this.generateMathMLContent(`${elementPath}/order`, element.order);

      // For denominator, create a read-only copy without editable context to prevent shared input
      const readOnlyOrderML = element.order && element.order.length > 0 ? 
        element.order.map(el => el.value || '').join('') : '';

      fractionContent = `<mfrac ${displayStyle}>
        <msup>
          <mi ${mathVariantAttr}>${differentialSymbol}</mi>
          <mrow data-context-path="${elementPath}/order">${orderML}</mrow>
        </msup>
        <mrow data-context-path="${elementPath}/variable">
          <mi ${mathVariantAttr}>${differentialSymbol}</mi>
          <msup>
            ${variableML}
            <mi>${readOnlyOrderML || "&#x25A1;"}</mi>
          </msup>
        </mrow>
      </mfrac>`;
    }

    // Long form
    return `<mrow ${classAttr} ${dataAttrs}>
      ${fractionContent}
      <mrow data-context-path="${elementPath}/function">${functionML}</mrow>
    </mrow>`;
  }

  private integralToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const classes = [];
    if (isActive) classes.push("active-element");
    if (isSelected) classes.push("selected-structure");
    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    // Add displaystyle attribute for display mode integrals
    const displayStyle = element.displayMode === "display" ? 'displaystyle="true"' : "";

    // Get the integral symbol based on type
    const integralSymbol = getIntegralSymbol(element.integralType || "single");

    // Check differential style preference
    const isDifferentialItalic = element.integralStyle === "italic";
    const mathVariantAttr = isDifferentialItalic ? "" : 'mathvariant="normal"';

    // Generate content for integrand and differential variable
    const integrandML = this.generateMathMLContent(`${elementPath}/integrand`, element.integrand);
    const differentialVariableML = this.generateMathMLContent(`${elementPath}/differentialVariable`, element.differentialVariable);

    let integralOperatorML = "";

    if (element.isDefinite) {
      // Definite integral with limits
      const hasUpperLimit = element.upperLimit !== undefined;
      const hasLowerLimit = element.lowerLimit !== undefined;
      
      const upperML = hasUpperLimit ? this.generateMathMLContent(`${elementPath}/upperLimit`, element.upperLimit) : "";
      const lowerML = hasLowerLimit ? this.generateMathMLContent(`${elementPath}/lowerLimit`, element.lowerLimit) : "";

      // Use limitMode to determine positioning: "limits" = above/below, "nolimits" = side
      const useAboveBelow = element.limitMode === "limits" || (element.limitMode === "default" && element.displayMode === "display");

      if (hasUpperLimit && hasLowerLimit) {
        // Both upper and lower limits
        if (useAboveBelow) {
          integralOperatorML = `<munderover>
            <mo>${integralSymbol}</mo>
            <mrow data-context-path="${elementPath}/lowerLimit">${lowerML}</mrow>
            <mrow data-context-path="${elementPath}/upperLimit">${upperML}</mrow>
          </munderover>`;
        } else {
          integralOperatorML = `<msubsup>
            <mo>${integralSymbol}</mo>
            <mrow data-context-path="${elementPath}/lowerLimit">${lowerML}</mrow>
            <mrow data-context-path="${elementPath}/upperLimit">${upperML}</mrow>
          </msubsup>`;
        }
      } else if (hasLowerLimit) {
        // Only lower limit (subscript or under)
        if (useAboveBelow) {
          integralOperatorML = `<munder>
            <mo>${integralSymbol}</mo>
            <mrow data-context-path="${elementPath}/lowerLimit">${lowerML}</mrow>
          </munder>`;
        } else {
          integralOperatorML = `<msub>
            <mo>${integralSymbol}</mo>
            <mrow data-context-path="${elementPath}/lowerLimit">${lowerML}</mrow>
          </msub>`;
        }
      } else if (hasUpperLimit) {
        // Only upper limit (superscript or over)
        if (useAboveBelow) {
          integralOperatorML = `<mover>
            <mo>${integralSymbol}</mo>
            <mrow data-context-path="${elementPath}/upperLimit">${upperML}</mrow>
          </mover>`;
        } else {
          integralOperatorML = `<msup>
            <mo>${integralSymbol}</mo>
            <mrow data-context-path="${elementPath}/upperLimit">${upperML}</mrow>
          </msup>`;
        }
      } else {
        // No limits (shouldn't happen for definite integrals, but handle gracefully)
        integralOperatorML = `<mo>${integralSymbol}</mo>`;
      }
    } else {
      // Indefinite integral without limits
      integralOperatorML = `<mo>${integralSymbol}</mo>`;
    }

    // Combine all parts: integral symbol, integrand, space, d, variable
    return `<mrow ${displayStyle} ${classAttr} ${dataAttrs}>
      ${integralOperatorML}
      <mrow data-context-path="${elementPath}/integrand">${integrandML}</mrow>
      <mspace width="0.2em"/>
      <mi ${mathVariantAttr}>d</mi>
      <mrow data-context-path="${elementPath}/differentialVariable">${differentialVariableML}</mrow>
    </mrow>`;
  }

  private matrixToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const { rows, cols, cells, matrixType } = element;

    if (!rows || !cols || !cells) {
      return "<mtext>Invalid Matrix</mtext>";
    }

    // Generate the matrix content
    let matrixContent = "<mtable>";

    for (let row = 0; row < rows; row++) {
      matrixContent += "<mtr>";
      for (let col = 0; col < cols; col++) {
        const cellPath = `${elementPath}/cell_${row}_${col}`;
        const cellElements = cells[`cell_${row}_${col}`] || [];

        const cellContent = this.generateMathMLContent(cellPath, cellElements);
        matrixContent += `<mtd>${cellContent}</mtd>`;
      }
      matrixContent += "</mtr>";
    }

    matrixContent += "</mtable>";

    // Wrap with brackets based on matrix type
    return this.wrapMatrixWithBrackets(matrixContent, matrixType || 'parentheses', elementPath, position, isSelected, element);
  }

  private stackToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const { rows, cols, cells } = element;

    if (!rows || !cols || !cells) {
      return "<mtext>Invalid Stack</mtext>";
    }

    // Generate the stack content using mtable
    let stackContent = "<mtable>";

    for (let row = 0; row < rows; row++) {
      stackContent += "<mtr>";
      for (let col = 0; col < cols; col++) {
        const cellPath = `${elementPath}/cell_${row}_${col}`;
        const cellElements = cells[`cell_${row}_${col}`] || [];

        const cellContent = this.generateMathMLContent(cellPath, cellElements);
        stackContent += `<mtd>${cellContent}</mtd>`;
      }
      stackContent += "</mtr>";
    }

    stackContent += "</mtable>";

    // Stack has no brackets - just return the table content
    const classes: string[] = [];
    if (isSelected) classes.push("selected-structure");

    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    return `<mrow ${classAttr} ${dataAttrs}>${stackContent}</mrow>`;
  }

  private casesToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const { rows, cols, cells } = element;

    if (!rows || !cols || !cells) {
      return "<mtext>Invalid Cases</mtext>";
    }

    // Generate the cases content using mtable
    let casesContent = "<mtable>";

    for (let row = 0; row < rows; row++) {
      casesContent += "<mtr>";
      for (let col = 0; col < cols; col++) {
        const cellPath = `${elementPath}/cell_${row}_${col}`;
        const cellElements = cells[`cell_${row}_${col}`] || [];

        const cellContent = this.generateMathMLContent(cellPath, cellElements);
        casesContent += `<mtd>${cellContent}</mtd>`;
      }
      casesContent += "</mtr>";
    }

    casesContent += "</mtable>";

    // Wrap with left brace only
    return this.wrapCasesWithBrace(casesContent, elementPath, position, isSelected, element);
  }

  private wrapCasesWithBrace(casesContent: string, elementPath: string, position: number, isSelected: boolean, element: EquationElement): string {
    const classes: string[] = [];
    if (isSelected) classes.push("selected-structure");

    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";

    const styleAttr = this.buildStructureStyle(element, isSelected);
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    // Cases only have a left brace
    return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>
      <mo stretchy="true">{</mo>
      ${casesContent}
    </mrow>`;
  }

  private wrapMatrixWithBrackets(matrixContent: string, matrixType: string, elementPath: string, position: number, isSelected: boolean, element: EquationElement): string {
    const classes: string[] = [];
    if (isSelected) classes.push("selected-structure");

    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";

    const styleAttr = this.buildStructureStyle(element, isSelected);
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    switch (matrixType) {
      case "parentheses":
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>
          <mo stretchy="true">(</mo>
          ${matrixContent}
          <mo stretchy="true">)</mo>
        </mrow>`;
      case "brackets":
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>
          <mo stretchy="true">[</mo>
          ${matrixContent}
          <mo stretchy="true">]</mo>
        </mrow>`;
      case "braces":
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>
          <mo stretchy="true">{</mo>
          ${matrixContent}
          <mo stretchy="true">}</mo>
        </mrow>`;
      case "bars":
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>
          <mo stretchy="true">|</mo>
          ${matrixContent}
          <mo stretchy="true">|</mo>
        </mrow>`;
      case "double-bars":
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>
          <mo stretchy="true">∥</mo>
          ${matrixContent}
          <mo stretchy="true">∥</mo>
        </mrow>`;
      case "none":
      default:
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>${matrixContent}</mrow>`;
    }
  }

  private accentToMathML(
    element: EquationElement,
    elementPath: string,
    isActive: boolean,
    position: number,
    isSelected: boolean = false
  ): string {
    const basePath = `${elementPath}/${element.id}/accentBase`;
    const baseContent = this.generateMathMLContent(basePath, element.accentBase);

    // Build attributes
    const classes: string[] = [];
    if (isSelected) classes.push("selected-structure");

    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";
    const styleAttr = this.buildStructureStyle(element, isSelected);
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    // Get the accent symbol and determine if it should stretch
    const accentSymbol = this.getAccentSymbol(element.accentType || "hat");
    const isStretchy = this.isStretchyAccent(element.accentType || "hat");
    const stretchyAttr = isStretchy ? ' stretchy="true"' : '';

    // For wide accents, apply background color directly
    // For single accents, we'll use overlay approach for precise positioning
    const isSingleAccent = !isStretchy;
    let styledBaseContent = baseContent;
    
    if (!isSingleAccent) {
      // Wide accents: apply light grey background directly
      const baseStyle = 'style="background-color: #f0f0f0; border-radius: 2px; padding: 1px 2px; display: inline-block;"';
      styledBaseContent = `<mrow ${baseStyle} data-context-path="${basePath}">${baseContent}</mrow>`;
    } else {
      // Single accents: use plain content
      styledBaseContent = `<mrow data-context-path="${basePath}">${baseContent}</mrow>`;
    }

    if (element.accentPosition === "under") {
      // Handle braces with labels
      if (
        (element.accentType === "underbrace" &&
          element.accentLabel &&
          element.accentLabel.length > 0) ||
        element.accentType === "labeledunderbrace"
      ) {
        const labelPath = `${elementPath}/${element.id}/accentLabel`;
        const labelContent = this.generateMathMLContent(labelPath, element.accentLabel);
        return `<munder ${classAttr} ${styleAttr} ${dataAttrs}>
          <munder>
            ${styledBaseContent}
            <mo${stretchyAttr}>${accentSymbol}</mo>
          </munder>
          ${labelContent}
        </munder>`;
      } else {
        return `<munder ${classAttr} ${styleAttr} ${dataAttrs}>
          ${styledBaseContent}
          <mo${stretchyAttr}>${accentSymbol}</mo>
        </munder>`;
      }
    } else {
      // Handle braces with labels
      if (
        (element.accentType === "overbrace" &&
          element.accentLabel &&
          element.accentLabel.length > 0) ||
        element.accentType === "labeledoverbrace"
      ) {
        const labelPath = `${elementPath}/${element.id}/accentLabel`;
        const labelContent = this.generateMathMLContent(labelPath, element.accentLabel);
        return `<mover ${classAttr} ${styleAttr} ${dataAttrs}>
          <mover>
            ${styledBaseContent}
            <mo${stretchyAttr}>${accentSymbol}</mo>
          </mover>
          ${labelContent}
        </mover>`;
      } else {
        return `<mover ${classAttr} ${styleAttr} ${dataAttrs}>
          ${styledBaseContent}
          <mo${stretchyAttr}>${accentSymbol}</mo>
        </mover>`;
      }
    }
  }

  private getAccentSymbol(accentType: string): string {
    switch (accentType) {
      case "hat":
        return "^";
      case "tilde":
        return "~";
      case "bar":
        return "‾";
      case "dot":
        return "·";
      case "ddot":
        return "¨";
      case "vec":
        return "→";
      case "widehat":
        return "^"; // hat symbol for wide hat
      case "widetilde":
        return "∼"; // tilde operator for wide tilde
      case "widebar":
        return "‾"; // line for wide bar (will be stretchy)
      case "overrightarrow":
        return "⟶"; // long rightwards arrow for overrightarrow (more stretchable)
      case "overleftarrow":
        return "⟵"; // long leftwards arrow for overleftarrow (more stretchable)
      case "overleftrightarrow":
        return "⟷"; // left right arrow for overleftrightarrow (stretchable)
      case "overbrace":
        return "⏞";
      case "underbrace":
        return "⏟";
      case "labeledoverbrace":
        return "⏞"; // same symbol as overbrace
      case "labeledunderbrace":
        return "⏟"; // same symbol as underbrace
      case "overparen":
        return "⏜"; // arc over symbol for overparen
      case "underparen":
        return "⏝"; // arc under symbol for underparen
      default:
        return "^";
    }
  }

  private isStretchyAccent(accentType: string): boolean {
    // Wide accents and line-based accents should stretch
    switch (accentType) {
      case "widehat":
      case "widetilde":
      case "widebar":
      case "overrightarrow":
      case "overleftarrow":
      case "overleftrightarrow":
      case "overbrace":
      case "underbrace":
      case "labeledoverbrace":
      case "labeledunderbrace":
      case "overparen":
      case "underparen":
        return true;
      // Single-character accents should NOT stretch (maintain fixed size)
      case "hat":
      case "tilde":
      case "bar":
      case "dot":
      case "ddot":
      case "vec":
      default:
        return false;
    }
  }

  private createWrapperOverlays(displayElement: HTMLElement, elements: EquationElement[]): void {
    const overlayContainer = displayElement.querySelector(".wrapper-overlays") as HTMLElement;
    if (!overlayContainer) return;

    // Clear existing overlays
    overlayContainer.innerHTML = "";

    // Collect all underlined elements and group them by wrapper ID
    const underlineGroups = new Map<string, { elements: HTMLElement[], type: "single" | "double" }>();
    // Collect all canceled elements and group them by wrapper ID
    const cancelGroups = new Map<string, HTMLElement[]>();

    this.findElementsWithWrappers(elements, (element, domElement) => {
      if (element.wrappers) {
        // Handle underline wrappers
        if (element.wrappers.underline) {
          const wrapperId = element.wrappers.underline.id;
          if (!underlineGroups.has(wrapperId)) {
            underlineGroups.set(wrapperId, {
              elements: [],
              type: element.wrappers.underline.type,
            });
          }
          underlineGroups.get(wrapperId)!.elements.push(domElement);
        }

        // Handle cancel wrappers
        if (element.wrappers.cancel) {
          const wrapperId = element.wrappers.cancel.id;
          if (!cancelGroups.has(wrapperId)) {
            cancelGroups.set(wrapperId, []);
          }
          cancelGroups.get(wrapperId)!.push(domElement);
        }
      }
    });

    // Create underlines for each group
    underlineGroups.forEach((group, wrapperId) => {
      this.createGroupedUnderlineOverlay(overlayContainer, group.elements, group.type);
    });

    // Create cancel overlays for each group
    cancelGroups.forEach((elements, wrapperId) => {
      this.createGroupedCancelOverlay(overlayContainer, elements);
    });
  }

  private findElementsWithWrappers(
    elements: EquationElement[],
    callback: (element: EquationElement, domElement: HTMLElement) => void
  ): void {
    elements.forEach((element) => {
      if (element.wrappers && Object.keys(element.wrappers).length > 0) {
        // Find the DOM element for this equation element
        const domElement = document.querySelector(`[data-element-id="${element.id}"]`) as HTMLElement;
        if (domElement) {
          callback(element, domElement);
        }
      }

      // Recursively check nested elements
      if (element.numerator) this.findElementsWithWrappers(element.numerator, callback);
      if (element.denominator) this.findElementsWithWrappers(element.denominator, callback);
      if (element.base) this.findElementsWithWrappers(element.base, callback);
      if (element.superscript) this.findElementsWithWrappers(element.superscript, callback);
      if (element.subscript) this.findElementsWithWrappers(element.subscript, callback);
      if (element.radicand) this.findElementsWithWrappers(element.radicand, callback);
      if (element.index) this.findElementsWithWrappers(element.index, callback);
      if (element.content) this.findElementsWithWrappers(element.content, callback);
      if (element.function) this.findElementsWithWrappers(element.function, callback);
      if (element.variable) this.findElementsWithWrappers(element.variable, callback);
      if (element.integrand) this.findElementsWithWrappers(element.integrand, callback);
      if (element.differentialVariable) this.findElementsWithWrappers(element.differentialVariable, callback);
      if (element.operand) this.findElementsWithWrappers(element.operand, callback);
      if (element.upperLimit) this.findElementsWithWrappers(element.upperLimit, callback);
      if (element.lowerLimit) this.findElementsWithWrappers(element.lowerLimit, callback);

      // Handle accent elements
      if (element.accentBase) this.findElementsWithWrappers(element.accentBase, callback);
      if (element.accentLabel) this.findElementsWithWrappers(element.accentLabel, callback);

      // Handle matrix, stack, and cases cells
      if (element.cells) {
        Object.values(element.cells).forEach((cellElements) => {
          this.findElementsWithWrappers(cellElements, callback);
        });
      }
    });
  }

  private createGroupedUnderlineOverlay(overlayContainer: HTMLElement, elements: HTMLElement[], type: "single" | "double"): void {
    if (elements.length === 0) return;

    const containerRect = overlayContainer.getBoundingClientRect();

    // Find the leftmost position, rightmost position, and lowest bottom
    let leftmost = Infinity;
    let rightmost = -Infinity;
    let lowestBottom = -Infinity;

    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      leftmost = Math.min(leftmost, rect.left);
      rightmost = Math.max(rightmost, rect.right);
      lowestBottom = Math.max(lowestBottom, rect.bottom);
    });

    // Calculate position relative to overlay container
    const left = leftmost - containerRect.left;
    const width = rightmost - leftmost;
    const top = lowestBottom - containerRect.top + 1; // Position slightly below the lowest element

    if (type === "double") {
      // Create double underline
      const underline1 = document.createElement("div");
      underline1.style.cssText = `
        position: absolute;
        left: ${left}px;
        top: ${top}px;
        width: ${width}px;
        height: 1px;
        background-color: currentColor;
        pointer-events: none;
      `;

      const underline2 = document.createElement("div");
      underline2.style.cssText = `
        position: absolute;
        left: ${left}px;
        top: ${top + 3}px;
        width: ${width}px;
        height: 1px;
        background-color: currentColor;
        pointer-events: none;
      `;

      overlayContainer.appendChild(underline1);
      overlayContainer.appendChild(underline2);
    } else {
      // Create single underline
      const underline = document.createElement("div");
      underline.style.cssText = `
        position: absolute;
        left: ${left}px;
        top: ${top}px;
        width: ${width}px;
        height: 1px;
        background-color: currentColor;
        pointer-events: none;
      `;

      overlayContainer.appendChild(underline);
    }
  }

  private createGroupedCancelOverlay(overlayContainer: HTMLElement, elements: HTMLElement[]): void {
    if (elements.length === 0) return;

    const containerRect = overlayContainer.getBoundingClientRect();

    // Find the bounding box of all elements
    let leftmost = Infinity;
    let rightmost = -Infinity;
    let topmost = Infinity;
    let bottommost = -Infinity;

    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      leftmost = Math.min(leftmost, rect.left);
      rightmost = Math.max(rightmost, rect.right);
      topmost = Math.min(topmost, rect.top);
      bottommost = Math.max(bottommost, rect.bottom);
    });

    // Calculate position and size relative to overlay container
    const left = leftmost - containerRect.left;
    const top = topmost - containerRect.top;
    const width = rightmost - leftmost;
    const height = bottommost - topmost;

    // Create SVG for the diagonal line
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.cssText = `
      position: absolute;
      left: ${left}px;
      top: ${top}px;
      width: ${width}px;
      height: ${height}px;
      pointer-events: none;
      overflow: visible;
    `;

    // Create the diagonal line from top-left to bottom-right
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(width));
    line.setAttribute("x2", "0");
    line.setAttribute("y1", "0");
    line.setAttribute("y2", String(height));
    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", "1.5");

    svg.appendChild(line);
    overlayContainer.appendChild(svg);
  }

  private functionToMathML(element: EquationElement, contextPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const elementPath = `${contextPath}/${element.id}`;
    
    // Build class attribute for selection
    const classes = [];
    if (isActive) classes.push("active-element");
    if (isSelected) classes.push("selected-structure");
    const classAttr = classes.length > 0 ? `class="${classes.join(" ")}"` : "";
    
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}" ${classAttr}`;
    
    // Get function type to determine structure
    const functionType = element.functionType || "";
    
    // Generate content for different function parts
    const argumentContent = this.generateMathMLContent(`${elementPath}/functionArgument`, element.functionArgument);
    const baseContent = this.generateMathMLContent(`${elementPath}/functionBase`, element.functionBase);
    const constraintContent = this.generateMathMLContent(`${elementPath}/functionConstraint`, element.functionConstraint);
    
    // Use centralized function type mapping
    const structureType = FUNCTION_TYPE_MAP[functionType] || functionType;
    
    // Check if this is a user-defined function type
    const isUserDefinedFunction = ["function", "functionsub", "functionlim"].includes(functionType!);
    
    // Handle user-defined functions first
    if (isUserDefinedFunction) {
      const nameContent = this.generateMathMLContent(`${elementPath}/functionName`, element.functionName);
      
      if (functionType === "function") {
        // Simple user-defined function
        return `<mrow ${dataAttrs}>
          ${nameContent}
          <mrow>${argumentContent}</mrow>
        </mrow>`;
        
      } else if (functionType === "functionsub") {
        // User-defined function with subscript
        return `<mrow ${dataAttrs}>
          <msub>
            ${nameContent}
            <mrow>${baseContent}</mrow>
          </msub>
          <mrow>${argumentContent}</mrow>
        </mrow>`;
        
      } else if (functionType === "functionlim") {
        // User-defined function with underscript
        return `<mrow ${dataAttrs}>
          <munder>
            ${nameContent}
            <mrow>${constraintContent}</mrow>
          </munder>
          <mrow>${argumentContent}</mrow>
        </mrow>`;
      }
    }
    
    // Handle built-in functions
    if (structureType === "simple") {
      // Built-in simple functions: show predefined function name with argument
      const functionNames: { [key: string]: string } = {
        "sin": "sin", "cos": "cos", "tan": "tan", "sec": "sec", "csc": "csc", "cot": "cot",
        "asin": "sin⁻¹", "acos": "cos⁻¹", "atan": "tan⁻¹",
        "log": "log", "ln": "ln",
        "sinh": "sinh", "cosh": "cosh", "tanh": "tanh",
        "asinh": "sinh⁻¹", "acosh": "cosh⁻¹", "atanh": "tanh⁻¹"
      };
      const functionName = functionNames[functionType] || functionType;
      
      return `<mrow ${dataAttrs}>
        <mo mathvariant="normal">${functionName}</mo>
        <mrow>${argumentContent}</mrow>
      </mrow>`;
      
    } else if (structureType === "functionsub") {
      // Built-in functions with subscript (like log_n)
      return `<mrow ${dataAttrs}>
        <msub>
          <mo mathvariant="normal">log</mo>
          <mrow>${baseContent}</mrow>
        </msub>
        <mrow>${argumentContent}</mrow>
      </mrow>`;
      
    } else if (structureType === "functionlim") {
      // Built-in limit operators with underscript
      const operatorNames: { [key: string]: string } = {
        "max": "max", "min": "min", "lim": "lim",
        "argmax": "argmax", "argmin": "argmin"
      };
      const operatorName = operatorNames[functionType] || functionType;
      
      return `<mrow ${dataAttrs}>
        <munder>
          <mo mathvariant="normal">${operatorName}</mo>
          <mrow>${constraintContent}</mrow>
        </munder>
        <mrow>${argumentContent}</mrow>
      </mrow>`;
      
    }
    
    // Fallback
    return `<mrow ${dataAttrs}><mrow>${argumentContent}</mrow></mrow>`;
  }

  private generateMathMLContent(contextPath: string, elements?: EquationElement[]): string {
    if (!elements || elements.length === 0) {
      const activeContextPath = this.contextManager.getActiveContextPath();
      if (activeContextPath === contextPath) {
        return `<mspace class="cursor" data-context-path="${contextPath}" data-position="0" />`;
      }
      // Add active-context class to empty placeholder squares when they're in the active context
      const isActiveContext = activeContextPath === contextPath;
      const activeClass = isActiveContext ? " active-context" : "";
      return `<mi class="placeholder-square${activeClass}" data-context-path="${contextPath}" data-position="0">&#x25A1;</mi>`;
    }
    return this.generateMathML(elements, contextPath);
  }
}
