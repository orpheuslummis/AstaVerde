import { Providers } from "./providers";
import "./styles/globals.css";

export const metadata = {
  title: "wagmi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="max-w-xl mx-auto">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
