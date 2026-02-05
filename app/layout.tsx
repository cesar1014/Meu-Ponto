import type { Metadata, Viewport } from "next";
import './globals.css';
import { AuthProvider } from "./contexts/AuthContext";
import { PontoProvider } from "./contexts/PontoContext";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Ponto App",
  description: "Controle de ponto pessoal e seguro",
  manifest: "/manifest.json",
};

// PWA settings for mobile
export const viewport: Viewport = {
  themeColor: "#070A12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <AuthProvider>
          <PontoProvider>
            {children}
            <ServiceWorkerRegister />
          </PontoProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
