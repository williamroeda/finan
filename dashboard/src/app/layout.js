import "./globals.css";

export const metadata = {
  title: "TioPato - Dashboard de Simulações",
  description: "Dashboard de simulações Santander Financiamentos",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
