import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { TrpcProvider } from "../components/providers/TrpcProvider";
import { PostHogProvider } from "../components/providers/PostHogProvider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "CareSync",
  description: "Care coordination for families",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "font-sans",
        geist.variable,
        geistMono.variable,
        fraunces.variable,
      )}
    >
      {/* Anti-FOUC: set dark class before paint */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var s=localStorage.getItem('carelog-theme');if(s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(_){}})();`,
        }}
      />
      <body suppressHydrationWarning>
        <PostHogProvider>
          <TrpcProvider>{children}</TrpcProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
