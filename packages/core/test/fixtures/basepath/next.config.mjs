/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/docs",
  output: "standalone",
  i18n: { locales: ["en", "de"], defaultLocale: "en" },
};

export default nextConfig;
