import localFont from "next/font/local";
import "./globals.css";

const brandSans = localFont({
  src: "./fonts/BrandSans-Variable.woff2",
  variable: "--font-brand-sans",
  weight: "100 900",
});

export const metadata = { title: "Fonty — local fonts", description: "Local fonts fixture." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={brandSans.variable}>
      <body>{children}</body>
    </html>
  );
}
