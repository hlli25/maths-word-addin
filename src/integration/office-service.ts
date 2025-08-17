import { EquationBuilder } from "../core/equation-builder";
import { LatexConverter } from "../core/latex-converter";

export class OfficeService {
  private equationBuilder: EquationBuilder;
  private latexConverter: LatexConverter;
  private onEquationLoadedCallback?: (latex: string) => Promise<void>;

  constructor(equationBuilder: EquationBuilder, latexConverter: LatexConverter) {
    this.equationBuilder = equationBuilder;
    this.latexConverter = latexConverter;
  }

  setEquationLoadedCallback(callback: (latex: string) => Promise<void>): void {
    this.onEquationLoadedCallback = callback;
  }

  async insertEquationToWord(
    svgString: string,
    width: number,
    height: number,
    baselineOffsetPt: number,
    latex: string
  ): Promise<void> {
    try {
      // Log SVG size information
      const svgSizeBytes = new Blob([svgString]).size;
      const svgSizeKB = svgSizeBytes / 1024;
      console.log(`SVG Image dimensions: ${width}x${height}px`);
      console.log(`SVG String size: ${svgSizeBytes} bytes (${svgSizeKB.toFixed(2)} KB)`);
      
      // Convert SVG string to base64
      let base64Svg: string;
      try {
        base64Svg = btoa(
          encodeURIComponent(svgString).replace(/%([0-9A-F]{2})/g, (match, p1) =>
            String.fromCharCode(parseInt(p1, 16))
          )
        );
        const base64SizeKB = base64Svg.length / 1024;
        console.log(`Base64 SVG length: ${base64Svg.length} chars (${base64SizeKB.toFixed(2)} KB)`);
      } catch (base64Error) {
        console.error("Base64 conversion failed:", base64Error);
        throw new Error("Failed to convert SVG to base64");
      }

      await Word.run(async (context) => {
        console.log("Inside Word.run context");
        const selection = context.document.getSelection();
        console.log("Got document selection");

        // Add unique prefix to LaTeX for reliable equation detection
        const prefixedLatex = `hlleqed ${latex}`;

        // Check OOXML size first to determine optimal insertion method
        const ooxml = this.createInlineImageWithPositionOoxml(base64Svg, width, height, baselineOffsetPt, prefixedLatex);
        const ooxmlSizeKB = ooxml.length / 1024;
        console.log(`OOXML size: ${ooxmlSizeKB.toFixed(1)}KB`);

        // Check for matrix/complex content that may fail with OOXML
        const hasMatrixContent = latex.includes('matrix') || latex.includes('pmatrix') || latex.includes('bmatrix') ||
                                latex.includes('cases') || latex.includes('array');
        
        if (!hasMatrixContent) {
          // Phase 1: Use OOXML for simple equations (non-matrix content)
          console.log(`Attempting OOXML for simple equation (${ooxmlSizeKB.toFixed(1)}KB)...`);

          try {
            selection.insertOoxml(ooxml, Word.InsertLocation.replace);
            await context.sync();
            console.log("OOXML insertion successful");
            return; // Early return on success
          } catch (ooxmlError) {
            console.log("OOXML insertion failed, falling back to PNG:", ooxmlError);
          }
        } else {
          console.log(`Matrix/Array content detected - OOXML insertion not supported by Word (SVG: ${svgSizeKB.toFixed(1)}KB, Base64: ${(base64Svg.length/1024).toFixed(1)}KB)`);
          console.log("Using PNG approach instead...");
        }

        // Phase 2: PNG approach for matrices or OOXML failures
        console.log("Attempting PNG conversion and insertion...");

        try {
          console.log("Converting SVG to PNG...");

          const pngBase64 = await this.convertSvgToPng(svgString, width, height);
          const pngSizeKB = (pngBase64.length * 3) / 4 / 1024; // Base64 overhead ~33%
          console.log(`PNG conversion successful, size: ${pngSizeKB.toFixed(1)}KB`);

          if (pngSizeKB < 50) { // Try PNG insertion if under 50KB
            console.log("Attempting PNG insertion via insertInlinePictureFromBase64...");

            // Try different data URL formats
            const formats = [
              `data:image/png;base64,${pngBase64}`,
              pngBase64, // Try without data: prefix
            ];

            let insertionSucceeded = false;

            for (let i = 0; i < formats.length && !insertionSucceeded; i++) {
              try {
                console.log(`Trying PNG format ${i + 1}:`, formats[i].substring(0, 50) + "...");
                
                const inlinePicture = selection.insertInlinePictureFromBase64(formats[i], Word.InsertLocation.replace);
                
                // Set size using point-based dimensions (convert from pixels)
                const widthPt = width * (72 / 96); // Convert pixels to points
                const heightPt = height * (72 / 96);
                inlinePicture.width = widthPt;
                inlinePicture.height = heightPt;

                await context.sync();

                // Apply baseline positioning using preview API
                if (baselineOffsetPt !== 0) {
                  const range = inlinePicture.getRange();
                  range.font.position = baselineOffsetPt;
                  console.log(`Applied baseline offset: ${baselineOffsetPt}pt`);
                }

                // Set alt text after successful insertion
                inlinePicture.altTextDescription = prefixedLatex;
                await context.sync();

                console.log("PNG insertion with alt text and baseline positioning successful");
                insertionSucceeded = true;
              } catch (formatError) {
                console.log(`PNG format ${i + 1} failed:`, formatError);
              }
            }

            if (!insertionSucceeded) {
              throw new Error("All PNG formats failed");
            }
          } else {
            throw new Error("PNG too large, falling back to text");
          }
        } catch (pngError) {
          console.log("PNG conversion/insertion failed:", pngError);

          // Final fallback: text only
          console.log("All image insertion methods failed, using text fallback");
          selection.insertText(`[EQUATION: ${latex}]`, Word.InsertLocation.replace);
          await context.sync();
          console.log("Text fallback successful");
        }
      });
    } catch (error) {
      console.error("Word.run failed:", error);
      console.error("LaTeX that caused the error:", latex);
      throw error; // Re-throw to maintain the original error flow
    }
  }

  setupEquationImageHandler(): void {
    Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, () =>
      this.handleSelectionChange()
    );
  }

  private async handleSelectionChange(): Promise<void> {
    try {
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.load("inlinePictures");
        await context.sync();

        if (selection.inlinePictures.items.length > 0) {
          const picture = selection.inlinePictures.items[0];
          picture.load("altTextDescription");
          await context.sync();

          const altText = picture.altTextDescription;

          if (altText && altText.trim()) {
            // Check if this is an equation created by our editor (has "hlleqed " prefix)
            if (altText.startsWith("hlleqed ")) {
              // Remove the prefix to get the original LaTeX
              const originalLatex = altText.substring(8); // Remove "hlleqed " (8 characters)
              const loaded = await this.loadEquationFromLatex(originalLatex);
              if (loaded && this.onEquationLoadedCallback) {
                await this.onEquationLoadedCallback(originalLatex);
              }
            }
          }
        }
      });
    } catch (error) {
    }
  }

  private async loadEquationFromLatex(latex: string): Promise<boolean> {
    try {
      const parsedEquation = this.latexConverter.parseFromLatex(latex);
      if (parsedEquation) {
        this.equationBuilder.setEquation(parsedEquation);
        // Update bracket nesting after loading the equation
        this.equationBuilder.updateBracketNesting();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error loading equation from LaTeX:", error);
      return false;
    }
  }

  private createInlineImageWithPositionOoxml(
    base64Svg: string,
    width: number,
    height: number,
    baselineOffsetPt: number = 0,
    altText: string = ""
  ): string {
    const widthInEmus = Math.round(width * 9525);
    const heightInEmus = Math.round(height * 9525);

    const imageId = "rId" + Math.random().toString(36).substring(2, 12);
    const documentRelsId = "rId1";
    const uniqueId = Math.floor(Math.random() * 1000000) + 1;

    const positionHalfPt = Math.round(baselineOffsetPt * 2);

    const ooxml = `
<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
  <pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
    <pkg:xmlData>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="${documentRelsId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>
    </pkg:xmlData>
  </pkg:part>
  <pkg:part pkg:name="/word/_rels/document.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
    <pkg:xmlData>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="${imageId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.svg"/>
      </Relationships>
    </pkg:xmlData>
  </pkg:part>
  <pkg:part pkg:name="/word/media/image1.svg" pkg:contentType="image/svg+xml">
    <pkg:binaryData>${base64Svg}</pkg:binaryData>
  </pkg:part>
  <pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml">
    <pkg:xmlData>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <w:body>
          <w:p>
            <w:r>
              ${positionHalfPt !== 0 ? `<w:rPr>
                <w:position w:val="${positionHalfPt}"/>
              </w:rPr>` : ''}
              <w:drawing>
                <wp:inline distT="0" distB="0" distL="0" distR="0">
                  <wp:extent cx="${widthInEmus}" cy="${heightInEmus}"/>
                  <wp:effectExtent l="0" t="0" r="0" b="0"/>
                  <wp:docPr id="${uniqueId}" name="Math Equation" descr="${altText}"/>
                  <wp:cNvGraphicFramePr/>
                  <a:graphic>
                    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                      <pic:pic>
                        <pic:nvPicPr>
                          <pic:cNvPr id="${uniqueId}" name="Math Equation" descr="${altText}"/>
                          <pic:cNvPicPr/>
                        </pic:nvPicPr>
                        <pic:blipFill>
                          <a:blip r:embed="${imageId}"/>
                          <a:stretch>
                            <a:fillRect/>
                          </a:stretch>
                        </pic:blipFill>
                        <pic:spPr>
                          <a:xfrm>
                            <a:off x="0" y="0"/>
                            <a:ext cx="${widthInEmus}" cy="${heightInEmus}"/>
                          </a:xfrm>
                          <a:prstGeom prst="rect">
                            <a:avLst/>
                          </a:prstGeom>
                        </pic:spPr>
                      </pic:pic>
                    </a:graphicData>
                  </a:graphic>
                </wp:inline>
              </w:drawing>
            </w:r>
          </w:p>
        </w:body>
      </w:document>
    </pkg:xmlData>
  </pkg:part>
</pkg:package>`.trim();

    return ooxml;
  }

  private async convertSvgToPng(svgString: string, width: number, height: number): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        console.log("Starting SVG to PNG conversion...");

        // Create SVG blob
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);

        // Create image element
        const img = new Image();

        img.onload = () => {
          try {
            // Calculate high-DPI dimensions
            const dpr = window.devicePixelRatio || 1;
            const canvasWidth = Math.round(width * dpr * 2); // 2x for extra quality
            const canvasHeight = Math.round(height * dpr * 2);

            console.log(`Canvas dimensions: ${canvasWidth}x${canvasHeight} (DPR: ${dpr})`);

            // Create canvas
            const canvas = document.createElement("canvas");
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              throw new Error("Failed to get 2D context");
            }

            // Set high quality rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            // Fill with white background for better contrast
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Draw SVG image scaled up
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

            // Convert to PNG blob
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error("Failed to convert canvas to blob"));
                  return;
                }

                console.log(`PNG blob created, size: ${blob.size} bytes`);

                // Convert blob to base64
                const reader = new FileReader();
                reader.onload = () => {
                  const base64 = (reader.result as string).split(",")[1];
                  console.log(`PNG base64 length: ${base64.length}`);

                  // Clean up
                  URL.revokeObjectURL(svgUrl);

                  resolve(base64);
                };
                reader.onerror = () => reject(new Error("Failed to read PNG blob"));
                reader.readAsDataURL(blob);
              },
              "image/png",
              1.0
            ); // Maximum quality
          } catch (drawError) {
            URL.revokeObjectURL(svgUrl);
            reject(drawError);
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          reject(new Error("Failed to load SVG image"));
        };

        // Load SVG
        img.src = svgUrl;
      } catch (error) {
        console.error("SVG to PNG conversion error:", error);
        reject(error);
      }
    });
  }
}
