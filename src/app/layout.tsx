import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AccessibilityProvider } from "@/components/accessibility-provider";
import { InstallPromptProvider } from "@/components/install-prompt-provider";
import { PostHogProvider } from "@/components/posthog-provider";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e6b5c" },
    { media: "(prefers-color-scheme: dark)", color: "#2d9d7a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL)
    : new URL("https://lumyf.com"),
  title: {
    default: "Lumyf",
  },
  description:
    "Lumyf – Personal & Family Finance App. Track income, expenses, investments and goals.",
  keywords: ["personal finance app", "family budget app", "expense tracker", "financial goals"],
  openGraph: { locale: "pt_BR" },
  robots: "index, follow",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/faviconn.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
    apple: "/faviconn.svg",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lumyf",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/faviconn.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/faviconn.svg" />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-QZX1KTPCYW"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-QZX1KTPCYW');
          `}
        </Script>
      </head>
      <body className={`${plusJakarta.variable} antialiased min-h-screen overflow-x-hidden`}>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('lumyf-theme');var r=document.documentElement;if(t==='dark'){r.classList.add('dark')}else{r.classList.remove('dark')}}catch(e){}})();",
          }}
        />
        <ThemeProvider>
          <PostHogProvider>
            <InstallPromptProvider>
              <AccessibilityProvider>{children}</AccessibilityProvider>
            </InstallPromptProvider>
          </PostHogProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
