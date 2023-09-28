import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

const FooterContainer = styled.footer`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1em;
  border-radius: 10px;
  background-color: #f8f9fa;
`;

const FooterLink = styled(Link)`
  color: #61dafb;
  text-decoration: none;
  margin: 0 1em;
`;

const Footer: React.FC = () => {
  return (
    <FooterContainer>
      <p>© {new Date().getFullYear()} EcoTradeZone</p>
      <FooterLink to="/terms">Terms of Service</FooterLink>
    </FooterContainer>
  );
};

export default Footer;
