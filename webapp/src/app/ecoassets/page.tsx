export default function Page() {
  return (
    <>
      <div className="p-4">
        <p className="mb-4">
          I would like to introduce you to the EcoAsset .{"\n"}
          {/* Uncomment the following line and replace `ImageOfEcoAsset` with the actual image path */}
          {/* <img src={ImageOfEcoAsset} alt="EcoAsset" className="my-4" /> */}
          There's as much below the hood as on the front of one of these beauties. On the front, you will see the time,
          date, and location where some amazing biochar producers have been working hard to make high-quality biochar,
          making the world a bit better. You'll be able to see from the picture and the location that this all adds up
          :) Now let's go below the hood:
        </p>
        <ul className="list-disc pl-8 mb-4">
          <li>Item ID: The next in the sequence of EcoAssets</li>
          <li>
            Producer wallet: The wallet of the team that is working hard day in day out to make this world better with
            biochar
          </li>
          <li>
            Audit ID: The impartial verification at great expense to a company that doesn't get paid by from the sale of
            EcoAssets but from auditing the data against robust methodology for biochar production. This methodology
            includes the 'additionality' of the project. The environmental sustainability of the biomass. And the
            application of biochar.
          </li>
        </ul>
        <p className="mb-4">
          European Union concept of additionally document:{" "}
          <a
            href="https://www.europarl.europa.eu/RegData/etudes/note/join/2012/433785/EXPO-DEVE_NT(2012)433785_EN.pdf"
            className="text-blue-500 underline"
          >
            https://www.europarl.europa.eu/RegData/etudes/note/join/2012/433785/EXPO-DEVE_NT(2012)433785_EN.pdf
          </a>
        </p>
        <p className="mb-4">
          With all of these pieces on the face of it and under the hood having been collected and verified, a proposal
          is put together on EcoTradeZone. Where if purchased, a promised share will go to the producer and the owner
          (EcoTradeZone).
        </p>
        <p className="mb-4">
          Then the EcoAssets creation is completed as a result of the transactional purchase, and the asset is in the
          buyer's wallet!
        </p>

        <a href="/What.is.an.EcoAsset.pdf" download>
          What is an EcoAsset (PDF)
        </a>
      </div>
    </>
  );
}
