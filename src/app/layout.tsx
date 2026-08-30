import type { Metadata } from "next";
import "./globals.css";
import { Geist, Bricolage_Grotesque } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "BernJos Dashboard",
  description:
    "BernJos Bread & Pastries — payroll, people, time & finance in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const devAuth = isDevAuthEnabled();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable, bricolage.variable)}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {devAuth ? (
            <>
              {children}
              <Toaster />
              <Analytics />
              <SpeedInsights />
            </>
          ) : (
            <ClerkProvider signInUrl="/sign-in">
              {children}
              <Toaster />
              <Analytics />
              <SpeedInsights />
            </ClerkProvider>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
