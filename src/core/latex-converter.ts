import { EquationElement, EquationBuilder } from './equation-builder';

export class LatexConverter {
  private equationBuilder: EquationBuilder | null = null;

  setEquationBuilder(equationBuilder: EquationBuilder): void {
    this.equationBuilder = equationBuilder;
  }

  convertToLatex(elements: EquationElement[]): string {
    return this.toLatexRecursive(elements).trim();
  }

  parseFromLatex(latex: string): EquationElement[] {
    return this.parseLatexToEquation(latex);
  }

  isValidLatex(text: string): boolean {
    return text.includes("\\") || text.includes("{") || text.includes("}");
  }

  private toLatexRecursive(elements: EquationElement[]): string {
    let latex = "";
    elements.forEach((element) => {
      if (element.type === "text") {
        let value = element.value || "";
        if (value === "×") value = "\\times";
        if (value === "÷") value = "\\div";
        if (/[a-zA-Z]/.test(value)) {
          latex += value;
        } else if (/[+\-=\\times\\div]/.test(value)) {
          latex += ` ${value} `;
        } else {
          latex += value;
        }
      } else if (element.type === "fraction") {
        const num = this.toLatexRecursive(element.numerator!);
        const den = this.toLatexRecursive(element.denominator!);
        latex += `\\frac{${num || " "}}{${den || " "}}`;
      } else if (element.type === "bevelled-fraction") {
        const num = this.toLatexRecursive(element.numerator!);
        const den = this.toLatexRecursive(element.denominator!);
        latex += `{${num || " "}}/{${den || " "}}`;
      } else if (element.type === "sqrt") {
        const radicand = this.toLatexRecursive(element.radicand!);
        latex += `\\sqrt{${radicand || " "}}`;
      } else if (element.type === "nthroot") {
        const index = this.toLatexRecursive(element.index!);
        const radicand = this.toLatexRecursive(element.radicand!);
        latex += `\\sqrt[${index || " "}]{${radicand || " "}}`;
      } else if (element.type === "script") {
        const base = this.toLatexRecursive(element.base!);
        latex += `{${base || " "}}`;
        if (element.superscript && element.subscript) {
          latex += `^{${this.toLatexRecursive(element.superscript) || " "}}_{${this.toLatexRecursive(element.subscript) || " "}}`;
        } else if (element.superscript) {
          latex += `^{${this.toLatexRecursive(element.superscript) || " "}}`;
        } else if (element.subscript) {
          latex += `_{${this.toLatexRecursive(element.subscript) || " "}}`;
        }
      } else if (element.type === "bracket") {
        const content = this.toLatexRecursive(element.content!);
        const { latexLeft, latexRight } = this.getBracketLatexSymbols(element.bracketType!);
        latex += `${latexLeft}${content || " "}${latexRight}`;
      }
    });
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
      } else if (latex.substr(i, 5) === "\\left") {
        const bracketInfo = this.parseLatexBracket(latex, i);
        if (bracketInfo) {
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "bracket",
            bracketType: bracketInfo.bracketType,
            content: this.parseLatexToEquation(bracketInfo.content)
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

  private parseLatexBracket(latex: string, startIndex: number): { bracketType: "parentheses" | "square" | "curly" | "floor" | "ceiling" | "vertical" | "double-vertical"; content: string; endIndex: number } | null {
    if (latex.substr(startIndex, 5) !== "\\left") {
      return null;
    }
    
    let i = startIndex + 5;
    
    let bracketType: "parentheses" | "square" | "curly" | "floor" | "ceiling" | "vertical" | "double-vertical";
    let expectedRight: string;
    
    if (latex[i] === "(") {
      bracketType = "parentheses";
      expectedRight = "\\right)";
      i++;
    } else if (latex[i] === "[") {
      bracketType = "square";
      expectedRight = "\\right]";
      i++;
    } else if (latex.substr(i, 2) === "\\{") {
      bracketType = "curly";
      expectedRight = "\\right\\}";
      i += 2;
    } else if (latex.substr(i, 7) === "\\lfloor") {
      bracketType = "floor";
      expectedRight = "\\right\\rfloor";
      i += 7;
    } else if (latex.substr(i, 6) === "\\lceil") {
      bracketType = "ceiling";
      expectedRight = "\\right\\rceil";
      i += 6;
    } else if (latex.substr(i, 2) === "\\|") {
      bracketType = "double-vertical";
      expectedRight = "\\right\\|";
      i += 2;
    } else if (latex[i] === "|") {
      bracketType = "vertical";
      expectedRight = "\\right|";
      i++;
    } else {
      return null;
    }
    
    const contentStart = i;
    let depth = 1;
    let j = i;
    
    while (j < latex.length && depth > 0) {
      if (latex.substr(j, 5) === "\\left") {
        depth++;
        j += 5;
      } else if (latex.substr(j, 6) === "\\right") {
        depth--;
        if (depth === 0) {
          if (latex.substr(j, expectedRight.length) === expectedRight) {
            const content = latex.substring(contentStart, j);
            return {
              bracketType,
              content,
              endIndex: j + expectedRight.length
            };
          } else {
            return null;
          }
        } else {
          let rightCommandLength = 6;
          if (latex.substr(j, 8) === "\\right\\{" || latex.substr(j, 8) === "\\right\\|") {
            rightCommandLength = 8;
          } else if (latex.substr(j, 13) === "\\right\\rfloor") {
            rightCommandLength = 13;
          } else if (latex.substr(j, 12) === "\\right\\rceil") {
            rightCommandLength = 12;
          } else if (latex.substr(j, 7) === "\\right)" || latex.substr(j, 7) === "\\right]" || latex.substr(j, 7) === "\\right|") {
            rightCommandLength = 7;
          }
          j += rightCommandLength;
        }
      } else {
        j++;
      }
    }
    
    return null;
  }

  private getBracketLatexSymbols(bracketType: "parentheses" | "square" | "curly" | "floor" | "ceiling" | "vertical" | "double-vertical"): { latexLeft: string; latexRight: string } {
    switch (bracketType) {
      case "parentheses":
        return { latexLeft: "\\left(", latexRight: "\\right)" };
      case "square":
        return { latexLeft: "\\left[", latexRight: "\\right]" };
      case "curly":
        return { latexLeft: "\\left\\{", latexRight: "\\right\\}" };
      case "floor":
        return { latexLeft: "\\left\\lfloor", latexRight: "\\right\\rfloor" };
      case "ceiling":
        return { latexLeft: "\\left\\lceil", latexRight: "\\right\\rceil" };
      case "vertical":
        return { latexLeft: "\\left|", latexRight: "\\right|" };
      case "double-vertical":
        return { latexLeft: "\\left\\|", latexRight: "\\right\\|" };
      default:
        return { latexLeft: "\\left(", latexRight: "\\right)" };
    }
  }
}