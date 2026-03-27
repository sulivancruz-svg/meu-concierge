import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Concierge do Passageiro',
  description: 'Plataforma operacional para agencia, passageiro, documentos e atendimento inteligente.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
