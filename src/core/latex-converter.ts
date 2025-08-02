import { EquationElement, EquationBuilder } from './equation-builder';

export class LatexConverter {
  private equationBuilder: EquationBuilder | null = null;

  setEquationBuilder(equationBuilder: EquationBuilder): void {
    this.equationBuilder = equationBuilder;
  }

  convertToLatex(elements: EquationElement[]): string {
    const maxDepth = this.findMaxNestingDepth(elements);
    return this.toLatexRecursive(elements, maxDepth).trim();
  }

  parseFromLatex(latex: string): EquationElement[] {
    return this.parseLatexToEquation(latex);
  }

  isValidLatex(text: string): boolean {
    // Check for LaTeX commands
    if (text.includes("\\") || text.includes("{") || text.includes("}")) {
      return true;
    }
    
    // For simple mathematical expressions, be more specific:
    // Must contain at least one operator or variable pattern
    const trimmed = text.trim();
    
    // Check if it contains operators
    const hasMathOperators = /[+\-=×÷]/.test(trimmed);
    
    // Check if it has variable patterns (letter followed by number, or standalone variables)
    const hasVariables = /[a-zA-Z][0-9]|[a-zA-Z]\s*[+\-=×÷]|[+\-=×÷]\s*[a-zA-Z]/.test(trimmed);
    
    // Only accept if it looks like a mathematical expression and contains only valid characters
    const hasValidCharsOnly = /^[a-zA-Z0-9+\-=×÷\s\(\)\.]+$/.test(trimmed);
    
    return hasValidCharsOnly && (hasMathOperators || hasVariables) && trimmed.length > 0;
  }

  private findMaxNestingDepth(elements: EquationElement[]): number {
    let maxDepth = 0;
    
    const findMaxDepthRecursive = (elements: EquationElement[]): number => {
      let localMax = 0;
      
      elements.forEach((element) => {
        if (element.type === "bracket") {
          localMax = Math.max(localMax, element.nestingDepth || 0);
          localMax = Math.max(localMax, findMaxDepthRecursive(element.content || []));
        } else {
          // Recursively check all array properties of the element
          const childArrays = [
            element.numerator, element.denominator, // fraction, bevelled-fraction
            element.radicand, element.index,        // sqrt, nthroot
            element.base, element.superscript, element.subscript, // script
            element.content                         // bracket (already handled above)
          ].filter(Boolean);
          
          childArrays.forEach(childArray => {
            localMax = Math.max(localMax, findMaxDepthRecursive(childArray));
          });
        }
      });
      
      return localMax;
    };
    
    return findMaxDepthRecursive(elements);
  }

  private toLatexRecursive(elements: EquationElement[], maxDepth: number = 0): string {
    let latex = "";
    
    // Group consecutive text elements with same formatting
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      
      if (element.type === "text") {
        // Look ahead to group consecutive text elements with same formatting
        let groupedText = "";
        let j = i;
        let currentBold = element.bold;
        
        while (j < elements.length && 
               elements[j].type === "text" && 
               elements[j].bold === currentBold) {
          let value = elements[j].value || "";
          if (value === "×") value = "\\times";
          if (value === "÷") value = "\\div";
          if (value === "±") value = "\\pm";
          if (value === "∓") value = "\\mp";
          if (value === "·") value = "\\cdot";
          if (value === "∗") value = "\\ast";
          if (value === "⋆") value = "\\star";
          if (value === "∘") value = "\\circ";
          if (value === "•") value = "\\bullet";
          if (value === "≠") value = "\\neq";
          if (value === "∼") value = "\\sim";
          if (value === "≃") value = "\\simeq";
          if (value === "≈") value = "\\approx";
          if (value === "≡") value = "\\equiv";
          if (value === "≅") value = "\\cong";
          if (value === "≇") value = "\\ncong";
          if (value === "∝") value = "\\propto";
          if (value === "≤") value = "\\leq";
          if (value === "≥") value = "\\geq";
          if (value === "≮") value = "\\nless";
          if (value === "≯") value = "\\ngtr";
          if (value === "≰") value = "\\nleq";
          if (value === "≱") value = "\\ngeq";
          if (value === "≺") value = "\\prec";
          if (value === "≻") value = "\\succ";
          if (value === "⪯") value = "\\preceq";
          if (value === "⪰") value = "\\succeq";
          if (value === "≪") value = "\\ll";
          if (value === "≫") value = "\\gg";
          if (value === "∩") value = "\\cap";
          if (value === "∪") value = "\\cup";
          if (value === "∖") value = "\\setminus";
          if (value === "∈") value = "\\in";
          if (value === "∋") value = "\\ni";
          if (value === "∉") value = "\\notin";
          if (value === "⊂") value = "\\subset";
          if (value === "⊃") value = "\\supset";
          if (value === "⊆") value = "\\subseteq";
          if (value === "⊇") value = "\\supseteq";
          if (value === "⊈") value = "\\nsubseteq";
          if (value === "⊉") value = "\\nsupseteq";
          if (value === "⊊") value = "\\subsetneq";
          if (value === "⊋") value = "\\supsetneq";
          if (value === "⊕") value = "\\oplus";
          if (value === "⊖") value = "\\ominus";
          if (value === "⊗") value = "\\otimes";
          if (value === "⊘") value = "\\oslash";
          if (value === "⊙") value = "\\odot";
          if (value === "◁") value = "\\triangleleft";
          if (value === "▷") value = "\\triangleright";
          if (value === "≀") value = "\\wr";
          if (value === "∧") value = "\\wedge";
          if (value === "∨") value = "\\vee";
          if (value === "⊢") value = "\\vdash";
          if (value === "⊨") value = "\\models";
          if (value === "⊤") value = "\\top";
          if (value === "⊥") value = "\\bot";
          if (value === "⋈") value = "\\bowtie";
          if (value === "⋄") value = "\\diamond";
          if (value === "≍") value = "\\asymp";
          if (value === "≜") value = "\\triangleq";
          if (value === "∴") value = "\\therefore";
          if (value === "∵") value = "\\because";
          
          // Add spacing for operators
          if (/[+\-=\\times\\div]/.test(value)) {
            groupedText += ` ${value} `;
          } else {
            groupedText += value;
          }
          j++;
        }
        
        // Apply formatting to the grouped text
        let formattedText = groupedText;
        if (currentBold) {
          formattedText = `\\mathbf{${groupedText}}`;
        }
        
        latex += formattedText;
        i = j - 1; // Skip the elements which have been already processed
      } else if (element.type === "fraction") {
        const num = this.toLatexRecursive(element.numerator!, maxDepth);
        const den = this.toLatexRecursive(element.denominator!, maxDepth);
        latex += `\\frac{${num || " "}}{${den || " "}}`;
      } else if (element.type === "bevelled-fraction") {
        const num = this.toLatexRecursive(element.numerator!, maxDepth);
        const den = this.toLatexRecursive(element.denominator!, maxDepth);
        latex += `{${num || " "}}/{${den || " "}}`;
      } else if (element.type === "sqrt") {
        const radicand = this.toLatexRecursive(element.radicand!, maxDepth);
        latex += `\\sqrt{${radicand || " "}}`;
      } else if (element.type === "nthroot") {
        const index = this.toLatexRecursive(element.index!, maxDepth);
        const radicand = this.toLatexRecursive(element.radicand!, maxDepth);
        latex += `\\sqrt[${index || " "}]{${radicand || " "}}`;
      } else if (element.type === "script") {
        const base = this.toLatexRecursive(element.base!, maxDepth);
        latex += `{${base || " "}}`;
        if (element.superscript && element.subscript) {
          latex += `^{${this.toLatexRecursive(element.superscript, maxDepth) || " "}}_{${this.toLatexRecursive(element.subscript, maxDepth) || " "}}`;
        } else if (element.superscript) {
          latex += `^{${this.toLatexRecursive(element.superscript, maxDepth) || " "}}`;
        } else if (element.subscript) {
          latex += `_{${this.toLatexRecursive(element.subscript, maxDepth) || " "}}`;
        }
      } else if (element.type === "bracket") {
        const content = this.toLatexRecursive(element.content!, maxDepth);
        const { latexLeft, latexRight } = this.getBracketLatexSymbols(
          element.leftBracketSymbol!,
          element.rightBracketSymbol!,
          element.nestingDepth || 0,
          maxDepth
        );
        latex += `${latexLeft}${content || " "}${latexRight}`;
      }
    }
    return latex;
  }

  private parseLatexToEquation(latex: string): EquationElement[] {
    const result: EquationElement[] = [];
    let i = 0;

    while (i < latex.length) {
      if (latex.substr(i, 5) === "\\frac") {
        i += 5;
        const numerator = this.parseLatexGroup(latex, i);
        i = numerator.endIndex;
        const denominator = this.parseLatexGroup(latex, i);
        i = denominator.endIndex;

        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "fraction",
          numerator: this.parseLatexToEquation(numerator.content),
          denominator: this.parseLatexToEquation(denominator.content)
        });
      } else if (latex.substr(i, 5) === "\\sqrt") {
        i += 5;
        
        if (i < latex.length && latex[i] === "[") {
          const indexStart = i + 1;
          let indexEnd = indexStart;
          let bracketCount = 1;
          
          while (indexEnd < latex.length && bracketCount > 0) {
            if (latex[indexEnd] === "[") bracketCount++;
            else if (latex[indexEnd] === "]") bracketCount--;
            indexEnd++;
          }
          
          const indexContent = latex.substring(indexStart, indexEnd - 1);
          i = indexEnd;
          
          const radicand = this.parseLatexGroup(latex, i);
          i = radicand.endIndex;

          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "nthroot",
            index: this.parseLatexToEquation(indexContent),
            radicand: this.parseLatexToEquation(radicand.content)
          });
        } else {
          const radicand = this.parseLatexGroup(latex, i);
          i = radicand.endIndex;

          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "sqrt",
            radicand: this.parseLatexToEquation(radicand.content)
          });
        }
      } else if (latex[i] === "^" || latex[i] === "_") {
        const isSuper = latex[i] === "^";
        i++;
        
        let baseElement: EquationElement;
        if (result.length > 0 && result[result.length - 1].type === "script") {
          baseElement = result.pop()!;
        } else if (result.length > 0) {
          const lastElement = result.pop()!;
          baseElement = {
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "script",
            base: [lastElement],
            superscript: undefined,
            subscript: undefined
          };
        } else {
          baseElement = {
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "script",
            base: [],
            superscript: undefined,
            subscript: undefined
          };
        }

        const scriptContent = this.parseLatexGroup(latex, i);
        i = scriptContent.endIndex;

        if (isSuper) {
          baseElement.superscript = this.parseLatexToEquation(scriptContent.content);
        } else {
          baseElement.subscript = this.parseLatexToEquation(scriptContent.content);
        }

        result.push(baseElement);
      } else if (latex[i] === "{") {
        const group = this.parseLatexGroup(latex, i);
        i = group.endIndex;
        result.push(...this.parseLatexToEquation(group.content));
      } else if (latex[i] === " ") {
        i++;
      } else if (latex.substr(i, 6) === "\\times") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "×"
        });
        i += 6;
      } else if (latex.substr(i, 4) === "\\div") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "÷"
        });
        i += 4;
      } else if (latex.substr(i, 3) === "\\pm") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "±"
        });
        i += 3;
      } else if (latex.substr(i, 3) === "\\mp") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∓"
        });
        i += 3;
      } else if (latex.substr(i, 5) === "\\cdot") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "·"
        });
        i += 5;
      } else if (latex.substr(i, 4) === "\\ast") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∗"
        });
        i += 4;
      } else if (latex.substr(i, 5) === "\\star") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⋆"
        });
        i += 5;
      } else if (latex.substr(i, 5) === "\\circ") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∘"
        });
        i += 5;
      } else if (latex.substr(i, 7) === "\\bullet") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "•"
        });
        i += 7;
      } else if (latex.substr(i, 4) === "\\neq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≠"
        });
        i += 4;
      } else if (latex.substr(i, 4) === "\\sim") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∼"
        });
        i += 4;
      } else if (latex.substr(i, 6) === "\\simeq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≃"
        });
        i += 6;
      } else if (latex.substr(i, 7) === "\\approx") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≈"
        });
        i += 7;
      } else if (latex.substr(i, 6) === "\\equiv") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≡"
        });
        i += 6;
      } else if (latex.substr(i, 5) === "\\cong") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≅"
        });
        i += 5;
      } else if (latex.substr(i, 6) === "\\ncong") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≇"
        });
        i += 6;
      } else if (latex.substr(i, 7) === "\\propto") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∝"
        });
        i += 7;
      } else if (latex.substr(i, 4) === "\\leq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≤"
        });
        i += 4;
      } else if (latex.substr(i, 4) === "\\geq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≥"
        });
        i += 4;
      } else if (latex.substr(i, 6) === "\\nless") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≮"
        });
        i += 6;
      } else if (latex.substr(i, 5) === "\\ngtr") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≯"
        });
        i += 5;
      } else if (latex.substr(i, 5) === "\\nleq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≰"
        });
        i += 5;
      } else if (latex.substr(i, 5) === "\\ngeq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≱"
        });
        i += 5;
      } else if (latex.substr(i, 5) === "\\prec") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≺"
        });
        i += 5;
      } else if (latex.substr(i, 5) === "\\succ") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≻"
        });
        i += 5;
      } else if (latex.substr(i, 7) === "\\preceq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⪯"
        });
        i += 7;
      } else if (latex.substr(i, 7) === "\\succeq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⪰"
        });
        i += 7;
      } else if (latex.substr(i, 3) === "\\ll") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≪"
        });
        i += 3;
      } else if (latex.substr(i, 3) === "\\gg") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≫"
        });
        i += 3;
      } else if (latex.substr(i, 4) === "\\cap") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∩"
        });
        i += 4;
      } else if (latex.substr(i, 4) === "\\cup") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∪"
        });
        i += 4;
      } else if (latex.substr(i, 9) === "\\setminus") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∖"
        });
        i += 9;
      } else if (latex.substr(i, 3) === "\\in") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∈"
        });
        i += 3;
      } else if (latex.substr(i, 3) === "\\ni") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∋"
        });
        i += 3;
      } else if (latex.substr(i, 6) === "\\notin") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∉"
        });
        i += 6;
      } else if (latex.substr(i, 7) === "\\subset") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊂"
        });
        i += 7;
      } else if (latex.substr(i, 7) === "\\supset") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊃"
        });
        i += 7;
      } else if (latex.substr(i, 9) === "\\subseteq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊆"
        });
        i += 9;
      } else if (latex.substr(i, 9) === "\\supseteq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊇"
        });
        i += 9;
      } else if (latex.substr(i, 11) === "\\nsubseteq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊈"
        });
        i += 11;
      } else if (latex.substr(i, 11) === "\\nsupseteq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊉"
        });
        i += 11;
      } else if (latex.substr(i, 10) === "\\subsetneq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊊"
        });
        i += 10;
      } else if (latex.substr(i, 10) === "\\supsetneq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊋"
        });
        i += 10;
      } else if (latex.substr(i, 6) === "\\oplus") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊕"
        });
        i += 6;
      } else if (latex.substr(i, 7) === "\\ominus") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊖"
        });
        i += 7;
      } else if (latex.substr(i, 7) === "\\otimes") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊗"
        });
        i += 7;
      } else if (latex.substr(i, 7) === "\\oslash") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊘"
        });
        i += 7;
      } else if (latex.substr(i, 5) === "\\odot") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊙"
        });
        i += 5;
      } else if (latex.substr(i, 12) === "\\triangleleft") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "◁"
        });
        i += 12;
      } else if (latex.substr(i, 13) === "\\triangleright") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "▷"
        });
        i += 13;
      } else if (latex.substr(i, 3) === "\\wr") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≀"
        });
        i += 3;
      } else if (latex.substr(i, 6) === "\\wedge") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∧"
        });
        i += 6;
      } else if (latex.substr(i, 4) === "\\vee") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∨"
        });
        i += 4;
      } else if (latex.substr(i, 6) === "\\vdash") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊢"
        });
        i += 6;
      } else if (latex.substr(i, 7) === "\\models") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊨"
        });
        i += 7;
      } else if (latex.substr(i, 4) === "\\top") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊤"
        });
        i += 4;
      } else if (latex.substr(i, 4) === "\\bot") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⊥"
        });
        i += 4;
      } else if (latex.substr(i, 7) === "\\bowtie") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⋈"
        });
        i += 7;
      } else if (latex.substr(i, 8) === "\\diamond") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "⋄"
        });
        i += 8;
      } else if (latex.substr(i, 6) === "\\asymp") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≍"
        });
        i += 6;
      } else if (latex.substr(i, 10) === "\\triangleq") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "≜"
        });
        i += 10;
      } else if (latex.substr(i, 10) === "\\therefore") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∴"
        });
        i += 10;
      } else if (latex.substr(i, 8) === "\\because") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "∵"
        });
        i += 8;
      } else if (latex.substr(i, 7) === "\\mathbf") {
        i += 7;
        const group = this.parseLatexGroup(latex, i);
        i = group.endIndex;
        const formattedElements = this.parseLatexToEquation(group.content);
        formattedElements.forEach(element => {
          if (element.type === "text") {
            element.bold = true;
          }
        });
        result.push(...formattedElements);
      } else if (latex.substr(i, 7) === "\\mathit") {
        i += 7;
        const group = this.parseLatexGroup(latex, i);
        i = group.endIndex;
        const formattedElements = this.parseLatexToEquation(group.content);
        formattedElements.forEach(element => {
          if (element.type === "text") {
            element.italic = true;
          }
        });
        result.push(...formattedElements);
      } else if (latex.substr(i, 10) === "\\textcolor") {
        i += 10;
        const colorGroup = this.parseLatexGroup(latex, i);
        i = colorGroup.endIndex;
        const contentGroup = this.parseLatexGroup(latex, i);
        i = contentGroup.endIndex;
        const formattedElements = this.parseLatexToEquation(contentGroup.content);
        formattedElements.forEach(element => {
          if (element.type === "text") {
            element.color = colorGroup.content;
          }
        });
        result.push(...formattedElements);
      } else if (latex.substr(i, 10) === "\\underline") {
        i += 10;
        const group = this.parseLatexGroup(latex, i);
        i = group.endIndex;
        const formattedElements = this.parseLatexToEquation(group.content);
        formattedElements.forEach(element => {
          if (element.type === "text") {
            element.underline = "single";
          }
        });
        result.push(...formattedElements);
      } else if (latex.substr(i, 7) === "\\cancel") {
        i += 7;
        const group = this.parseLatexGroup(latex, i);
        i = group.endIndex;
        const formattedElements = this.parseLatexToEquation(group.content);
        formattedElements.forEach(element => {
          if (element.type === "text") {
            element.strikethrough = true;
          }
        });
        result.push(...formattedElements);
      } else if (latex.substr(i, 5) === "\\left") {
        const bracketInfo = this.parseBracketCommand(latex, i);
        if (bracketInfo) {
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "bracket",
            leftBracketSymbol: bracketInfo.leftSymbol,
            rightBracketSymbol: bracketInfo.rightSymbol,
            content: this.parseLatexToEquation(bracketInfo.content),
            nestingDepth: bracketInfo.nestingDepth
          });
          i = bracketInfo.endIndex;
        } else {
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "text",
            value: latex[i]
          });
          i++;
        }
      } else if (this.isBracketCommand(latex, i)) {
        const bracketInfo = this.parseBracketCommand(latex, i);
        if (bracketInfo) {
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "bracket",
            leftBracketSymbol: bracketInfo.leftSymbol,
            rightBracketSymbol: bracketInfo.rightSymbol,
            content: this.parseLatexToEquation(bracketInfo.content),
            nestingDepth: bracketInfo.nestingDepth
          });
          i = bracketInfo.endIndex;
        } else {
          // Skip bracket commands that couldn't be parsed to prevent them appearing as text
          const skipped = this.skipBracketCommand(latex, i);
          if (skipped > 0) {
            i += skipped;
          } else {
            result.push({
              id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
              type: "text",
              value: latex[i]
            });
            i++;
          }
        }
      } else {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: latex[i]
        });
        i++;
      }
    }

    return result;
  }

  private parseLatexGroup(latex: string, startIndex: number): { content: string; endIndex: number } {
    if (latex[startIndex] !== "{") {
      return {
        content: latex[startIndex] || "",
        endIndex: startIndex + 1
      };
    }

    let braceCount = 0;
    let i = startIndex;
    
    while (i < latex.length) {
      if (latex[i] === "{") {
        braceCount++;
      } else if (latex[i] === "}") {
        braceCount--;
        if (braceCount === 0) {
          return {
            content: latex.substring(startIndex + 1, i),
            endIndex: i + 1
          };
        }
      }
      i++;
    }

    return {
      content: latex.substring(startIndex + 1),
      endIndex: latex.length
    };
  }


  private isBracketCommand(latex: string, index: number): boolean {
    const bracketCommands = ["\\left", "\\bigl", "\\Bigl", "\\biggl", "\\Biggl"];
    return bracketCommands.some(cmd => latex.substr(index, cmd.length) === cmd);
  }

  private skipBracketCommand(latex: string, index: number): number {
    const bracketCommands = ["\\left", "\\bigl", "\\Bigl", "\\biggl", "\\Biggl", "\\bigr", "\\Bigr", "\\biggr", "\\Biggr"];
    for (const cmd of bracketCommands) {
      if (latex.substr(index, cmd.length) === cmd) {
        return cmd.length;
      }
    }
    return 0;
  }

  private parseBracketCommand(latex: string, startIndex: number): { leftSymbol: string; rightSymbol: string; content: string; endIndex: number; nestingDepth: number } | null {
    // Extract the bracket command and determine nesting depth
    let leftCommand = "";
    let nestingDepth = 0;
    
    const commands = ["\\left", "\\bigl", "\\Bigl", "\\biggl", "\\Biggl"];
    for (let i = 0; i < commands.length; i++) {
      if (latex.substr(startIndex, commands[i].length) === commands[i]) {
        leftCommand = commands[i];
        if (i > 0) { // Not \left
          nestingDepth = commands.length - i - 1; // Reverse mapping for proper sizing
        }
        break;
      }
    }
    
    if (!leftCommand) return null;
    
    let pos = startIndex + leftCommand.length;
    
    // Extract the left bracket symbol
    const leftBracketInfo = this.extractBracketSymbol(latex, pos);
    if (!leftBracketInfo) return null;
    
    pos = leftBracketInfo.endIndex;
    const leftSymbol = leftBracketInfo.symbol;
    
    // Find the matching right bracket by looking for balanced brackets
    const contentStart = pos;
    let depth = 1;
    let j = pos;
    
    while (j < latex.length && depth > 0) {
      // Check for right bracket commands
      if (latex.substr(j, 6) === "\\right" || 
          latex.substr(j, 5) === "\\bigr" || 
          latex.substr(j, 5) === "\\Bigr" || 
          latex.substr(j, 6) === "\\biggr" || 
          latex.substr(j, 6) === "\\Biggr") {
        
        let rightCommandLength = latex.substr(j, 6) === "\\right" ? 6 : 
                                latex.substr(j, 6) === "\\biggr" || latex.substr(j, 6) === "\\Biggr" ? 6 : 5;
        
        const rightBracketInfo = this.extractBracketSymbol(latex, j + rightCommandLength);
        if (rightBracketInfo) {
          depth--;
          if (depth === 0) {
            const content = latex.substring(contentStart, j);
            return {
              leftSymbol,
              rightSymbol: rightBracketInfo.symbol,
              content,
              endIndex: rightBracketInfo.endIndex,
              nestingDepth
            };
          }
          j = rightBracketInfo.endIndex;
        } else {
          j++;
        }
      }
      // Check for nested left bracket commands
      else if (this.isBracketCommand(latex, j)) {
        depth++;
        j++;
      } else {
        j++;
      }
    }
    
    return null;
  }

  private extractBracketSymbol(latex: string, startIndex: number): { symbol: string; endIndex: number } | null {
    if (startIndex >= latex.length) return null;
    
    if (latex[startIndex] === "(") return { symbol: "(", endIndex: startIndex + 1 };
    if (latex[startIndex] === ")") return { symbol: ")", endIndex: startIndex + 1 };
    if (latex[startIndex] === "[") return { symbol: "[", endIndex: startIndex + 1 };
    if (latex[startIndex] === "]") return { symbol: "]", endIndex: startIndex + 1 };
    if (latex[startIndex] === "|") return { symbol: "|", endIndex: startIndex + 1 };
    
    // Only treat "." as invisible bracket if immediately following a bracket command
    if (latex[startIndex] === ".") {
      const bracketCommands = ["\\left", "\\right", "\\bigl", "\\bigr", "\\Bigl", "\\Bigr", "\\biggl", "\\biggr", "\\Biggl", "\\Biggr"];
      for (const cmd of bracketCommands) {
        if (startIndex >= cmd.length && latex.substr(startIndex - cmd.length, cmd.length) === cmd) {
          return { symbol: ".", endIndex: startIndex + 1 };
        }
      }
    }
    
    if (latex.substr(startIndex, 2) === "\\{") return { symbol: "{", endIndex: startIndex + 2 };
    if (latex.substr(startIndex, 2) === "\\}") return { symbol: "}", endIndex: startIndex + 2 };
    if (latex.substr(startIndex, 2) === "\\|") return { symbol: "‖", endIndex: startIndex + 2 };
    
    if (latex.substr(startIndex, 7) === "\\lfloor") return { symbol: "⌊", endIndex: startIndex + 7 };
    if (latex.substr(startIndex, 7) === "\\rfloor") return { symbol: "⌋", endIndex: startIndex + 7 };
    if (latex.substr(startIndex, 6) === "\\lceil") return { symbol: "⌈", endIndex: startIndex + 6 };
    if (latex.substr(startIndex, 6) === "\\rceil") return { symbol: "⌉", endIndex: startIndex + 6 };
    if (latex.substr(startIndex, 7) === "\\langle") return { symbol: "⟨", endIndex: startIndex + 7 };
    if (latex.substr(startIndex, 7) === "\\rangle") return { symbol: "⟩", endIndex: startIndex + 7 };
    
    return null;
  }

  private getBracketLatexSymbols(leftSymbol: string, rightSymbol: string, nestingDepth: number = 0, maxDepth: number = 0): { latexLeft: string; latexRight: string } {
    const sizeCommands = ["", "\\bigl", "\\Bigl", "\\biggl", "\\Biggl"];
    const sizeCommandsRight = ["", "\\bigr", "\\Bigr", "\\biggr", "\\Biggr"];
    
    // nestingDepth 0 = outermost, maxDepth = innermost depth
    // Only brackets at maxDepth should use \left/\right (smallest)
    // All others use progressively larger sizes as they get more outer
    let leftSize: string;
    let rightSize: string;
    
    if (nestingDepth === maxDepth) {
      // Innermost brackets (at maxDepth) always use \left/\right
      leftSize = "";
      rightSize = "";
    } else {
      // Calculate size based on distance from innermost
      // We want: outermost -> \Biggl, next -> \biggl, next -> \Bigl, next -> \bigl, innermost -> \left
      const distanceFromInnermost = maxDepth - nestingDepth;
      
      if (distanceFromInnermost <= 0) {
        // Should not happen since innermost is handled above, but fallback
        leftSize = "";
        rightSize = "";
      } else if (distanceFromInnermost >= sizeCommands.length) {
        // Very outer brackets use largest size
        leftSize = sizeCommands[sizeCommands.length - 1]; // \Biggl
        rightSize = sizeCommandsRight[sizeCommandsRight.length - 1]; // \Biggr
      } else {
        // Map distance to size: distance 1 -> \bigl, distance 2 -> \Bigl, etc.
        // sizeCommands[0] = "", sizeCommands[1] = \bigl, so we need distanceFromInnermost as index
        leftSize = sizeCommands[distanceFromInnermost];
        rightSize = sizeCommandsRight[distanceFromInnermost];
      }
    }

    // Map symbols to LaTeX bracket commands
    const getLatexBracket = (symbol: string, isLeft: boolean, sizeCommand: string): string => {
      if (!symbol) return "";
      
      switch (symbol) {
        case "(":
          return sizeCommand ? `${sizeCommand}(` : "\\left(";
        case ")":
          return sizeCommand ? `${sizeCommand})` : "\\right)";
        case "[":
          return sizeCommand ? `${sizeCommand}[` : "\\left[";
        case "]":
          return sizeCommand ? `${sizeCommand}]` : "\\right]";
        case "{":
          return sizeCommand ? `${sizeCommand}\\{` : "\\left\\{";
        case "}":
          return sizeCommand ? `${sizeCommand}\\}` : "\\right\\}";
        case "⌊":
          return sizeCommand ? `${sizeCommand}\\lfloor` : "\\left\\lfloor";
        case "⌋":
          return sizeCommand ? `${sizeCommand}\\rfloor` : "\\right\\rfloor";
        case "⌈":
          return sizeCommand ? `${sizeCommand}\\lceil` : "\\left\\lceil";
        case "⌉":
          return sizeCommand ? `${sizeCommand}\\rceil` : "\\right\\rceil";
        case "|":
          return sizeCommand ? `${sizeCommand}|` : "\\left|";
        case "‖":
          return sizeCommand ? `${sizeCommand}\\|` : "\\left\\|";
        case "⟨":
          return sizeCommand ? `${sizeCommand}\\langle` : "\\left\\langle";
        case "⟩":
          return sizeCommand ? `${sizeCommand}\\rangle` : "\\right\\rangle";
        case ".":
          return sizeCommand ? `${sizeCommand}.` : isLeft ? "\\left." : "\\right.";
        default:
          return symbol; // fallback to the raw symbol
      }
    };

    const latexLeft = getLatexBracket(leftSymbol, true, leftSize);
    const latexRight = getLatexBracket(rightSymbol, false, rightSize);

    return { latexLeft, latexRight };
  }

}