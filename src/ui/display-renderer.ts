import { EquationElement } from '../core/equation-builder';
import { ContextManager } from '../core/context-manager';

export class DisplayRenderer {
  private contextManager: ContextManager;
  private globalFontSize: number = 12;

  constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
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
      default:
        return '';
    }
  }

  private textToMathML(element: EquationElement, isActive: boolean, contextPath: string, position: number, isSelected: boolean = false): string {
    const value = element.value || '&#x25A1;'; // Default to a placeholder square
    const isOperator = /[+\-−×÷=<>≤≥≠±∓·∗⋆∘•∼≃≈≡≅≇∝≮≯≰≱≺≻⪯⪰≪≫∩∪∖∈∋∉⊂⊃⊆⊇⊈⊉⊊⊋⊕⊖⊗⊘⊙◁▷≀∧∨⊢⊨⊤⊥⋈⋄≍≜∴∵]/.test(value);
    const isVariable = /[a-zA-Z]/.test(value);
    const isNumber = /[0-9]/.test(value);
    const isSymbol = /[^\w\s]/.test(value); // Any non-alphanumeric, non-whitespace character
    
    let tag = 'mi';
    if (isOperator) tag = 'mo';
    else if (isNumber) tag = 'mn';
    
    let style = '';
    if (element.color) style += `color: ${element.color};`;
    if (element.bold) style += 'font-weight: bold;';
    
    // Only apply italic to variables (letters) and only if explicitly set or if it's a variable and not bold
    // Never apply italic to operators, numbers, or other symbols
    if (!isSymbol && !isOperator && !isNumber && (element.italic || (isVariable && !element.bold))) {
      style += 'font-style: italic;';
    }
    
    // Add underline styling
    if (element.underline) {
      if (element.underlineStyle === 'double') {
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

    return `<${tag} ${styleAttr} ${classAttr} ${dataAttrs}>${value}</${tag}>`;
  }

  private fractionToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const numeratorML = this.generateMathMLContent(`${elementPath}/numerator`, element.numerator);
    const denominatorML = this.generateMathMLContent(`${elementPath}/denominator`, element.denominator);
    const classAttr = isActive ? 'class="active-element"' : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;

    return `<mfrac ${classAttr} ${dataAttrs}>
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
    const classAttr = isActive ? 'class="active-element"' : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;

    return `<msqrt ${classAttr} ${dataAttrs}>
      <mrow data-context-path="${elementPath}/radicand">${radicandML}</mrow>
    </msqrt>`;
  }

  private nthRootToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const indexML = this.generateMathMLContent(`${elementPath}/index`, element.index);
    const radicandML = this.generateMathMLContent(`${elementPath}/radicand`, element.radicand);
    const classAttr = isActive ? 'class="active-element"' : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;

    return `<mroot ${classAttr} ${dataAttrs}>
      <mrow data-context-path="${elementPath}/radicand">${radicandML}</mrow>
      <mrow data-context-path="${elementPath}/index">${indexML}</mrow>
    </mroot>`;
  }

  private scriptToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const baseML = this.generateMathMLContent(`${elementPath}/base`, element.base);
    const classAttr = isActive ? 'class="active-element"' : '';
    const dataAttrs = `data-context-path="${elementPath}" data-position="${position}"`;

    if (element.superscript && element.subscript) {
      const supML = this.generateMathMLContent(`${elementPath}/superscript`, element.superscript);
      const subML = this.generateMathMLContent(`${elementPath}/subscript`, element.subscript);
      return `<msubsup ${classAttr} ${dataAttrs}>
        <mrow data-context-path="${elementPath}/base">${baseML}</mrow>
        <mrow data-context-path="${elementPath}/subscript">${subML}</mrow>
        <mrow data-context-path="${elementPath}/superscript">${supML}</mrow>
      </msubsup>`;
    } else if (element.superscript) {
      const supML = this.generateMathMLContent(`${elementPath}/superscript`, element.superscript);
      return `<msup ${classAttr} ${dataAttrs}>
        <mrow data-context-path="${elementPath}/base">${baseML}</mrow>
        <mrow data-context-path="${elementPath}/superscript">${supML}</mrow>
      </msup>`;
    } else if (element.subscript) {
      const subML = this.generateMathMLContent(`${elementPath}/subscript`, element.subscript);
      return `<msub ${classAttr} ${dataAttrs}>
        <mrow data-context-path="${elementPath}/base">${baseML}</mrow>
        <mrow data-context-path="${elementPath}/subscript">${subML}</mrow>
      </msub>`;
    }
    return `<mrow data-context-path="${elementPath}">${baseML}</mrow>`;
  }

  private bracketToMathML(element: EquationElement, elementPath: string, isActive: boolean, position: number, isSelected: boolean = false): string {
    const contentML = this.generateMathMLContent(`${elementPath}/content`, element.content);
    const leftBracket = element.leftBracketSymbol ? `<mo>${element.leftBracketSymbol}</mo>` : '';
    const rightBracket = element.rightBracketSymbol ? `<mo>${element.rightBracketSymbol}</mo>` : '';
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
    
    // Add displaystyle attribute for display mode
    const displayStyle = element.displayMode === 'display' ? 'displaystyle="true"' : '';
    
    let operatorML = '';
    if (element.limitMode === 'limits') {
      const upperML = this.generateMathMLContent(`${elementPath}/upperLimit`, element.upperLimit);
      const lowerML = this.generateMathMLContent(`${elementPath}/lowerLimit`, element.lowerLimit);
      operatorML = `<munderover ${classAttr} ${dataAttrs}>
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
    return `<mrow ${displayStyle}>
      ${operatorML}
      <mrow data-context-path="${elementPath}/operand">${operandML}</mrow>
    </mrow>`;
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