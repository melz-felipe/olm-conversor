import styled from "styled-components";
import { Layout } from "../components/Layout";
import { List, ListItem, Typography } from "@mui/material";

const Content = styled.div`
  overflow-y: auto;
  margin: 24px;
  gap: 12px;
  display: flex;
  flex-direction: column;
`;

export const Main: React.FC = () => {
  return (
    <Layout>
      <Content>
        <Typography variant="h5">
          Bem vindo ao portal de ferramentas do AMARC.
        </Typography>
        <Typography>
          As ferramentas podem ser acessadas através do menu superior.
        </Typography>
      </Content>
    </Layout>
  );
};
