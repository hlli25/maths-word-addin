import { EquationElement, EquationBuilder } from './equation-builder';
import { UNICODE_TO_LATEX, LATEX_TO_UNICODE, getLatexCommandLength, LARGE_OPERATORS, BRACKET_PAIRS, INTEGRAL_COMMANDS } from './symbol-config';

export class LatexConverter {
  private equationBuilder: EquationBuilder | null = null;
  private inputHandler: any = null; // Will be properly typed later

  setEquationBuilder(equationBuilder: EquationBuilder): void {
    this.equationBuilder = equationBuilder;
  }

  setInputHandler(inputHandler: any): void {
    this.inputHandler = inputHandler;
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
          latex += `{\\textstyle \\frac{${num || " "}}{${den || " "}}}`;
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
      } else if (element.type === "integral") {
        // Custom integral format with integrand and differential variable blocks
        const integrandLatex = this.toLatexRecursive(element.integrand!, maxDepth);
        const variableLatex = this.toLatexRecursive(element.differentialVariable!, maxDepth);
        
        // Determine the command based on integral type, style, and whether it has limits
        let integralCommand = '';
        const useRomanD = element.integralStyle === 'roman';
        const isDefinite = element.hasLimits;
        
        switch (element.integralType) {
          case 'double':
            if (isDefinite) {
              integralCommand = useRomanD ? '\\iintdl' : '\\iintil';
            } else {
              integralCommand = useRomanD ? '\\iintd' : '\\iinti';
            }
            break;
          case 'triple':
            if (isDefinite) {
              integralCommand = useRomanD ? '\\iiintdl' : '\\iiintil';
            } else {
              integralCommand = useRomanD ? '\\iiintd' : '\\iiinti';
            }
            break;
          case 'contour':
            if (isDefinite) {
              integralCommand = useRomanD ? '\\ointdl' : '\\ointil';
            } else {
              integralCommand = useRomanD ? '\\ointd' : '\\ointi';
            }
            break;
          case 'single':
          default:
            if (isDefinite) {
              integralCommand = useRomanD ? '\\intdl' : '\\intil';
            } else {
              integralCommand = useRomanD ? '\\intd' : '\\inti';
            }
            break;
        }
        
        // Build the integral LaTeX command
        let finalLatex = '';
        if (isDefinite) {
          // For definite integrals: \intil{integrand}{variable}{lower}{upper}
          const lowerLatex = this.toLatexRecursive(element.lowerLimit!, maxDepth);
          const upperLatex = this.toLatexRecursive(element.upperLimit!, maxDepth);
          finalLatex = `${integralCommand}{${integrandLatex || " "}}{${variableLatex || " "}}{${lowerLatex || " "}}{${upperLatex || " "}}`;
        } else {
          // For indefinite integrals: \inti{integrand}{variable}
          finalLatex = `${integralCommand}{${integrandLatex || " "}}{${variableLatex || " "}}`;
        }
        
        // Wrap with appropriate style like large operators do
        if (element.displayMode === "display") {
          latex += `{\\displaystyle ${finalLatex}}`;
        } else {
          latex += `{\\textstyle ${finalLatex}}`;
        }
      } else if (element.type === "derivative") {
        const functionLatex = this.toLatexRecursive(element.function!, maxDepth);
        const variableLatex = this.toLatexRecursive(element.variable!, maxDepth);
        
        // Check if this is long form derivative
        if (element.isLongForm) {
          // Long form: \dv[n]{x}(\grande{f}) or \dv{x}(\grande{f})
          // The function part is wrapped with \grande and can have optional brackets
          const usePhysicsPackage = this.shouldUsePhysicsPackageForDerivative();
          
          if (usePhysicsPackage) {
            let dvCommand = '';
            if (typeof element.order === 'number') {
              if (element.order === 1) {
                dvCommand = `\\dv{${variableLatex || "x"}}`;
              } else {
                dvCommand = `\\dv[${element.order}]{${variableLatex || "x"}}`;
              }
            } else {
              // nth order with custom expression
              const orderLatex = this.toLatexRecursive(element.order!, maxDepth);
              dvCommand = `\\dv[${orderLatex || "n"}]{${variableLatex || "x"}}`;
            }
            
            // Add the function part with \grande
            // If function starts with brackets, put \grande inside them
            let functionPart = functionLatex || "";
            
            // Check if functionPart starts and ends with any bracket pair
            let bracketFound = false;
            for (const pair of BRACKET_PAIRS) {
              if (functionPart.startsWith(pair.left) && functionPart.endsWith(pair.right)) {
                // Put \grande inside the brackets
                const innerContent = functionPart.slice(pair.left.length, -pair.right.length);
                functionPart = `${pair.left}\\grande{${innerContent}}${pair.right}`;
                bracketFound = true;
                break;
              }
            }
            
            if (!bracketFound) {
              if (functionPart) {
                // No brackets or other format, just add \grande
                functionPart = `\\grande{${functionPart}}`;
              } else {
                // Empty function
                functionPart = `\\grande{ }`;
              }
            }
            
            // Combine the parts
            if (element.displayMode === "display") {
              latex += `{\\displaystyle ${dvCommand}${functionPart}}`;
            } else {
              latex += `${dvCommand}${functionPart}`;
            }
          } else {
            // For non-physics package (italic d), use custom long form commands
            let numerator = '';
            let denominator = '';
            
            if (typeof element.order === 'number') {
              if (element.order === 1) {
                numerator = 'd';
                denominator = `d${variableLatex || "x"}`;
              } else {
                numerator = `d^{${element.order}}`;
                denominator = `d${variableLatex || "x"}^{${element.order}}`;
              }
            } else {
              // nth order with custom expression
              const orderLatex = this.toLatexRecursive(element.order!, maxDepth);
              numerator = `d^{${orderLatex || "n"}}`;
              denominator = `d${variableLatex || "x"}^{${orderLatex || "n"}}`;
            }
            
            // Use custom long form commands for italic d
            if (element.displayMode === "display") {
              latex += `\\derivldfrac{${numerator}}{${denominator}}{${functionLatex || " "}}`;
            } else {
              latex += `\\derivlfrac{${numerator}}{${denominator}}{${functionLatex || " "}}`;
            }
          }
        } else {
          // Standard form derivative handling
          // Check if we should use physics package based on differential style
          const usePhysicsPackage = this.shouldUsePhysicsPackageForDerivative();
          
          if (usePhysicsPackage) {
            // Use physics package \dv command (always renders with roman 'd' based on italicdiff setting)
            let dvCommand = '';
            if (typeof element.order === 'number') {
              if (element.order === 1) {
                dvCommand = `\\dv{${functionLatex || " "}}{${variableLatex || " "}}`;
              } else {
                dvCommand = `\\dv[${element.order}]{${functionLatex || " "}}{${variableLatex || " "}}`;
              }
            } else {
              // nth order with custom expression
              const orderLatex = this.toLatexRecursive(element.order!, maxDepth);
              dvCommand = `\\dv[${orderLatex || "n"}]{${functionLatex || " "}}{${variableLatex || " "}}`;
            }
            
            // Add displaystyle if needed for display mode
            if (element.displayMode === "display") {
              latex += `{\\displaystyle ${dvCommand}}`;
            } else {
              latex += dvCommand;
            }
          } else {
            // Use custom derivative commands for standard LaTeX (allows italic 'd')
            let numerator = '';
            let denominator = '';
            
            if (typeof element.order === 'number') {
              if (element.order === 1) {
                numerator = `d${functionLatex || " "}`;
                denominator = `d${variableLatex || " "}`;
              } else {
                numerator = `d^{${element.order}}${functionLatex || " "}`;
                denominator = `d${variableLatex || " "}^{${element.order}}`;
              }
            } else {
              // nth order with custom expression
              const orderLatex = this.toLatexRecursive(element.order!, maxDepth);
              numerator = `d^{${orderLatex || "n"}}${functionLatex || " "}`;
              denominator = `d${variableLatex || " "}^{${orderLatex || "n"}}`;
            }
            
            // Use custom \derivfrac or \derivdfrac command instead of \frac/\dfrac
            if (element.displayMode === "display") {
              latex += `\\derivdfrac{${numerator}}{${denominator}}`;
            } else {
              latex += `\\derivfrac{${numerator}}{${denominator}}`;
            }
          }
        }
      }
    }
    return latex;
  }

  private shouldUsePhysicsPackageForDerivative(): boolean {
    // Determine whether to use physics package based on current differential style
    // Use physics package for roman style differentials
    if (this.inputHandler && typeof this.inputHandler.getDifferentialStyleForLatex === 'function') {
      return this.inputHandler.getDifferentialStyleForLatex();
    }
    return false; // Default to standard LaTeX if no input handler
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
        } else if (latex.substr(i, 3) === "\\dv") {
          // Handle \displaystyle \dv{f}{x} (unbraced form)
          i += 3; // Skip "\dv"
          
          let order: number | EquationElement[] = 1;
          // Check for optional order parameter [n]
          if (i < latex.length && latex[i] === "[") {
            const orderStart = i + 1;
            let orderEnd = orderStart;
            let bracketCount = 1;
            
            while (orderEnd < latex.length && bracketCount > 0) {
              if (latex[orderEnd] === "[") bracketCount++;
              else if (latex[orderEnd] === "]") bracketCount--;
              orderEnd++;
            }
            
            const orderContent = latex.substring(orderStart, orderEnd - 1);
            const parsedOrder = parseInt(orderContent);
            if (!isNaN(parsedOrder)) {
              order = parsedOrder;
            } else {
              order = this.parseLatexToEquation(orderContent);
            }
            i = orderEnd;
          }
          
          // Parse function {f}
          const functionGroup = this.parseLatexGroup(latex, i);
          i = functionGroup.endIndex;
          
          // Parse variable {x}
          const variableGroup = this.parseLatexGroup(latex, i);
          i = variableGroup.endIndex;
          
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "derivative",
            order: order,
            function: this.parseLatexToEquation(functionGroup.content),
            variable: this.parseLatexToEquation(variableGroup.content),
            displayMode: "display" // This was preceded by \displaystyle
          });
        } else {
          // Check if this is followed by an integral command
          const integralResult = this.parseCustomIntegral(latex, i);
          if (integralResult) {
            integralResult.element.displayMode = "display"; // This was preceded by \displaystyle
            result.push(integralResult.element);
            i = integralResult.endIndex;
          } else {
            // \displaystyle not followed by large operator, \dv, or integral
            // Future: will support other expressions like \frac, \sqrt, etc.
            // Now: treat as text
            result.push({
              id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
              type: "text",
              value: "\\displaystyle"
            });
          }
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
        } else {
          // Check if this is followed by an integral command
          const integralResult = this.parseCustomIntegral(latex, i);
          if (integralResult) {
            integralResult.element.displayMode = "inline"; // This was preceded by \textstyle
            result.push(integralResult.element);
            i = integralResult.endIndex;
          }
          // If not followed by large operator or integral, just continue (skip the \textstyle)
        }
      } else if (latex.substr(i, 11) === "\\derivdfrac") {
        // Parse custom derivative display fraction command
        i += 11;
        const numerator = this.parseLatexGroup(latex, i);
        i = numerator.endIndex;
        const denominator = this.parseLatexGroup(latex, i);
        i = denominator.endIndex;

        // Parse as derivative element
        const derivativeInfo = this.parseDerivativeFraction(numerator.content, denominator.content, "display");
        if (derivativeInfo) {
          result.push(derivativeInfo);
        } else {
          // Fallback to regular fraction if parsing fails
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "fraction",
            displayMode: "display",
            numerator: this.parseLatexToEquation(numerator.content),
            denominator: this.parseLatexToEquation(denominator.content)
          });
        }
      } else if (latex.substr(i, 10) === "\\derivfrac") {
        // Parse custom derivative inline fraction command
        i += 10;
        const numerator = this.parseLatexGroup(latex, i);
        i = numerator.endIndex;
        const denominator = this.parseLatexGroup(latex, i);
        i = denominator.endIndex;

        // Parse as derivative element
        const derivativeInfo = this.parseDerivativeFraction(numerator.content, denominator.content, "inline");
        if (derivativeInfo) {
          result.push(derivativeInfo);
        } else {
          // Fallback to regular fraction if parsing fails
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "fraction",
            displayMode: "inline",
            numerator: this.parseLatexToEquation(numerator.content),
            denominator: this.parseLatexToEquation(denominator.content)
          });
        }
      } else if (latex.substr(i, 11) === "\\derivlfrac") {
        // Parse custom long form derivative inline command
        i += 11;
        const numerator = this.parseLatexGroup(latex, i);
        i = numerator.endIndex;
        const denominator = this.parseLatexGroup(latex, i);
        i = denominator.endIndex;
        const functionPart = this.parseLatexGroup(latex, i);
        i = functionPart.endIndex;

        // Parse as long form derivative element
        const derivativeInfo = this.parseLongFormDerivative(numerator.content, denominator.content, functionPart.content, "inline");
        if (derivativeInfo) {
          result.push(derivativeInfo);
        } else {
          // Fallback to regular fraction if parsing fails
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "fraction",
            displayMode: "inline",
            numerator: this.parseLatexToEquation(numerator.content),
            denominator: this.parseLatexToEquation(denominator.content)
          });
        }
      } else if (latex.substr(i, 12) === "\\derivldfrac") {
        // Parse custom long form derivative display command
        i += 12;
        const numerator = this.parseLatexGroup(latex, i);
        i = numerator.endIndex;
        const denominator = this.parseLatexGroup(latex, i);
        i = denominator.endIndex;
        const functionPart = this.parseLatexGroup(latex, i);
        i = functionPart.endIndex;

        // Parse as long form derivative element
        const derivativeInfo = this.parseLongFormDerivative(numerator.content, denominator.content, functionPart.content, "display");
        if (derivativeInfo) {
          result.push(derivativeInfo);
        } else {
          // Fallback to regular fraction if parsing fails
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "fraction",
            displayMode: "display",
            numerator: this.parseLatexToEquation(numerator.content),
            denominator: this.parseLatexToEquation(denominator.content)
          });
        }
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
      } else if (latex.substr(i, 14) === "{\\displaystyle ") {
        // Look ahead to see if this contains a \dv command or integral command
        const displaystyleStart = i;
        let braceCount = 1;
        let pos = i + 14; // Skip "{\displaystyle "
        let containsDv = false;
        let containsIntegral = false;
        let dvPos = -1;
        let integralPos = -1;
        
        // Find the matching closing brace and check for \dv or integral commands
        while (pos < latex.length && braceCount > 0) {
          if (latex[pos] === '{') {
            braceCount++;
          } else if (latex[pos] === '}') {
            braceCount--;
          } else if (latex.substr(pos, 3) === "\\dv" && dvPos === -1) {
            containsDv = true;
            dvPos = pos;
          } else if (!containsIntegral && pos < latex.length - 4) {
            // Check for various integral commands
            for (const cmd of INTEGRAL_COMMANDS) {
              if (latex.substr(pos, cmd.length) === cmd) {
                containsIntegral = true;
                integralPos = pos;
                break;
              }
            }
          }
          pos++;
        }
        
        if (containsDv) {
          // Handle displaystyle derivative: {\displaystyle \dv{f}{x}}
          i += 14; // Skip "{\displaystyle "
          // Skip any whitespace
          while (i < latex.length && latex[i] === " ") i++;
          
          if (latex.substr(i, 3) === "\\dv") {
          i += 3; // Skip "\dv"
          
          let order: number | EquationElement[] = 1;
          // Check for optional order parameter [n]
          if (i < latex.length && latex[i] === "[") {
            const orderStart = i + 1;
            let orderEnd = orderStart;
            let bracketCount = 1;
            
            while (orderEnd < latex.length && bracketCount > 0) {
              if (latex[orderEnd] === "[") bracketCount++;
              else if (latex[orderEnd] === "]") bracketCount--;
              orderEnd++;
            }
            
            const orderContent = latex.substring(orderStart, orderEnd - 1);
            const parsedOrder = parseInt(orderContent);
            if (!isNaN(parsedOrder)) {
              order = parsedOrder;
            } else {
              order = this.parseLatexToEquation(orderContent);
            }
            i = orderEnd;
          }
          
          // Parse function {f}
          const functionGroup = this.parseLatexGroup(latex, i);
          i = functionGroup.endIndex;
          
          // Parse variable {x}
          const variableGroup = this.parseLatexGroup(latex, i);
          i = variableGroup.endIndex;
          
          // Skip the closing brace of displaystyle
          if (i < latex.length && latex[i] === "}") i++;
          
          result.push({
            id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
            type: "derivative",
            order: order,
            function: this.parseLatexToEquation(functionGroup.content),
            variable: this.parseLatexToEquation(variableGroup.content),
            displayMode: "display" // This was in displaystyle
          });
          } else {
            // Not a recognized \dv command after {\displaystyle, 
            // skip the entire displaystyle group to avoid parsing issues
            i = displaystyleStart;
            const group = this.parseLatexGroup(latex, i);
            i = group.endIndex;
            
            // Parse the content inside the group normally (without displaystyle wrapper)
            const innerContent = group.content;
            if (innerContent.startsWith("\\displaystyle ")) {
              // Remove the \displaystyle prefix and parse the rest
              const contentAfterDisplaystyle = innerContent.substring(13);
              result.push(...this.parseLatexToEquation(contentAfterDisplaystyle));
            } else {
              result.push(...this.parseLatexToEquation(innerContent));
            }
          }
        } else if (containsIntegral) {
          // Handle displaystyle integral: {\displaystyle \inti{f(x)}{x}}
          i += 14; // Skip "{\displaystyle "
          // Skip any whitespace
          while (i < latex.length && latex[i] === " ") i++;
          
          // Parse the integral command
          const integralResult = this.parseCustomIntegral(latex, i);
          if (integralResult) {
            integralResult.element.displayMode = "display"; // This was in displaystyle
            result.push(integralResult.element);
            i = integralResult.endIndex;
            
            // Skip the closing brace of displaystyle
            if (i < latex.length && latex[i] === "}") i++;
          } else {
            // Failed to parse integral, fallback to normal handling
            i = displaystyleStart;
            const group = this.parseLatexGroup(latex, i);
            i = group.endIndex;
            
            // Parse the content inside the group normally (without displaystyle wrapper)
            const innerContent = group.content;
            if (innerContent.startsWith("\\displaystyle ")) {
              // Remove the \displaystyle prefix and parse the rest
              const contentAfterDisplaystyle = innerContent.substring(13);
              result.push(...this.parseLatexToEquation(contentAfterDisplaystyle));
            } else {
              result.push(...this.parseLatexToEquation(innerContent));
            }
          }
        } else {
          // Check if this contains a large operator
          i += 14; // Skip "{\displaystyle "
          // Skip any whitespace
          while (i < latex.length && latex[i] === " ") i++;
          
          if (this.isLargeOperator(latex, i)) {
            const operatorInfo = this.parseLargeOperator(latex, i, true); // true = display mode
            if (operatorInfo) {
              result.push(operatorInfo.element);
              i = operatorInfo.endIndex;
              
              // Skip the closing brace of displaystyle
              if (i < latex.length && latex[i] === "}") i++;
            } else {
              // Failed to parse, fallback
              i = displaystyleStart;
              i++;
            }
          } else {
            // Not a displaystyle derivative, integral, or large operator, let other handlers process it
            i = displaystyleStart;
            i++;
          }
        }
      } else if (latex.substr(i, 12) === "{\\textstyle ") {
        // Handle textstyle groups similar to displaystyle
        const textstyleStart = i;
        let braceCount = 1;
        let pos = i + 12; // Skip "{\textstyle "
        let containsIntegral = false;
        
        // Find the matching closing brace and check for integral commands
        while (pos < latex.length && braceCount > 0) {
          if (latex[pos] === '{') {
            braceCount++;
          } else if (latex[pos] === '}') {
            braceCount--;
          } else if (!containsIntegral && pos < latex.length - 4) {
            // Check for various integral commands
            for (const cmd of INTEGRAL_COMMANDS) {
              if (latex.substr(pos, cmd.length) === cmd) {
                containsIntegral = true;
                break;
              }
            }
          }
          pos++;
        }
        
        if (containsIntegral) {
          // Handle textstyle integral: {\textstyle \inti{f(x)}{x}}
          i += 12; // Skip "{\textstyle "
          // Skip any whitespace
          while (i < latex.length && latex[i] === " ") i++;
          
          // Parse the integral command
          const integralResult = this.parseCustomIntegral(latex, i);
          if (integralResult) {
            integralResult.element.displayMode = "inline"; // This was in textstyle
            result.push(integralResult.element);
            i = integralResult.endIndex;
            
            // Skip the closing brace of textstyle
            if (i < latex.length && latex[i] === "}") i++;
          } else {
            // Failed to parse integral, fallback to normal handling
            i = textstyleStart;
            const group = this.parseLatexGroup(latex, i);
            i = group.endIndex;
            
            // Parse the content inside the group normally (without textstyle wrapper)
            result.push(...this.parseLatexToEquation(group.content));
          }
        } else {
          // Check if this contains a large operator
          i += 12; // Skip "{\textstyle "
          // Skip any whitespace
          while (i < latex.length && latex[i] === " ") i++;
          
          if (this.isLargeOperator(latex, i)) {
            const operatorInfo = this.parseLargeOperator(latex, i, false); // false = inline mode
            if (operatorInfo) {
              result.push(operatorInfo.element);
              i = operatorInfo.endIndex;
              
              // Skip the closing brace of textstyle
              if (i < latex.length && latex[i] === "}") i++;
            } else {
              // Failed to parse, fallback
              i = textstyleStart;
              i++;
            }
          } else if (latex.substr(i, 5) === "\\frac") {
            // Handle textstyle fraction: {\textstyle \frac{...}{...}}
            const fractionInfo = this.parseFraction(latex, i, false); // false = inline mode
            if (fractionInfo) {
              result.push(fractionInfo.element);
              i = fractionInfo.endIndex;
              
              // Skip the closing brace of textstyle
              if (i < latex.length && latex[i] === "}") i++;
            } else {
              // Failed to parse, fallback
              i = textstyleStart;
              i++;
            }
          } else {
            // Not a textstyle integral, large operator, or fraction
            // Parse the entire textstyle group content
            i = textstyleStart;
            const group = this.parseLatexGroup(latex, i);
            i = group.endIndex;
            
            // Remove the \textstyle prefix from the content and parse the rest
            let content = group.content;
            if (content.startsWith("\\textstyle ")) {
              content = content.substring(11); // Remove "\textstyle "
            }
            result.push(...this.parseLatexToEquation(content));
          }
        }
      } else if (latex.substr(i, 3) === "\\dv") {
        // Parse physics package derivative command
        i += 3;
        
        let order: number | EquationElement[] = 1;
        // Check for optional order parameter [n]
        if (i < latex.length && latex[i] === "[") {
          const orderStart = i + 1;
          let orderEnd = orderStart;
          let bracketCount = 1;
          
          while (orderEnd < latex.length && bracketCount > 0) {
            if (latex[orderEnd] === "[") bracketCount++;
            else if (latex[orderEnd] === "]") bracketCount--;
            orderEnd++;
          }
          
          const orderContent = latex.substring(orderStart, orderEnd - 1);
          // Try to parse as number, otherwise treat as nth order
          const parsedOrder = parseInt(orderContent);
          if (!isNaN(parsedOrder)) {
            order = parsedOrder;
          } else {
            // nth order derivative
            order = this.parseLatexToEquation(orderContent);
          }
          i = orderEnd;
        }
        
        // Parse function {f}
        const functionGroup = this.parseLatexGroup(latex, i);
        i = functionGroup.endIndex;
        
        // Parse variable {x}
        const variableGroup = this.parseLatexGroup(latex, i);
        i = variableGroup.endIndex;
        
        result.push({
          id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
          type: "derivative",
          order: order,
          function: this.parseLatexToEquation(functionGroup.content),
          variable: this.parseLatexToEquation(variableGroup.content),
          displayMode: "inline" // \dv defaults to inline
        });
      } else if (this.isCustomIntegralCommand(latex, i)) {
        // Parse custom integral commands like \inti, \intd, \iinti, etc.
        const integralInfo = this.parseCustomIntegral(latex, i);
        if (integralInfo) {
          result.push(integralInfo.element);
          i = integralInfo.endIndex;
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
          // Unknown command - skip it
          i++;
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
    // Use the UNICODE_TO_LATEX mapping for all symbol conversions
    const latexCommand = UNICODE_TO_LATEX[operator];
    if (latexCommand) {
      return latexCommand;
    }
    
    // If no mapping found, return the original operator
    return operator;
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
    // Use the centralized LARGE_OPERATORS list
    return LARGE_OPERATORS.some(op => {
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
    // Use LATEX_TO_UNICODE for the mapping
    
    // Find which operator matches
    let operatorCommand = "";
    let operatorSymbol = "";
    
    for (const command of LARGE_OPERATORS) {
      if (latex.substr(index, command.length) === command) {
        operatorCommand = command;
        operatorSymbol = LATEX_TO_UNICODE[command] || "";
        break;
      }
    }
    
    if (!operatorCommand) {
      return null;
    }
    
    let pos = index + operatorCommand.length;
    let limitMode: "default" | "nolimits" | "limits" = "limits"; // default
    let displayMode: "inline" | "display" = forceDisplayMode ? "display" : "inline"; // Use forced display mode if provided
    
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

  private isCustomIntegralCommand(latex: string, index: number): boolean {
    for (const cmd of INTEGRAL_COMMANDS) {
      if (latex.substr(index, cmd.length) === cmd) {
        // Make sure it's not part of a longer command
        const nextChar = latex[index + cmd.length];
        if (!nextChar || nextChar === '{' || nextChar === '[' || nextChar === ' ' || nextChar === '\\') {
          return true;
        }
      }
    }
    return false;
  }

  private parseFraction(latex: string, index: number, forceInlineMode?: boolean): { element: EquationElement; endIndex: number } | null {
    // Check if this is a \frac or \dfrac command
    let isDisplayFrac = false;
    let i = index;
    
    if (latex.substr(i, 6) === "\\dfrac") {
      isDisplayFrac = true;
      i += 6;
    } else if (latex.substr(i, 5) === "\\frac") {
      i += 5;
    } else {
      return null;
    }
    
    // Parse numerator {num}
    if (i >= latex.length || latex[i] !== '{') return null;
    const numerator = this.parseLatexGroup(latex, i);
    i = numerator.endIndex;
    
    // Parse denominator {den}
    if (i >= latex.length || latex[i] !== '{') return null;
    const denominator = this.parseLatexGroup(latex, i);
    i = denominator.endIndex;
    
    const element: EquationElement = {
      id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
      type: "fraction",
      numerator: this.parseLatexToEquation(numerator.content),
      denominator: this.parseLatexToEquation(denominator.content),
      displayMode: forceInlineMode ? "inline" : (isDisplayFrac ? "display" : undefined)
    };
    
    return { element, endIndex: i };
  }

  private parseCustomIntegral(latex: string, startIndex: number): { element: EquationElement, endIndex: number } | null {
    let i = startIndex;
    
    // Determine which command we're parsing
    let integralType: "single" | "double" | "triple" | "contour" = "single";
    let integralStyle: "italic" | "roman" = "italic";
    let commandLength = 0;
    let isDefinite = false;
    
    // Check for definite integral commands first (longer commands)
    if (latex.substr(i, 8) === '\\iiintdl') {
      integralType = "triple";
      integralStyle = "roman";
      commandLength = 8;
      isDefinite = true;
    } else if (latex.substr(i, 8) === '\\iiintil') {
      integralType = "triple";
      integralStyle = "italic";
      commandLength = 8;
      isDefinite = true;
    } else if (latex.substr(i, 7) === '\\iintdl') {
      integralType = "double";
      integralStyle = "roman";
      commandLength = 7;
      isDefinite = true;
    } else if (latex.substr(i, 7) === '\\iintil') {
      integralType = "double";
      integralStyle = "italic";
      commandLength = 7;
      isDefinite = true;
    } else if (latex.substr(i, 7) === '\\ointdl') {
      integralType = "contour";
      integralStyle = "roman";
      commandLength = 7;
      isDefinite = true;
    } else if (latex.substr(i, 7) === '\\ointil') {
      integralType = "contour";
      integralStyle = "italic";
      commandLength = 7;
      isDefinite = true;
    } else if (latex.substr(i, 6) === '\\intdl') {
      integralType = "single";
      integralStyle = "roman";
      commandLength = 6;
      isDefinite = true;
    } else if (latex.substr(i, 6) === '\\intil') {
      integralType = "single";
      integralStyle = "italic";
      commandLength = 6;
      isDefinite = true;
    }
    // Check for indefinite integral commands (shorter commands)
    else if (latex.substr(i, 7) === '\\iiintd') {
      integralType = "triple";
      integralStyle = "roman";
      commandLength = 7;
    } else if (latex.substr(i, 7) === '\\iiinti') {
      integralType = "triple";
      integralStyle = "italic";
      commandLength = 7;
    } else if (latex.substr(i, 6) === '\\iintd') {
      integralType = "double";
      integralStyle = "roman";
      commandLength = 6;
    } else if (latex.substr(i, 6) === '\\iinti') {
      integralType = "double";
      integralStyle = "italic";
      commandLength = 6;
    } else if (latex.substr(i, 6) === '\\ointd') {
      integralType = "contour";
      integralStyle = "roman";
      commandLength = 6;
    } else if (latex.substr(i, 6) === '\\ointi') {
      integralType = "contour";
      integralStyle = "italic";
      commandLength = 6;
    } else if (latex.substr(i, 5) === '\\intd') {
      integralType = "single";
      integralStyle = "roman";
      commandLength = 5;
    } else if (latex.substr(i, 5) === '\\inti') {
      integralType = "single";
      integralStyle = "italic";
      commandLength = 5;
    } else {
      return null;
    }
    
    i += commandLength;
    
    // Skip whitespace
    while (i < latex.length && latex[i] === ' ') i++;
    
    let integrand: EquationElement[] = [];
    let differentialVariable: EquationElement[] = [];
    let lowerLimit: EquationElement[] = [];
    let upperLimit: EquationElement[] = [];
    
    if (isDefinite) {
      // For definite integrals: \intil{integrand}{variable}{lower}{upper}
      // Parse integrand {f(x)}
      if (i >= latex.length || latex[i] !== '{') return null;
      const integrandGroup = this.parseLatexGroup(latex, i);
      integrand = this.parseLatexToEquation(integrandGroup.content);
      i = integrandGroup.endIndex;
      
      // Skip whitespace
      while (i < latex.length && latex[i] === ' ') i++;
      
      // Parse differential variable {x}
      if (i >= latex.length || latex[i] !== '{') return null;
      const variableGroup = this.parseLatexGroup(latex, i);
      differentialVariable = this.parseLatexToEquation(variableGroup.content);
      i = variableGroup.endIndex;
      
      // Skip whitespace
      while (i < latex.length && latex[i] === ' ') i++;
      
      // Parse lower limit {a}
      if (i >= latex.length || latex[i] !== '{') return null;
      const lowerGroup = this.parseLatexGroup(latex, i);
      lowerLimit = this.parseLatexToEquation(lowerGroup.content);
      i = lowerGroup.endIndex;
      
      // Skip whitespace
      while (i < latex.length && latex[i] === ' ') i++;
      
      // Parse upper limit {b}
      if (i >= latex.length || latex[i] !== '{') return null;
      const upperGroup = this.parseLatexGroup(latex, i);
      upperLimit = this.parseLatexToEquation(upperGroup.content);
      i = upperGroup.endIndex;
    } else {
      // For indefinite integrals: \inti{integrand}{variable}
      // Parse integrand {f(x)}
      if (i >= latex.length || latex[i] !== '{') return null;
      const integrandGroup = this.parseLatexGroup(latex, i);
      integrand = this.parseLatexToEquation(integrandGroup.content);
      i = integrandGroup.endIndex;
      
      // Skip whitespace
      while (i < latex.length && latex[i] === ' ') i++;
      
      // Parse differential variable {x}
      if (i >= latex.length || latex[i] !== '{') return null;
      const variableGroup = this.parseLatexGroup(latex, i);
      differentialVariable = this.parseLatexToEquation(variableGroup.content);
      i = variableGroup.endIndex;
    }
    
    const element: EquationElement = {
      id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
      type: "integral",
      integralType: integralType,
      integralStyle: integralStyle,
      hasLimits: isDefinite,
      integrand: integrand,
      differentialVariable: differentialVariable,
      displayMode: "inline" // Default to inline
    };
    
    if (isDefinite) {
      element.lowerLimit = lowerLimit;
      element.upperLimit = upperLimit;
    }
    
    return {
      element: element,
      endIndex: i
    };
  }

  private parseDerivativeFraction(numeratorLatex: string, denominatorLatex: string, displayMode: "inline" | "display"): EquationElement | null {
    // Try to parse numerator and denominator to detect derivative pattern
    // Pattern: numerator = d^n f, denominator = d x^n or dx^n
    
    // Improved pattern matching with better handling of function expressions
    const numMatch = numeratorLatex.match(/^d(\^{(.+)})?(.*)$/);
    const denMatch = denominatorLatex.match(/^d\s*(.+?)(\^{(.+)})?$/);
    
    if (numMatch && denMatch) {
      const orderFromNum = numMatch[2]; // From d^{n}
      const orderFromDen = denMatch[3]; // From x^{n}
      let functionPart = numMatch[3] || '';
      const variablePart = denMatch[1] || '';
      
      // Clean up the function part - handle cases like "{ e }^{2x}"
      functionPart = functionPart.trim();
      
      // If we have something like "{ e }^{2x}", we need to clean up the unnecessary braces around 'e'
      // But preserve the script part "^{2x}"
      if (functionPart.match(/^{\s*\w+\s*}(.*)$/)) {
        // Extract the content from { content }rest -> content + rest  
        const match = functionPart.match(/^{\s*(\w+)\s*}(.*)$/);
        if (match) {
          functionPart = match[1] + match[2]; // e.g., "{ e }^{2x}" -> "e^{2x}"
        }
      }
      
      // Determine order (prefer from numerator, fallback to denominator, default to 1)
      let order: number | EquationElement[] = 1;
      if (orderFromNum) {
        const parsedOrder = parseInt(orderFromNum);
        if (!isNaN(parsedOrder)) {
          order = parsedOrder;
        } else {
          order = this.parseLatexToEquation(orderFromNum);
        }
      } else if (orderFromDen) {
        const parsedOrder = parseInt(orderFromDen);
        if (!isNaN(parsedOrder)) {
          order = parsedOrder;
        } else {
          order = this.parseLatexToEquation(orderFromDen);
        }
      }
      
      return {
        id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
        type: "derivative",
        order: order,
        displayMode: displayMode,
        function: this.parseLatexToEquation(functionPart),
        variable: this.parseLatexToEquation(variablePart.replace(/\^{.+}$/, '')) // Remove any trailing exponent
      };
    }
    
    return null; // Not a recognizable derivative pattern
  }

  private parseLongFormDerivative(numeratorLatex: string, denominatorLatex: string, functionLatex: string, displayMode: "inline" | "display"): EquationElement | null {
    // Parse long form derivative: \derivlfrac{d^n}{dx^n}{f} or \derivldfrac{d^n}{dx^n}{f}
    // Pattern: numerator = d^n, denominator = dx^n, separate function part
    
    const numMatch = numeratorLatex.match(/^d(\^{(.+)})?$/);
    const denMatch = denominatorLatex.match(/^d(.+?)(\^{(.+)})?$/);
    
    if (numMatch && denMatch) {
      const orderFromNum = numMatch[2]; // From d^{n}
      const orderFromDen = denMatch[3]; // From x^{n}
      const variablePart = denMatch[1] || '';
      
      // Determine order (prefer from numerator, fallback to denominator, default to 1)
      let order: number | EquationElement[] = 1;
      if (orderFromNum) {
        const parsedOrder = parseInt(orderFromNum);
        if (!isNaN(parsedOrder)) {
          order = parsedOrder;
        } else {
          order = this.parseLatexToEquation(orderFromNum);
        }
      } else if (orderFromDen) {
        const parsedOrder = parseInt(orderFromDen);
        if (!isNaN(parsedOrder)) {
          order = parsedOrder;
        } else {
          order = this.parseLatexToEquation(orderFromDen);
        }
      }
      
      return {
        id: this.equationBuilder?.generateElementId() || `element-${Math.random()}`,
        type: "derivative",
        order: order,
        displayMode: displayMode,
        function: this.parseLatexToEquation(functionLatex),
        variable: this.parseLatexToEquation(variablePart.replace(/\^{.+}$/, '')), // Remove any trailing exponent
        isLongForm: true
      };
    }
    
    return null; // Not a recognizable long form derivative pattern
  }

}