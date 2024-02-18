import { Button, Card, Typography } from "@mui/material";
import styled from "styled-components";
import { DropzoneArea } from "mui-file-dropzone";
import { useState } from "react";

const CenterWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 256px);
  padding: 128px;
`;

const Content = styled.div`
  width: 768px;
  gap: 16px;
  display: flex;
  flex-direction: column;
`;

const CardContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
`;

const StyledCard = styled(Card)`
  width: 100%;
`;

const RightButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

export const Main: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);

  const handleChange = (files: File[]) => {
    setFile(files[0]);
  };

  return (
    <CenterWrapper>
      <Content>
        <Typography variant="h3">Conversor</Typography>
        <StyledCard>
          <CardContentWrapper>
            <Typography>
              Inicie carregando o arquivo .gcode gerado pelo Cura. Para
              assistência em como gerar o arquivo corretamente, clique aqui.
            </Typography>
            <DropzoneArea
              onChange={handleChange}
              fileObjects={file}
              dropzoneText="Arraste e solte o arquivo .gcode aqui ou clique para selecionar"
              filesLimit={1}
            />
          </CardContentWrapper>
        </StyledCard>
      </Content>
    </CenterWrapper>
  );
};
