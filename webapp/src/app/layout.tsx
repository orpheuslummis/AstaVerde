import { navigationLinks } from "../app.config";
import { OnboardingModal } from "../components/OnboardingModal";
import { Header } from "../components/all";
import { Providers } from "./providers";
import "./styles/globals.css";
import { cloneElement } from "react";

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
      <body className="">
        <OnboardingModal />
        <Providers>
          <Header title={"Asta Verde"} links={navigationLinks} />
          <div className="max-w-6xl mx-auto">
            <main>{cloneElement(children)}</main>
          </div>
          {/* <main>{cloneElement(children, { helia })}</main> */}
        </Providers>
      </body>
    </html>
  );
}
