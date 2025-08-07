export class FontMeasurementService {
  private scaleRatios: Map<string, Map<string, number>> = new Map();
  private currentFontKey: string = '';
  
  // Operators to measure
  private readonly operators = [
    { symbol: '∑', name: 'sum' },
    { symbol: '∏', name: 'prod' },
    { symbol: '∫', name: 'int' }, 
    // etc (will be expanded in the future)
  ];

  constructor() {}

  // Measures and calculates the scale ratios for supported large operators
  measureAndSetScaleRatios(): Promise<Map<string, number>> {
    return new Promise((resolve) => {
      const fontKey = this.getCurrentFontKey();
      
      // Check cache first
      if (this.scaleRatios.has(fontKey)) {
        const cachedRatios = this.scaleRatios.get(fontKey)!;
        this.applyScaleRatios(cachedRatios);
        resolve(cachedRatios);
        return;
      }

      // Measure all operators
      const ratios = new Map<string, number>();
      let measurementIndex = 0;
      
      const measureNext = () => {
        if (measurementIndex >= this.operators.length) {
          // All measurements complete
          this.scaleRatios.set(fontKey, ratios);
          this.applyScaleRatios(ratios);
          console.log('Font measurement completed:', Object.fromEntries(ratios));
          resolve(ratios);
          return;
        }
        
        const operator = this.operators[measurementIndex];
        const { nolimitsElement, displaylimitsElement, container } = this.createMeasurementElements(operator.symbol);
        
        // Wait for rendering
        requestAnimationFrame(() => {
          try {
            // Measure the sizes
            const nolimitsSize = this.getOperatorSize(nolimitsElement);
            const displaylimitsSize = this.getOperatorSize(displaylimitsElement);
            
            // Calculate ratio
            const ratio = nolimitsSize.height / displaylimitsSize.height;
            
            console.log(`Font measurement - ${operator.name} (${operator.symbol}):`, {
              font: fontKey,
              nolimitsSize: nolimitsSize.height + 'px',
              displaylimitsSize: displaylimitsSize.height + 'px',
              ratio: ratio.toFixed(3)
            });
            
            // Store ratio
            ratios.set(operator.name, ratio);
            
            // Cleanup
            container.remove();
            
            // Measure next operator
            measurementIndex++;
            measureNext();
            
          } catch (error) {
            console.error(`Error measuring ${operator.name}:`, error);
            // Use fallback ratio
            ratios.set(operator.name, 0.6);
            container.remove();
            measurementIndex++;
            measureNext();
          }
        });
      };
      
      // Start measuring
      measureNext();
    });
  }

  private createMeasurementElements(operatorSymbol: string) {
    // Create invisible container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.visibility = 'hidden';
    container.style.pointerEvents = 'none';
    
    // Create nolimits element (target size)
    const nolimitsWrapper = document.createElement('div');
    nolimitsWrapper.className = 'visual-equation-container';
    nolimitsWrapper.innerHTML = `
      <math>
        <mrow>
          <msubsup>
            <mo class="test-nolimits-operator">${operatorSymbol}</mo>
            <mrow><mi>□</mi></mrow>
            <mrow><mi>□</mi></mrow>
          </msubsup>
        </mrow>
      </math>
    `;
    
    // Create displaystyle limits element (current size)  
    const displaylimitsWrapper = document.createElement('div');
    displaylimitsWrapper.className = 'visual-equation-container';
    displaylimitsWrapper.innerHTML = `
      <math>
        <mrow displaystyle="true">
          <munderover>
            <mo class="test-displaystyle-operator">${operatorSymbol}</mo>
            <mrow><mi>□</mi></mrow>
            <mrow><mi>□</mi></mrow>
          </munderover>
        </mrow>
      </math>
    `;
    
    container.appendChild(nolimitsWrapper);
    container.appendChild(displaylimitsWrapper);
    document.body.appendChild(container);
    
    return {
      nolimitsElement: nolimitsWrapper,
      displaylimitsElement: displaylimitsWrapper,
      container
    };
  }

  private getOperatorSize(container: HTMLElement): { width: number; height: number } {
    const operator = container.querySelector('mo');
    if (!operator) {
      throw new Error('Operator element not found');
    }
    
    const rect = operator.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height
    };
  }

  private getCurrentFontKey(): string {
    // Create a key based on current font settings
    const computedStyle = window.getComputedStyle(document.body);
    const fontFamily = computedStyle.getPropertyValue('font-family');
    const fontSize = computedStyle.getPropertyValue('font-size');
    
    return `${fontFamily}-${fontSize}`;
  }

  private applyScaleRatios(ratios: Map<string, number>): void {
    // Create or update CSS custom properties for each operator
    ratios.forEach((ratio, operatorName) => {
      document.documentElement.style.setProperty(`--inline-limits-scale-${operatorName}`, ratio.toString());
    });
    
    // Ensure CSS rules exist
    this.ensureScaleCSSRules();
  }

  private ensureScaleCSSRules(): void {
    const styleId = 'inline-limits-dynamic-scale';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = `
        /* Dynamic scaling for inline-limits operators */
        .equation-display mrow[displaystyle="true"] .inline-limits[data-operator="sum"] > mo,
        .visual-equation-container mrow[displaystyle="true"] .inline-limits[data-operator="sum"] > mo {
          transform: scale(var(--inline-limits-scale-sum, 0.6)) !important;
        }
        
        /* For future use, example */
        /* .equation-display mrow[displaystyle="true"] .inline-limits[data-operator="prod"] > mo,
        .visual-equation-container mrow[displaystyle="true"] .inline-limits[data-operator="prod"] > mo {
          transform: scale(var(--inline-limits-scale-product, 0.6)) !important;
        } */
      `;
      document.head.appendChild(styleElement);
    }
  }

  // Call this when font settings change
  invalidateCache(): void {
    this.scaleRatios.clear();
  }
}