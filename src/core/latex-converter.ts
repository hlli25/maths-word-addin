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
        const { latexLeft, latexRight } = this.getBracketLatexSymbols(
          element.leftBracketSymbol!,
          element.rightBracketSymbol!,
          element.nestingDepth || 0
        );
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
    
    if (latex.substr(startIndex, 2) === "\\{") return { symbol: "{", endIndex: startIndex + 2 };
    if (latex.substr(startIndex, 2) === "\\}") return { symbol: "}", endIndex: startIndex + 2 };
    if (latex.substr(startIndex, 2) === "\\|") return { symbol: "‖", endIndex: startIndex + 2 };
    
    if (latex.substr(startIndex, 7) === "\\lfloor") return { symbol: "⌊", endIndex: startIndex + 7 };
    if (latex.substr(startIndex, 7) === "\\rfloor") return { symbol: "⌋", endIndex: startIndex + 7 };
    if (latex.substr(startIndex, 6) === "\\lceil") return { symbol: "⌈", endIndex: startIndex + 6 };
    if (latex.substr(startIndex, 6) === "\\rceil") return { symbol: "⌉", endIndex: startIndex + 6 };
    
    return null;
  }

  private getBracketLatexSymbols(leftSymbol: string, rightSymbol: string, nestingDepth: number = 0): { latexLeft: string; latexRight: string } {
    const sizeCommands = ["", "\\bigl", "\\Bigl", "\\biggl", "\\Biggl"];
    const sizeCommandsRight = ["", "\\bigr", "\\Bigr", "\\biggr", "\\Biggr"];
    
    // For deeper nesting, use smaller brackets (reverse index calculation)
    const reversedDepth = Math.max(0, sizeCommands.length - 1 - nestingDepth);
    const sizeIndex = Math.min(reversedDepth, sizeCommands.length - 1);
    const leftSize = sizeCommands[sizeIndex];
    const rightSize = sizeCommandsRight[sizeIndex];

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
        default:
          return symbol; // fallback to the raw symbol
      }
    };

    const latexLeft = getLatexBracket(leftSymbol, true, leftSize);
    const latexRight = getLatexBracket(rightSymbol, false, rightSize);

    return { latexLeft, latexRight };
  }

}