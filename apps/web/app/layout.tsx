import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { IntroTakeoff } from "./components/IntroTakeoff";
import { Footer } from "./components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MasterTrip — Your World, One Search Away",
  description:
    "Seamlessly plan flights, hotels, tours, and study abroad programs in one unified interface.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfairDisplay.variable}`}>
        <IntroTakeoff>
          <div
            className="relative z-10 bg-slate-50"
            style={{ marginBottom: "var(--footer-height, 480px)" }}
          >
            {children}
          </div>
        </IntroTakeoff>
        <Footer />
      </body>
    </html>
  );
}
