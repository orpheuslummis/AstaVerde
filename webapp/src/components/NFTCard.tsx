interface NFTCardProps {
  batch: {
    name: string;
    image: string;
    description: string;
    carbonCredits: number;
  };
}

const NFTCard: React.FC<NFTCardProps> = ({ batch }) => {
  return (
    <div
      className="nft-card"
      style={{
        border: "1px solid #ccc",
        borderRadius: "10px",
        padding: "10px",
        margin: "10px",
        boxShadow: "0 4px 8px 0 rgba(0,0,0,0.2)",
      }}
    >
      <h2>{batch.name}</h2>
      <img
        src={batch.image}
        alt={batch.name}
        style={{ width: "100%", height: "auto", borderRadius: "10px" }}
      />
      <p>{batch.description}</p>
      <p>Carbon credits: {batch.carbonCredits}</p>
    </div>
  );
};

export default NFTCard;
