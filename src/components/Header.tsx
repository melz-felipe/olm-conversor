import styled from "styled-components";

const Container = styled.div`
  display: flex;
  width: 100%;
`;

const Content = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  margin: 24px 96px;

  img,
  svg {
    height: 96px;
  }
`;

export const Header: React.FC = () => {
  return (
    <Container>
      <Content>
        <a href="https://www.amarc.ufscar.br/" target="_blank">
          <img src="logo_amarc.png" alt="Amarc" />
        </a>
        <img src="logo_ufscar.svg" alt="UFSCar" />
      </Content>
    </Container>
  );
};
