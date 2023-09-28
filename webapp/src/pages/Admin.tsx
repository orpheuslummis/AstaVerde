/*
import React, { useState } from "react";
import Web3 from "web3";

// Initialize web3 and the contract
const web3 = new Web3(Web3.givenProvider);
const contractABI = 
const contractAddress =
const contract = new web3.eth.Contract(contractABI, contractAddress);

const Admin = () => {
  const [newURI, setNewURI] = useState("");
  const [newProducerShare, setNewProducerShare] = useState(0);
  const [account, setAccount] = useState("");

  // Fetch the current account
  const fetchAccount = async () => {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0]);
  };

  const setBaseURI = async () => {
    await contract.methods.setBaseURI(newURI).send({ from: account });
  };

  const setProducerShare = async () => {
    await contract.methods.setProducerSharePercent(newProducerShare).send({ from: account });
  };

  const pauseContract = async () => {
    await contract.methods.pause().send({ from: account });
  };

  const unpauseContract = async () => {
    await contract.methods.unpause().send({ from: account });
  };

  return (
    <div>
      <button onClick={fetchAccount}>Connect Wallet</button>
      <p>This button connects your Ethereum wallet to interact with the contract. You must connect a wallet with admin rights.</p>
  
      <h3>Base URI</h3>
      <input value={newURI} onChange={(e) => setNewURI(e.target.value)} />
      <button onClick={setBaseURI}>Set Base URI</button>
      <p>Change the base URI that provides the location for token metadata. Input the new URI and click 'Set Base URI'.</p>
  
      <h3>Producer Share</h3>
      <input value={newProducerShare} onChange={(e) => setNewProducerShare(e.target.value)} type="number" min="0" max="100" />
      <button onClick={setProducerShare}>Set Producer Share</button>
      <p>Set the percentage of the revenue that will go to the carbon credit producer. Enter a number between 0 and 100, then click 'Set Producer Share'.</p>
  
      <h3>Contract Controls</h3>
      <button onClick={pauseContract}>Pause Contract</button>
      <button onClick={unpauseContract}>Unpause Contract</button>
      <p>Pause or unpause the contract. While paused, no one can mint or redeem tokens. Use 'Pause Contract' to pause and 'Unpause Contract' to resume normal operations.</p>
    </div>
  );
};
*/

const AdminPage: React.FC = () => {
  return (
    <div>
      <h1>Admin Page</h1>
      <p>TBD.</p>
    </div>
  );
};
  

export default AdminPage;