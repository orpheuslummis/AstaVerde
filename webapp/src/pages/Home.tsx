import NFTCard from "../components/NFTCard";
import { BatchType } from "../types";
import { Link } from "react-router-dom";

const HomePage: React.FC = () => {
  const batches: BatchType[] = [
    // Add your batch data here
  ];

  return (
    <div>
      <div
        className="callout"
        style={{
          border: "1px solid #ccc",
          borderRadius: "10px",
          margin: "10px",
          boxShadow: "0 4px 8px 0 rgba(0,0,0,0.2)",
          backgroundColor: "#f9f9f9",
        }}
      >
        <p>
          BEFORE YOUR BUY: If you are planning to redeem Carbon against yourself
          or your business now or at anytime in the future. You need to create
          an account with your ethereum wallet as your name at
          https://www.evident.com/registry BEFORE buying any NFTs
          <Link to="/register">here</Link> to register. After registration, you
          can browse through our collection of NFTs. . Click{" "}
          <Link to="/details">here</Link> to go to the details page.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "1rem",
        }}
      >
        {batches.map((batch, index) => (
          <NFTCard key={index} batch={batch} />
        ))}
      </div>
    </div>
  );
};

export default HomePage;
