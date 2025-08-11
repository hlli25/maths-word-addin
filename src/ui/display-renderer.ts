import { EquationElement } from '../core/equation-builder';
import { ContextManager } from '../core/context-manager';
import { getIntegralSymbol, UNICODE_TO_LATEX } from '../core/symbol-config';

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
      displayElement.innerHTML = '<span class="empty-state">Click here and start typing your equation</span>';
      displayElement.classList.remove("active");
      return;
    }

    displayElement.classList.toggle("active", activeContextPath !== null);
    
    const mathmlContent = this.generateMathML(elements, "root");
    const visualHTML = `
      <div class="visual-equation-container" style="font-size: ${this.globalFontSize * 1.5}px;">
        ${mathmlContent}
      </div>
    `;
    
    displayElement.innerHTML = visualHTML;
  }

  private generateMathML(elements: EquationElement[], contextPath: string): string {
    const activeContextPath = this.contextManager.getActiveContextPath();
    const cursorPosition = this.contextManager.getCursorPosition();
    const selection = this.contextManager.getSelection();

    // Add active-context class to the container mrow if this is the active context
    const isActiveContext = activeContextPath === contextPath;
    const containerClass = isActiveContext ? 'active-context' : '';
    const containerClassAttr = containerClass ? ` class="${containerClass}"` : '';

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
    
    mathmlContent += '</mrow></math>';
    return mathmlContent;
  }

  private elementToMathML(element: EquationElement, contextPath: string, position: number, isSelected: boolean = false): string {
    const activeContextPath = this.contextManager.getActiveContextPath();
    const isActive = activeContextPath === contextPath;

    switch (element.type) {
      case 'text':
        return this.textToMathML(element, isActive, contextPath, position, isSelected);
      case 'fraction':
        return this.fractionToMathML(element, contextPath, isActive, position, isSelected);
      case 'bevelled-fraction':
        return this.bevelledFractionToMathML(element, contextPath, isActive, position, isSelected);
      case 'sqrt':
        return this.sqrtToMathML(element, contextPath, isActive, position, isSelected);
      case 'nthroot':
        return this.nthRootToMathML(element, contextPath, isActive, position, isSelected);
      case 'script':
        return this.scriptToMathML(element, contextPath, isActive, position, isSelected);
      case 'bracket':
        return this.bracketToMathML(element, contextPath, isActive, position, isSelected);
      case 'large-operator':
        return this.largeOperatorToMathML(element, contextPath, isActive, position, isSelected);
      case 'derivative':
        return this.derivativeToMathML(element, contextPath, isActive, position, isSelected);
      case 'integral':
        return this.integralToMathML(element, contextPath, isActive, position, isSelected);
      case 'matrix':
        return this.matrixToMathML(element, contextPath, isActive, position, isSelected);
      default:
        return '';
    }
  }

  private textToMathML(element: EquationElement, isActive: boolean, contextPath: string, position: number, isSelected: boolean = false): string {
    const value = element.value || '&#x25A1;'; // Default to a placeholder square
    const isOperator = /[+\-−×÷=<>≤≥≠±∓·∗⋆∘•∼≃≈≡≅≇∝≮≯≰≱≺≻⪯⪰≪≫∩∪∖∈∋∉⊂⊃⊆⊇⊈⊉⊊⊋⊕⊖⊗⊘⊙◁▷≀∧∨⊢⊨⊤⊥⋈⋄≍≜∴∵]/.test(value);
    const isVariable = /[a-zA-Z]/.test(value);
    const isNumber = /[0-9]/.test(value);
    const isSymbol = /[^\w\s]/.test(value);
    
    let tag = 'mi';
    if (isOperator) tag = 'mo';
    else if (isNumber) tag = 'mn';
    
    let style = '';
    if (element.color) style += `color: ${element.color};`;
    if (element.bold) style += 'font-weight: bold;';
    
    // Add underline styling
    if (element.underline) {
      if (element.underline === 'double') {
        style += 'text-decoration: underline; border-bottom: 1px solid currentColor; padding-bottom: 1px;';
      } else {
        style += 'text-decoration: underline;';
      }
    }
    
    // Add selection highlighting
    if (isSelected) {
      style += 'background-color: #0078d4; color: white; border-radius: 2px; padding: 1px 2px;';
    }
    
    const styleAttr = style ? `style="${style}"` : '';
    
    // Handle italic styling using mathvariant attribute for mi elements, inline styles for others
    let mathVariantAttr = '';
    if (tag === 'mi') {
      // For <mi> elements, use mathvariant attribute to control italic behavior
      let shouldBeItalic = false;
      
      if (element.italic === true) {
        shouldBeItalic = true;
      } else if (element.italic === false) {
        shouldBeItalic = false;
      } else if (isVariable && !element.bold && element.italic !== false) {
        // Variables default to italic unless bold or explicitly set to normal
        shouldBeItalic = true;
      }
      
      // Set mathvariant to "normal" to override default italic behavior of <mi>
      if (!shouldBeItalic) {
        mathVariantAttr = 'mathvariant="normal"';
      }
      // If shouldBeItalic is true, we don't set mathvariant and let <mi> use its default italic
    } else {
      // For non-mi elements (mo, mn), use inline styles as before
      if (element.italic === true) {
        style += 'font-style: italic;';
      } else if (element.italic === false) {
        style += 'font-style: normal;';
      } else if (isVariable && !element.bold && element.italic !== false) {
        // Variables default to italic unless bold or explicitly set to normal
        style += 'font-style: italic;';
      }
    }
    
    const classNames = [];
    if (isActive) classNames.push('active-element');
    if (isSelected) classNames.push('selected');
    if (element.cancel) classNames.push('math-cancel');
    
    // Add active-context class if this is the active context
    const activeContextPath = this.contextManager.getActiveContextPath();
    if (activeContextPath === contextPath) {
      classNames.push('active-context');
    }
    
    const classAttr = classNames.length > 0 ? `class="${classNames.join(' ')}"` : '';
    const dataAttrs = `data-context-path="${contextPath}" data-position="${position}"`;
    
    // Update styleAttr if we modified style for non-mi elements
    const finalStyleAttr = style ? `style="${style}"` : '';

    return `<${tag} ${finalStyleAttr} ${mathVariantAttr} ${classAttr} ${dataAttrs}>${value}</${tag}>`;
  }

  private fractionToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const numeratorML = this.generateMathMLContent(`${elementPath}/numerator`, element.numerator);
    const denominatorML = this.generateMathMLContent(`${elementPath}/denominator`, element.denominator);
    
    // Add classes for active element, selection, and display mode
    const classes = [];
    if (isActive) classes.push('active-element');
    if (isSelected) classes.push('selected-structure');
    if (element.displayMode === 'display') classes.push('display-fraction');
    if (element.underline) classes.push('underlined-structure');
    const classAttr = classes.length > 0 ? `class="${classes.join(' ')}"` : '';
    
    // Add style for underline
    let style = '';
    if (element.underline) {
      if (element.underline === 'double') {
        style = 'style="text-decoration: underline; border-bottom: 1px solid currentColor;"';
      } else {
        style = 'style="text-decoration: underline;"';
      }
    }
    
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;
    
    // Add displaystyle attribute for display mode fractions
    const displayStyle = element.displayMode === 'display' ? 'displaystyle="true"' : '';

    return `<mfrac ${displayStyle} ${classAttr} ${style} ${dataAttrs}>
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
    if (isActive) classes.push('active-element');
    if (isSelected) classes.push('selected-structure');
    if (element.underline) classes.push('underlined-structure');
    const classAttr = classes.length > 0 ? `class="${classes.join(' ')}"` : '';
    
    // Add style for underline
    let style = '';
    if (element.underline) {
      if (element.underline === 'double') {
        style = 'style="text-decoration: underline; border-bottom: 1px solid currentColor;"';
      } else {
        style = 'style="text-decoration: underline;"';
      }
    }
    
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    return `<msqrt ${classAttr} ${style} ${dataAttrs}>
      <mrow data-context-path="${elementPath}/radicand">${radicandML}</mrow>
    </msqrt>`;
  }

  private nthRootToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const indexML = this.generateMathMLContent(`${elementPath}/index`, element.index);
    const radicandML = this.generateMathMLContent(`${elementPath}/radicand`, element.radicand);
    const classes = [];
    if (isActive) classes.push('active-element');
    if (isSelected) classes.push('selected-structure');
    const classAttr = classes.length > 0 ? `class="${classes.join(' ')}"` : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    return `<mroot ${classAttr} ${dataAttrs}>
      <mrow data-context-path="${elementPath}/radicand">${radicandML}</mrow>
      <mrow data-context-path="${elementPath}/index">${indexML}</mrow>
    </mroot>`;
  }

  private scriptToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const baseML = this.generateMathMLContent(`${elementPath}/base`, element.base);
    const classes = [];
    if (isActive) classes.push('active-element');
    if (isSelected) classes.push('selected-structure');
    if (element.underline) classes.push('underlined-structure');
    const classAttr = classes.length > 0 ? `class="${classes.join(' ')}"` : '';
    
    // Add style for underline
    let style = '';
    if (element.underline) {
      if (element.underline === 'double') {
        style = 'style="text-decoration: underline; border-bottom: 1px solid currentColor;"';
      } else {
        style = 'style="text-decoration: underline;"';
      }
    }
    
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}" data-element-id="${element.id}"`;

    if (element.superscript && element.subscript) {
      const supML = this.generateMathMLContent(`${elementPath}/superscript`, element.superscript);
      const subML = this.generateMathMLContent(`${elementPath}/subscript`, element.subscript);
      return `<msubsup ${classAttr} ${style} ${dataAttrs}>
        <mrow data-context-path="${elementPath}/base">${baseML}</mrow>
        <mrow data-context-path="${elementPath}/subscript">${subML}</mrow>
        <mrow data-context-path="${elementPath}/superscript">${supML}</mrow>
      </msubsup>`;
    } else if (element.superscript) {
      const supML = this.generateMathMLContent(`${elementPath}/superscript`, element.superscript);
      return `<msup ${classAttr} ${style} ${dataAttrs}>
        <mrow data-context-path="${elementPath}/base">${baseML}</mrow>
        <mrow data-context-path="${elementPath}/superscript">${supML}</mrow>
      </msup>`;
    } else if (element.subscript) {
      const subML = this.generateMathMLContent(`${elementPath}/subscript`, element.subscript);
      return `<msub ${classAttr} ${style} ${dataAttrs}>
        <mrow data-context-path="${elementPath}/base">${baseML}</mrow>
        <mrow data-context-path="${elementPath}/subscript">${subML}</mrow>
      </msub>`;
    }
    return `<mrow data-context-path="${elementPath}">${baseML}</mrow>`;
  }

  private bracketToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const contentML = this.generateMathMLContent(`${elementPath}/content`, element.content);
    
    // Apply MathML sizing based on nesting depth to match LaTeX bracket sizes
    // Depth 0 = outermost (largest), higher depth = more nested (smaller)
    const nestingDepth = element.nestingDepth || 0;
    
    // Determine bracket size based on nesting depth
    // Outermost brackets (depth 0) are largest, innermost are smallest
    let bracketSize = "2em"; // Default large size for outermost
    if (nestingDepth === 1) {
      bracketSize = "1.6em";
    } else if (nestingDepth === 2) {
      bracketSize = "1.3em";
    } else if (nestingDepth >= 3) {
      bracketSize = "1em";
    }
    
    const leftBracket = element.leftBracketSymbol ? 
      `<mo stretchy="true" symmetric="true" minsize="${bracketSize}" maxsize="${bracketSize}">${element.leftBracketSymbol}</mo>` : '';
    const rightBracket = element.rightBracketSymbol ? 
      `<mo stretchy="true" symmetric="true" minsize="${bracketSize}" maxsize="${bracketSize}">${element.rightBracketSymbol}</mo>` : '';
    
    const classAttr = isActive ? 'class="active-element"' : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;

    return `<mrow ${classAttr} ${dataAttrs}>
      ${leftBracket}
      <mrow data-context-path="${elementPath}/content">${contentML}</mrow>
      ${rightBracket}
    </mrow>`;
  }

  private largeOperatorToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const operator = element.operator || '&#x2211;';
    const operandML = this.generateMathMLContent(`${elementPath}/operand`, element.operand);
    const classAttr = isActive ? 'class="active-element"' : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;
    
    // Check if this is marked as an indefinite integral
    const isIndefiniteIntegral = (element as any).isIndefiniteIntegral === true;
    
    // Add displaystyle attribute for display mode OR limits mode (to force proper limit positioning)
    const displayStyle = (element.displayMode === 'display' || element.limitMode === 'limits') ? 'displaystyle="true"' : '';
    
    // Get data-operator attribute for all operator types
    const operatorData = this.getOperatorDataAttribute(operator);
    
    let operatorML = '';
    if (isIndefiniteIntegral) {
      // Simple indefinite integral without limits
      operatorML = `<mo ${classAttr} ${dataAttrs}>${operator}</mo>`;
    } else if (element.limitMode === 'limits') {
      const upperML = this.generateMathMLContent(`${elementPath}/upperLimit`, element.upperLimit);
      const lowerML = this.generateMathMLContent(`${elementPath}/lowerLimit`, element.lowerLimit);
      // Distinguish regular limits from display limits for sizing
      const limitsClass = element.displayMode === 'display' ? 'display-limits' : 'inline-limits';
      operatorML = `<munderover class="${limitsClass}" ${operatorData} ${classAttr} ${dataAttrs}>
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
    return `<mrow ${displayStyle} ${operatorData}>
      ${operatorML}
      <mrow data-context-path="${elementPath}/operand">${operandML}</mrow>
    </mrow>`;
  }

  private getOperatorDataAttribute(operator: string): string {
    // Convert operator symbol to LaTeX command, then use that as the name
    const latexCommand = UNICODE_TO_LATEX[operator];
    const operatorName = latexCommand ? latexCommand.substring(1) : 'unknown'; // Remove the backslash
    return `data-operator="${operatorName}"`;
  }

  private derivativeToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const classAttr = isActive ? 'class="active-element"' : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;
    
    // Add displaystyle attribute for display mode derivatives
    const displayStyle = element.displayMode === 'display' ? 'displaystyle="true"' : '';
    
    // Check current differential style preference from context manager
    const isDifferentialItalic = this.getDifferentialStylePreference();
    const mathVariantAttr = isDifferentialItalic ? '' : 'mathvariant="normal"';
    
    // Check if this is long form derivative
    if (element.isLongForm) {
      return this.derivativeLongFormToMathML(element, elementPath, isActive, position, isSelected, displayStyle, mathVariantAttr);
    }
    
    // Generate content for each part (standard form)
    const functionML = this.generateMathMLContent(`${elementPath}/function`, element.function);
    const variableML = this.generateMathMLContent(`${elementPath}/variable`, element.variable);
    
    let numeratorContent = '';
    let denominatorContent = '';
    
    if (typeof element.order === 'number') {
      // Numeric order (1, 2, 3, ...)
      if (element.order === 1) {
        numeratorContent = `<mi ${mathVariantAttr}>d</mi>${functionML}`;
        denominatorContent = `<mi ${mathVariantAttr}>d</mi>${variableML}`;
      } else {
        numeratorContent = `<msup>
          <mi ${mathVariantAttr}>d</mi>
          <mn>${element.order}</mn>
        </msup>${functionML}`;
        denominatorContent = `<mi ${mathVariantAttr}>d</mi><msup>
          ${variableML}
          <mn>${element.order}</mn>
        </msup>`;
      }
    } else {
      // nth order with custom expression
      const orderML = this.generateMathMLContent(`${elementPath}/order`, element.order);
      numeratorContent = `<msup>
        <mi ${mathVariantAttr}>d</mi>
        <mrow data-context-path="${elementPath}/order">${orderML}</mrow>
      </msup>${functionML}`;
      
      // For denominator, create a read-only copy without editable context
      const readOnlyOrderML = element.order && element.order.length > 0 ? 
        element.order.map(el => el.value || '').join('') : '';
      denominatorContent = `<mi ${mathVariantAttr}>d</mi><msup>
        ${variableML}
        <mi>${readOnlyOrderML || '&#x25A1;'}</mi>
      </msup>`;
    }

    return `<mfrac ${displayStyle} ${classAttr} ${dataAttrs}>
      <mrow data-context-path="${elementPath}/function">${numeratorContent}</mrow>
      <mrow data-context-path="${elementPath}/variable">${denominatorContent}</mrow>
    </mfrac>`;
  }

  private getDifferentialStylePreference(): boolean {
    // Get differential style from input handler (true = italic, false = roman)
    if (this.inputHandler && typeof this.inputHandler.getDifferentialStyleForLatex === 'function') {
      // Invert the logic since getDifferentialStyleForLatex returns true for roman (physics package)
      // but we need true for italic display
      return !this.inputHandler.getDifferentialStyleForLatex();
    }
    return true; // Default to italic if no input handler
  }

  private derivativeLongFormToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean, displayStyle: string, mathVariantAttr: string): string {
    const classAttr = isActive ? 'class="active-element"' : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;
    
    // Generate content for each part
    const functionML = this.generateMathMLContent(`${elementPath}/function`, element.function);
    const variableML = this.generateMathMLContent(`${elementPath}/variable`, element.variable);
    
    let fractionContent = '';
    
    if (typeof element.order === 'number') {
      // Numeric order (1, 2, 3, ...)
      if (element.order === 1) {
        // d/dx format
        fractionContent = `<mfrac ${displayStyle}>
          <mi ${mathVariantAttr}>d</mi>
          <mrow data-context-path="${elementPath}/variable">
            <mi ${mathVariantAttr}>d</mi>
            ${variableML}
          </mrow>
        </mfrac>`;
      } else {
        // d^n/dx^n format
        fractionContent = `<mfrac ${displayStyle}>
          <msup>
            <mi ${mathVariantAttr}>d</mi>
            <mn>${element.order}</mn>
          </msup>
          <mrow data-context-path="${elementPath}/variable">
            <mi ${mathVariantAttr}>d</mi>
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
          <mi ${mathVariantAttr}>d</mi>
          <mrow data-context-path="${elementPath}/order">${orderML}</mrow>
        </msup>
        <mrow data-context-path="${elementPath}/variable">
          <mi ${mathVariantAttr}>d</mi>
          <msup>
            ${variableML}
            <mi>${readOnlyOrderML || '&#x25A1;'}</mi>
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
    const classAttr = isActive ? 'class="active-element"' : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;
    
    // Add displaystyle attribute for display mode integrals
    const displayStyle = element.displayMode === 'display' ? 'displaystyle="true"' : '';
    
    // Get the integral symbol based on type
    const integralSymbol = getIntegralSymbol(element.integralType || 'single');
    
    // Check differential style preference
    const isDifferentialItalic = element.integralStyle === 'italic';
    const mathVariantAttr = isDifferentialItalic ? '' : 'mathvariant="normal"';
    
    // Generate content for integrand and differential variable
    const integrandML = this.generateMathMLContent(`${elementPath}/integrand`, element.integrand);
    const differentialVariableML = this.generateMathMLContent(`${elementPath}/differentialVariable`, element.differentialVariable);
    
    let integralOperatorML = '';
    
    if (element.hasLimits) {
      // Definite integral with limits
      const upperML = this.generateMathMLContent(`${elementPath}/upperLimit`, element.upperLimit);
      const lowerML = this.generateMathMLContent(`${elementPath}/lowerLimit`, element.lowerLimit);
      
      // Use limitMode to determine positioning: "limits" = above/below, "nolimits" = side
      const useAboveBelow = element.limitMode === "limits" || (element.limitMode === "default" && element.displayMode === "display");
      
      if (useAboveBelow) {
        // Limits above and below
        integralOperatorML = `<munderover>
          <mo>${integralSymbol}</mo>
          <mrow data-context-path="${elementPath}/lowerLimit">${lowerML}</mrow>
          <mrow data-context-path="${elementPath}/upperLimit">${upperML}</mrow>
        </munderover>`;
      } else {
        // Limits as subscript and superscript (side)
        integralOperatorML = `<msubsup>
          <mo>${integralSymbol}</mo>
          <mrow data-context-path="${elementPath}/lowerLimit">${lowerML}</mrow>
          <mrow data-context-path="${elementPath}/upperLimit">${upperML}</mrow>
        </msubsup>`;
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
      return '<mtext>Invalid Matrix</mtext>';
    }

    // Generate the matrix content
    let matrixContent = '<mtable>';
    
    for (let row = 0; row < rows; row++) {
      matrixContent += '<mtr>';
      for (let col = 0; col < cols; col++) {
        const cellPath = `${elementPath}/cell_${row}_${col}`;
        const cellElements = cells[`cell_${row}_${col}`] || [];
        
        const cellContent = this.generateMathMLContent(cellPath, cellElements);
        matrixContent += `<mtd>${cellContent}</mtd>`;
      }
      matrixContent += '</mtr>';
    }
    
    matrixContent += '</mtable>';

    // Wrap with brackets based on matrix type
    return this.wrapMatrixWithBrackets(matrixContent, matrixType || 'parentheses', elementPath, position, isSelected, element);
  }

  private wrapMatrixWithBrackets(matrixContent: string, matrixType: string, elementPath: string, position: number, isSelected: boolean, element: EquationElement): string {
    const classes: string[] = [];
    if (isSelected) classes.push('selected-structure');
    
    // Apply structure-level formatting styling
    if (element.cancel) classes.push('math-cancel');
    
    const classAttr = classes.length > 0 ? `class="${classes.join(' ')}"` : '';
    
    // Build inline styles for structure-level formatting
    let style = '';
    if (isSelected) {
      style += 'background-color: #0078d4; color: white; border-radius: 3px; padding: 2px;';
    } else {
      // Apply matrix structure formatting when not selected
      if (element.color) {
        style += `color: ${element.color};`;
      }
      if (element.underline) {
        if (element.underline === 'double') {
          style += 'text-decoration: underline; border-bottom: 1px solid currentColor; padding-bottom: 1px;';
        } else {
          style += 'text-decoration: underline;';
        }
      }
    }
    
    const styleAttr = style ? `style="${style}"` : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;

    switch (matrixType) {
      case 'parentheses':
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>
          <mo stretchy="true">(</mo>
          ${matrixContent}
          <mo stretchy="true">)</mo>
        </mrow>`;
      case 'brackets':
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>
          <mo stretchy="true">[</mo>
          ${matrixContent}
          <mo stretchy="true">]</mo>
        </mrow>`;
      case 'braces':
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>
          <mo stretchy="true">{</mo>
          ${matrixContent}
          <mo stretchy="true">}</mo>
        </mrow>`;
      case 'bars':
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>
          <mo stretchy="true">|</mo>
          ${matrixContent}
          <mo stretchy="true">|</mo>
        </mrow>`;
      case 'double-bars':
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>
          <mo stretchy="true">∥</mo>
          ${matrixContent}
          <mo stretchy="true">∥</mo>
        </mrow>`;
      case 'none':
      default:
        return `<mrow ${classAttr} ${styleAttr} ${dataAttrs}>${matrixContent}</mrow>`;
    }
  }

  private generateMathMLContent(contextPath: string, elements?: EquationElement[]): string {
    if (!elements || elements.length === 0) {
      const activeContextPath = this.contextManager.getActiveContextPath();
      if (activeContextPath === contextPath) {
        return `<mspace class="cursor" data-context-path="${contextPath}" data-position="0" />`;
      }
      // Add active-context class to empty placeholder squares when they're in the active context
      const isActiveContext = activeContextPath === contextPath;
      const activeClass = isActiveContext ? ' active-context' : '';
      return `<mi class="placeholder-square${activeClass}" data-context-path="${contextPath}" data-position="0">&#x25A1;</mi>`;
    }
    return this.generateMathML(elements, contextPath);
  }
}