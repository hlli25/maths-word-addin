import { EquationElement, EquationBuilder } from './equation-builder';
import { getLatexToSymbolMap, UNICODE_TO_LATEX, LATEX_TO_UNICODE, getLatexCommandLength } from './symbol-config';

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

  private findMaxNestingDepth(elements: EquationElement[]): number {
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
            element.content,                        // bracket (already handled above)
            element.lowerLimit, element.upperLimit, element.operand // large-operator
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
        let currentFormatting = {
          bold: element.bold,
          italic: element.italic,
          color: element.color,
          underline: element.underline,
          cancel: element.cancel
        };
        
        while (j < elements.length && 
               elements[j].type === "text" && 
               this.hasEqualFormatting(elements[j], currentFormatting)) {
          let value = elements[j].value || "";
          
          // Convert Unicode symbols to LaTeX commands
          const latexCommand = UNICODE_TO_LATEX[value];
          if (latexCommand) {
            value = latexCommand;
          }
          
          // Escape LaTeX special characters that could break parsing
          value = this.escapeLatexSpecialChars(value);
          
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
        formattedText = this.applyFormattingToLatex(formattedText, currentFormatting);
        
        latex += formattedText;
        i = j - 1; // Skip the elements which have been already processed
      } else if (element.type === "fraction") {
        const num = this.toLatexRecursive(element.numerator!, maxDepth);
        const den = this.toLatexRecursive(element.denominator!, maxDepth);
        
        if (element.displayMode === "display") {
          latex += `\\dfrac{${num || " "}}{${den || " "}}`;
        } else {
          latex += `\\frac{${num || " "}}{${den || " "}}`;
        }
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
      } else if (element.type === "large-operator") {
        const operatorSymbol = this.convertOperatorToLatex(element.operator!);
        const lowerLimit = this.toLatexRecursive(element.lowerLimit!, maxDepth);
        const upperLimit = this.toLatexRecursive(element.upperLimit!, maxDepth);
        const operand = this.toLatexRecursive(element.operand!, maxDepth);
        
        // Check if this is marked as an indefinite integral
        const isIndefiniteIntegral = (element as any).isIndefiniteIntegral === true;
        
        let operatorLatex = operatorSymbol;
        
        if (element.limitMode === "nolimits") {
          operatorLatex += "\\nolimits";
        } else if (element.limitMode === "limits") {
          operatorLatex += "\\limits";
        }
        
        // Wrap operand in braces for predictable parsing
        const wrappedOperand = operand ? ` {${operand}}` : " {}";
        
        let finalLatex = '';
        if (isIndefiniteIntegral) {
          // Simple indefinite integral: no limits at all
          finalLatex = `${operatorLatex}${wrappedOperand}`;
        } else {
          // Definite integral or other operators: always include limit structure
          finalLatex = `${operatorLatex}_{${lowerLimit || ""}}^{${upperLimit || ""}}${wrappedOperand}`;
        }
        
        if (element.displayMode === "display") {
          latex += `{\\displaystyle ${finalLatex}}`;
        } else {
          latex += `{\\textstyle ${finalLatex}}`;
        }
      }
    }
    return latex;
  }

  private parseLatexToEquation(latex: string): EquationElement[] {
    const result: EquationElement[] = [];
    let i = 0;

    while (i < latex.length) {
      if (latex.substr(i, 13) === "\\displaystyle") {
        // Handle \displaystyle followed by large operators
        i += 13;
        // Skip whitespace after \displaystyle
        while (i < latex.length && latex[i] === " ") i++;
        
        if (this.isLargeOperator(latex, i)) {
          const operatorInfo = this.parseLargeOperator(latex, i, true); // true = display mode
          if (operatorInfo) {
            result.push(operatorInfo.element);
            i = operatorInfo.endIndex;
          } else {
            i++;
          }
        } else {
          // \displaystyle not followed by large operator
          // Future: will support other expressions like \frac, \sqrt, etc.
          // Now: treat as text
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "text",
            value: "\\displaystyle"
          });
        }
      } else if (latex.substr(i, 10) === "\\textstyle") {
        // Handle \textstyle (inline mode) - just skip it as operators default to inline
        i += 10;
        // Skip whitespace after \textstyle
        while (i < latex.length && latex[i] === " ") i++;
        
        if (this.isLargeOperator(latex, i)) {
          const operatorInfo = this.parseLargeOperator(latex, i, false); // false = inline mode
          if (operatorInfo) {
            result.push(operatorInfo.element);
            i = operatorInfo.endIndex;
          } else {
            i++;
          }
        }
        // If not followed by large operator, just continue (skip the \textstyle)
      } else if (latex.substr(i, 6) === "\\dfrac") {
        i += 6;
        const numerator = this.parseLatexGroup(latex, i);
        i = numerator.endIndex;
        const denominator = this.parseLatexGroup(latex, i);
        i = denominator.endIndex;

        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "fraction",
          displayMode: "display", // dfrac is display-style
          numerator: this.parseLatexToEquation(numerator.content),
          denominator: this.parseLatexToEquation(denominator.content)
        });
      } else if (latex.substr(i, 5) === "\\frac") {
        i += 5;
        const numerator = this.parseLatexGroup(latex, i);
        i = numerator.endIndex;
        const denominator = this.parseLatexGroup(latex, i);
        i = denominator.endIndex;

        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "fraction",
          displayMode: "inline", // frac is inline-style
          numerator: this.parseLatexToEquation(numerator.content),
          denominator: this.parseLatexToEquation(denominator.content)
        });
      } else if (this.isLargeOperator(latex, i)) {
        // Parse large operators like \sum, \prod, \int, etc.
        const operatorInfo = this.parseLargeOperator(latex, i, false); // false = inline mode
        if (operatorInfo) {
          result.push(operatorInfo.element);
          i = operatorInfo.endIndex;
        } else {
          i++;
        }
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
      // Check for LaTeX symbol commands
      } else if (latex[i] === "\\" && !this.isBracketCommand(latex, i) && !this.isLargeOperator(latex, i)) {
        // Try to parse as a LaTeX symbol command
        const newIndex = this.tryParseLatexSymbol(latex, i, result);
        if (newIndex !== null) {
          i = newIndex;
        } else if (latex.substr(i, 11) === "\\boldsymbol") {
        i += 11;
        const group = this.parseLatexGroup(latex, i);
        i = group.endIndex;
        const formattedElements = this.parseLatexToEquation(group.content);
        formattedElements.forEach(element => {
          if (element.type === "text") {
            element.bold = true;
            element.italic = true;
          }
        });
        result.push(...formattedElements);
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
      } else if (latex.substr(i, 7) === "\\mathrm") {
        i += 7;
        const group = this.parseLatexGroup(latex, i);
        i = group.endIndex;
        const formattedElements = this.parseLatexToEquation(group.content);
        formattedElements.forEach(element => {
          if (element.type === "text") {
            element.italic = false; // Explicitly roman style
          }
        });
        result.push(...formattedElements);
      } else if (latex.substr(i, 7) === "\\textbf") {
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
      } else if (latex.substr(i, 7) === "\\textit") {
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
      } else if (latex.substr(i, 6) === "\\color") {
        i += 6;
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
        
        // Check if this is a double underline (nested \underline)
        const isDoubleUnderline = group.content.startsWith("\\underline{") && group.content.endsWith("}");
        
        if (isDoubleUnderline) {
          // Parse the inner content for double underline
          const innerContent = group.content.slice(11, -1); // Remove \underline{ and }
          const formattedElements = this.parseLatexToEquation(innerContent);
          formattedElements.forEach(element => {
            if (element.type === "text") {
              element.underline = "double";
            }
          });
          result.push(...formattedElements);
        } else {
          // Single underline
          const formattedElements = this.parseLatexToEquation(group.content);
          formattedElements.forEach(element => {
            if (element.type === "text") {
              element.underline = "single";
            }
          });
          result.push(...formattedElements);
        }
      } else if (latex.substr(i, 7) === "\\cancel") {
        i += 7;
        const group = this.parseLatexGroup(latex, i);
        i = group.endIndex;
        const formattedElements = this.parseLatexToEquation(group.content);
        formattedElements.forEach(element => {
          if (element.type === "text") {
            element.cancel = true;
          }
        });
        result.push(...formattedElements);
        } else {
          i++; // Unknown command, skip it
        }
      } else if (latex.substr(i, 10) === "{\\text{^}}") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "^"
        });
        i += 10;
      } else if (latex.substr(i, 5) === "{\\_}") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "_"
        });
        i += 5;
      } else if (latex.substr(i, 5) === "\\text") {
        // Handle \text{} commands specially
        if (latex.substr(i, 9) === "\\text{＆}") {
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "text",
            value: "&"
          });
          i += 9;
        } else {
          // Handle other \text{} commands
          i += 5; // Skip \text
          const group = this.parseLatexGroup(latex, i);
          i = group.endIndex;
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "text",
            value: group.content
          });
        }
      } else if (latex.substr(i, 17) === "\\textasciitilde") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "~"
        });
        i += 17;
        // Skip the {} if present
        if (latex.substr(i, 2) === "{}") {
          i += 2;
        }
      } else if (latex.substr(i, 2) === "\\{") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "{"
        });
        i += 2;
      } else if (latex.substr(i, 2) === "\\}") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "}"
        });
        i += 2;
      } else if (latex.substr(i, 2) === "\\#") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "#"
        });
        i += 2;
      } else if (latex.substr(i, 2) === "\\%") {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: "%"
        });
        i += 2;
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
    // Extract the bracket command
    let leftCommand = "";
    let nestingDepth = 0;
    
    const commands = ["\\left", "\\bigl", "\\Bigl", "\\biggl", "\\Biggl"];
    for (let i = 0; i < commands.length; i++) {
      if (latex.substr(startIndex, commands[i].length) === commands[i]) {
        leftCommand = commands[i];
        // Don't try to infer nesting depth from command size
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

  private hasEqualFormatting(element: EquationElement, formatting: any): boolean {
    return element.bold === formatting.bold &&
           element.italic === formatting.italic &&
           element.color === formatting.color &&
           element.underline === formatting.underline &&
           element.cancel === formatting.cancel;
  }

  private applyFormattingToLatex(text: string, formatting: any): string {
    let result = text;
    
    
    // Special handling for differential 'd' when italic is explicitly false
    if (text.trim() === "d" && formatting.italic === false) {
      // Use \mathrm{d} for roman-style differential, preserving any spacing
      result = text.replace("d", "\\mathrm{d}");
      // Don't apply further italic formatting since we want roman style
    } else {
      // Apply formatting in the correct nesting order
      // Bold and italic (innermost)
      if (formatting.bold && formatting.italic) {
        // For numbers, use \textbf with \textit, since \boldsymbol doesn't support numbers well
        if (/^\d+$/.test(text.trim())) {
          result = `\\textit{\\textbf{${result}}}`;
        } else {
          result = `\\boldsymbol{${result}}`;
        }
      } else if (formatting.bold) {
        result = `\\mathbf{${result}}`;
      } else if (formatting.italic) {
        result = `\\mathit{${result}}`;
      }
    }
    
    // Underline
    if (formatting.underline) {
      if (formatting.underline === "double") {
        // Double underline using nested \underline commands
        result = `\\underline{\\underline{${result}}}`;
      } else {
        // Single underline (default for all other types)
        result = `\\underline{${result}}`;
      }
    }
    
    // Cancel
    if (formatting.cancel) {
      result = `\\cancel{${result}}`;
    }
    
    // Color (outermost)
    if (formatting.color) {
      result = `\\textcolor{${formatting.color}}{${result}}`;
    }
    
    return result;
  }

  private convertOperatorToLatex(operator: string): string {
    const operatorMap = getLatexToSymbolMap();
    
    // Find LaTeX command for the given symbol
    for (const [command, symbol] of Object.entries(operatorMap)) {
      if (symbol === operator) {
        return command;
      }
    }
    
    return operator; // Return as-is if not found
  }

  private isLatexCommand(latex: string, index: number): boolean {
    // Check if this is the start of a LaTeX command (backslash followed by letters)
    if (latex[index] !== '\\') return false;
    let pos = index + 1;
    while (pos < latex.length && latex[pos].match(/[a-zA-Z]/)) {
      pos++;
    }
    return pos > index + 1; // Must have at least one letter after backslash
  }

  private isLargeOperator(latex: string, index: number): boolean {
    const operators = Object.keys(getLatexToSymbolMap());
    
    // Check if any operator matches at this position
    return operators.some(op => {
      if (latex.substr(index, op.length) === op) {
        // Make sure the next character is not a letter (to avoid partial matches)
        const nextCharIndex = index + op.length;
        if (nextCharIndex >= latex.length || 
            !latex[nextCharIndex].match(/[a-zA-Z]/)) {
          return true;
        }
      }
      return false;
    });
  }

  private parseLargeOperator(latex: string, index: number, forceDisplayMode?: boolean): { element: EquationElement; endIndex: number } | null {
    const operatorMap = getLatexToSymbolMap();
    
    // Find which operator matches
    let operatorCommand = "";
    let operatorSymbol = "";
    
    for (const [command, symbol] of Object.entries(operatorMap)) {
      if (latex.substr(index, command.length) === command) {
        operatorCommand = command;
        operatorSymbol = symbol;
        break;
      }
    }
    
    if (!operatorCommand) {
      return null;
    }
    
    let pos = index + operatorCommand.length;
    let limitMode = "limits"; // default
    let displayMode = forceDisplayMode ? "display" : "inline"; // Use forced display mode if provided
    
    // Check for \limits, \nolimits
    if (latex.substr(pos, 7) === "\\limits") {
      limitMode = "limits";
      pos += 7;
    } else if (latex.substr(pos, 9) === "\\nolimits") {
      limitMode = "nolimits";
      pos += 9;
    }
    
    // Parse subscript and superscript (limits)
    let lowerLimit: EquationElement[] = [];
    let upperLimit: EquationElement[] = [];
    let operand: EquationElement[] = [];
    
    // Skip whitespace
    while (pos < latex.length && latex[pos] === " ") pos++;
    
    // Parse _ (subscript/lower limit)
    if (pos < latex.length && latex[pos] === "_") {
      pos++;
      const limitGroup = this.parseLatexGroup(latex, pos);
      lowerLimit = this.parseLatexToEquation(limitGroup.content);
      pos = limitGroup.endIndex;
    }
    
    // Skip whitespace
    while (pos < latex.length && latex[pos] === " ") pos++;
    
    // Parse ^ (superscript/upper limit)
    if (pos < latex.length && latex[pos] === "^") {
      pos++;
      const limitGroup = this.parseLatexGroup(latex, pos);
      upperLimit = this.parseLatexToEquation(limitGroup.content);
      pos = limitGroup.endIndex;
    }
    
    // Parse operand (now wrapped in braces for predictable parsing)
    // Skip whitespace
    while (pos < latex.length && latex[pos] === " ") pos++;
    
    // The operand should be in braces after the limits
    if (pos < latex.length && latex[pos] === "{") {
      const operandGroup = this.parseLatexGroup(latex, pos);
      operand = this.parseLatexToEquation(operandGroup.content);
      pos = operandGroup.endIndex;
    }
    
    const element: EquationElement = {
      id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
      type: "large-operator",
      operator: operatorSymbol,
      limitMode,
      displayMode,
      lowerLimit,
      upperLimit,
      operand
    };
    
    return { element, endIndex: pos };
  }

  private escapeLatexSpecialChars(text: string): string {
    // Escape LaTeX special characters that could break parsing
    // Only escape characters that haven't already been converted to LaTeX commands
    let result = text;
    
    // Don't escape if the text is already a LaTeX command (starts with \)
    if (result.startsWith('\\')) {
      return result;
    }
    
    // Escape special characters that could break LaTeX parsing
    // Backslash is blocked from input due to MathJax spacing issues
    result = result.replace(/\{/g, '\\{');              // Opening brace
    result = result.replace(/\}/g, '\\}');              // Closing brace
    result = result.replace(/#/g, '\\#');               // Hash
    // Replace & with similar Unicode character that MathJax can handle
    result = result.replace(/&/g, '\\text{＆}');         // Fullwidth ampersand (U+FF06)
    result = result.replace(/%/g, '\\%');               // Percent (comment character)
    result = result.replace(/~/g, '\\textasciitilde{}'); // Tilde
    
    // Escape ^ and _ when they should be literal characters (not superscript/subscript)
    // In math mode, these are special operators, so we need to escape them for literal display
    result = result.replace(/\^/g, '{\\text{^}}'); // Caret in text mode without backslash
    result = result.replace(/_/g, '{\\_}');        // Underscore escaped in math mode
    
    return result;
  }

  private tryParseLatexSymbol(latex: string, index: number, result: EquationElement[]): number | null {
    // Check if we have a LaTeX symbol command at this position
    const commandLength = getLatexCommandLength(latex, index);
    if (commandLength > 0) {
      const command = latex.substr(index, commandLength);
      const unicode = LATEX_TO_UNICODE[command];
      if (unicode) {
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "text",
          value: unicode
        });
        return index + commandLength;
      }
    }
    return null;
  }

}