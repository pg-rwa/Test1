import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dubai Real Estate Chatbot",
  description:
    "AI-powered Dubai property market assistant — DLD transactions + PropertyFinder listings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
                crypto.randomUUID = function() {
                  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, function(c) {
                    var r = crypto.getRandomValues(new Uint8Array(1))[0];
                    return (c ^ (r & (15 >> (c / 4)))).toString(16);
                  });
                };
              }
            `,
          }}
        />
      </head>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
