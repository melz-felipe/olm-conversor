// Arquivo auxiliar para a criação do layout do projeto (Header, Navbar, etc.)

import styled from "styled-components";
import { Header } from "./Header";
import { Navbar } from "./Navbar";

const Container = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

interface LayoutProps {
  children: React.ReactNode | React.ReactNode[];
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <Container>
      <Header />
      <Navbar />
      {children}
    </Container>
  );
};
