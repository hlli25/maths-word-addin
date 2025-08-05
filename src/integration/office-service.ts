import { EquationBuilder } from '../core/equation-builder';
import { LatexConverter } from '../core/latex-converter';

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
    await Word.run(async (context) => {
      const selection = context.document.getSelection();

      // Convert SVG string to base64
      const base64Svg = btoa(
        encodeURIComponent(svgString).replace(/%([0-9A-F]{2})/g, (match, p1) =>
          String.fromCharCode(parseInt(p1, 16))
        )
      );

      // Add unique prefix to LaTeX for reliable equation detection
      const prefixedLatex = `hlleqed ${latex}`;

      // Insert the image with positioning using OOXML
      const ooxml = this.createInlineImageWithPositionOoxml(base64Svg, width, height, baselineOffsetPt, prefixedLatex);
      selection.insertOoxml(ooxml, Word.InsertLocation.replace);
      await context.sync();
    });
  }

  setupEquationImageHandler(): void {
    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      () => this.handleSelectionChange()
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
            if (altText.startsWith('hlleqed ')) {
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
      console.log("Selection change handler error:", error);
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
}