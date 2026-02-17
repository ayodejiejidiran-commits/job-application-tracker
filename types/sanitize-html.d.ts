declare module "sanitize-html" {
  const sanitize: (html: string, options?: Record<string, unknown>) => string;
  export default sanitize;
}
