declare module "html-to-docx" {
  const htmlToDocx: (html: string, options?: unknown, documentOptions?: unknown) => Promise<unknown>;
  export default htmlToDocx;
}
