"use client";

/*
mode: all, redeemed, not-redeemed
start: the latest batch
perPage: 10
*/
import { Batch } from "../../lib/batch";
import { astaverdeContractConfig } from "../../lib/contracts";
import { ChangeEvent, Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import {
  paginatedIndexesConfig,
  useAccount,
  useContractInfiniteReads,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
} from "wagmi";

export default function Page() {
  const {
    data: lastBatchID,
    isError,
    isLoading,
    error: lastBatchIDError,
  } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "lastBatchID",
  });

  if (lastBatchIDError || lastBatchID === undefined) {
    console.log("lastBatchIDError", lastBatchIDError);
  }
  const lastBatchIDn: number = lastBatchID ? Number(lastBatchID) : 0;

  console.log("lastBatchIDn, isError, isLoading", lastBatchID, isError, isLoading);

  const { data, fetchNextPage, error } = useContractInfiniteReads({
    cacheKey: "batchMetadata",
    ...paginatedIndexesConfig(
      (batchID: bigint) => {
        console.log("fetching batchID", batchID);
        return [
          {
            ...astaverdeContractConfig,
            functionName: "getBatchInfo",
            args: [batchID] as const,
          },
        ];
      },
      { start: lastBatchIDn, perPage: 10, direction: "decrement" },
    ),
  });
  console.log("data", data);

  if (error) {
    console.log("error", error);
    return <div>Could not display, sorry.</div>;
  }

  const batches: Batch[] =
    data?.pages?.flatMap(
      (page: any[]) =>
        page?.map((batch: any) => {
          console.log("batch", batch);
          const tokenIDs: number[] = batch.result?.[0] || [];
          const timestamp: number = batch.result?.[1] || 0;
          const price: number = batch.result?.[2] || 0;
          const itemsLeft: number = batch.result?.[3] || 0;
          const batchProper = new Batch(0, tokenIDs, timestamp, price, itemsLeft); // Assuming batch.id is not available, replace 0 with the correct value
          console.log("batchProper", batchProper);
          return batchProper;
        }),
    ) || [];

  return (
    <>
      <div>
        <h1 className="font-bold ">My Tokens</h1>

        {/* loop through the batch ids */}
        <div className="flex flex-col gap-2">
          {batches.map((batch) => (
            <>
              <BatchRedeemCard batch={batch} />
            </>
          ))}
        </div>
      </div>
    </>
  );
}

function BatchRedeemCard({ batch }: { batch: Batch }) {
  const { address } = useAccount();
  const [sameAddresses, setSameAddresses] = useState<`0x${string}`[]>();
  const [redeemableTokens, setRedeemableTokens] = useState<bigint[]>([]);
  const [redeemAmount, setRedeemAmount] = useState<string>();

  console.log("batch in mytokens: ", batch.token_ids);

  useEffect(() => {
    if (address && batch) {
      const _sameAddresses: `0x${string}`[] = [];
      // Use a for loop to fill the array
      for (let i = 0; i < batch.token_ids.length; i++) {
        _sameAddresses.push(address);
      }

      setSameAddresses(_sameAddresses);
    }
  }, [batch.token_ids.length]);

  const { data: ownedIndex } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "balanceOfBatch",
    enabled: sameAddresses !== undefined,
    args: [sameAddresses!, batch.token_ids as unknown as bigint[]],
  });

  const ownerTokens = useCallback(() => {
    if (ownedIndex) {
      return batch.token_ids.filter((_, index) => +ownedIndex[index].toString() === 1);
    }
  }, [batch.token_ids, ownedIndex]);

  const { config } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "redeemTokens",
    enabled: redeemableTokens.length > 0,
    args: [redeemableTokens],
  });
  const { write: redeemTokens } = useContractWrite(config);

  console.log("redeem", redeemableTokens);

  if (ownerTokens() && ownerTokens()!.length === 0) {
    return (
      <></>
      // <div className="bg-white rounded-lg shadow-md p-4">
      //   <p>Batch {batch.id}</p>
      //   <p>No Tokens</p>
      // </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-lg font-semibold">Batch: {batch.id}</h2>
        <p className="mt-2">Token IDs: {ownerTokens()}</p>
        {ownerTokens()?.map((redeemableToken) => (
          <>
            <RedeemableTokenNumber redeemableToken={redeemableToken} setRedeemableTokens={setRedeemableTokens} />
          </>
        ))}

        {/* <div className="pt-2">Redeem amount: {redeemTokens && redeemTokens.length}</div> */}

        <div className="w-full flex justify-between">
          {/* <input
            className="border rounded p-2"
            type="text"
            defaultValue={1}
            value={redeemAmount}
            onChange={(e) => setRedeemAmount(e.target.value)}
          /> */}
          <button
            className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            disabled={!redeemTokens}
            onClick={() => {
              console.log(redeemableTokens);
              redeemTokens?.();
            }}
          >
            Redeem
          </button>
        </div>
      </div>
    </>
  );
}

function RedeemableTokenNumber({
  redeemableToken,
  setRedeemableTokens,
}: {
  redeemableToken: number;
  setRedeemableTokens: Dispatch<SetStateAction<bigint[]>>;
}) {
  const { data: tokenInfo } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "tokens",
    args: [BigInt(redeemableToken)],
  });
  console.log("🚀 ~ file: page.tsx:160 ~ RedeemableTokens ~ tokenInfo:", tokenInfo);

  // useEffect(() => {
  //   if (tokenInfo && tokenInfo[3] === true) {
  //     setRedeemableTokens((redeemableTokens) => [...redeemableTokens, BigInt(tokenInfo[0].toString())]);
  //   }
  // }, [tokenInfo]);

  // If token redeemed. Do not show
  // if(tokenInfo.)

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;

    if (isChecked) {
      // If the checkbox is checked, add the number to the array
      setRedeemableTokens((redeemableTokens) => [...redeemableTokens, BigInt(redeemableToken)]);
    } else {
      // If the checkbox is unchecked, remove the number from the array
      setRedeemableTokens((redeemableTokens) => redeemableTokens.filter((n) => n !== BigInt(redeemableToken)));
    }
  };

  return (
    <>
      <div>
        Token {tokenInfo && tokenInfo[0].toString()}: {tokenInfo?.[3] === false ? "Not redeemed" : "Redeemed"}
        {tokenInfo?.[3] === false ? (
          <input className="ml-2" type="checkbox" value="1" onChange={(e) => handleCheckboxChange(e)} />
        ) : (
          <></>
        )}
      </div>
    </>
  );
}
