import "./globals.css";

export const metadata = {
  title: "Operian Operation",
  description: "Operian growth pipeline tracking dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
