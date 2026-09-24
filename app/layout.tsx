import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Rubik } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const display = Rubik({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["600", "800"],
});

export const metadata: Metadata = {
  title: { default: "ASSCAT iRATE", template: "%s · ASSCAT iRATE" },
  description: "ASSCAT iRATE — Faculty Evaluation System",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#28a745",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[15px]">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
