# AstaVerde dev notes


## Contract deployment on Sepolia

```shell
npm run test
npm run compile && npm run postinstall
npm run deploy:contracts -- --network sepolia
```

Then update the contract address and abi that we're using in the frontend

The new contract will have any batches or tokens


## Minting process

1) Define your `.env` 

```
PRIVATE_KEY=""
INFURA_API_KEY=""
CHAIN_SELECTION="sepolia"
CONTRACT_ADDRESS=""
EMAIL=""
IMAGE_FOLDER="./example/images/"
CSV_PATH="./example/ok.csv"
```

2) Obtain csv in the format `id,name,description,producer_address`

3) `npm run task:mint`



