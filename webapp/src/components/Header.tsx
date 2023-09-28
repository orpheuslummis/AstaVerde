import styled from "styled-components";

const HoverableSpan = styled.span`
  cursor: pointer;
  text-decoration: none;
  color: #fff;

  &:hover {
    color: #000;
  }
`;

const Header: React.FC = () => {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#61dafb",
        color: "#fff",
        padding: "1em 0",
        borderRadius: "10px",
        fontWeight: "600",
        fontSize: "1.5em",
      }}
    >
      <HoverableSpan>EcoTradeZone</HoverableSpan>
    </header>
  );
};

export default Header;
