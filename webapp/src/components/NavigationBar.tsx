import React from "react";
import { NavLink } from "react-router-dom";
import styled from "@emotion/styled";

const Nav = styled.nav`
  background-color: #282c34;
  display: flex;
  justify-content: space-around;
  padding: 1em 0;
  border-radius: 10px;
`;

const StyledLink = styled(NavLink)`
  color: #61dafb;
  text-decoration: none;
  display: flex;
  font-weight: 600;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 10px 20px;
  border-radius: 5px;
  transition: background-color 0.2s ease;
  &.active {
    color: #fff;
    background-color: #61dafb;
  }
  &:hover {
    color: #fff;
    background-color: #61dafb;
  }
`;

const NavigationBar: React.FC = () => {
  return (
    <Nav>
      <StyledLink to="/" style={{ margin: "0 1em" }}>
        Home
      </StyledLink>
      <StyledLink to="/details" style={{ margin: "0 1em" }}>
        Details
      </StyledLink>
      <StyledLink to="/redeem" style={{ margin: "0 1em" }}>
        Redeem
      </StyledLink>
    </Nav>
  );
};

export default NavigationBar;
