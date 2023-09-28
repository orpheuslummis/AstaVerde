import React from "react";

interface MetamaskPromptProps {
  onConnect: () => void;
}

const MetamaskPrompt: React.FC<MetamaskPromptProps> = ({ onConnect }) => {
  return (
    <div>
      <h2>Metamask Required</h2>
      <p>Please connect your Metamask wallet to proceed.</p>
      <button onClick={onConnect}>Connect Metamask</button>
    </div>
  );
};

export default MetamaskPrompt;
