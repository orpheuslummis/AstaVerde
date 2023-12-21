/*
import { json } from "@helia/json";
import { CID } from "multiformats/cid";
import { Helia } from "helia";

export async function getJsonFromCids(helia: Helia, cids: string[]) {
  const j = json(helia);
  const promises = cids.map(async (cidString) => {
    const cid : CID = CID.parse(cidString);
    console.log(cid);
    console.log(await j.get(cid));
  });
  await Promise.all(promises);
}

*/