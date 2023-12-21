import React from "react";

export default function Page({ params }: { params: { id: string } }) {
  if (typeof params.id !== "string") {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>Token: {params.id}</h1>
      <p>This is a simple page to view one token.</p>
    </div>
  );
}
