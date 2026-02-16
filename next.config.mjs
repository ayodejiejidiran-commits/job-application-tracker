/** @type {import(next).NextConfig} */
const nextConfig = {
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],

  reactStrictMode: true
};

export default nextConfig;
