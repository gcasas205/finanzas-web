// pdf-parse no trae tipos. Sólo declaramos lo que usa lib/pdf-parser.ts.
declare module "pdf-parse" {
  interface PdfParseResult {
    numpages: number;
    text: string;
    info: unknown;
    metadata: unknown;
  }
  function pdfParse(data: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}
