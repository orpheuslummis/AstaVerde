import { navigationLinks } from "../app.config";
import { OnboardingModal } from "../components/OnboardingModal";
import { Header } from "../components/all";
import { Providers } from "./providers";
import { Helia, createHelia } from "helia";
import { cloneElement, useEffect, useState } from "react";
import "./styles/globals.css";

export default function RootLayout({ children }: { children: React.ReactElement }) {
  // const [helia, setHelia] = useState<Helia | null>(null);

  // useEffect(() => {
  //   const init = async () => {
  //     if (helia) return;
  //     try {
  //       const heliaNode = await createHelia();
  //       setHelia(heliaNode);
  //     } catch (error) {
  //       console.error("Error creating Helia:", error);
  //     }
  //   };
  //   init().catch((error) => console.error("Error in init:", error));
  // }, [helia]);

  return (
    <html lang="en">
      <body className="max-w-3xl mx-auto">
        <OnboardingModal />
        <Providers>
          <Header title={"Asta Verde"} links={navigationLinks} />
          <main>{cloneElement(children)}</main>
          {/* <main>{cloneElement(children, { helia })}</main> */}
        </Providers>
      </body>
    </html>
  );
}
