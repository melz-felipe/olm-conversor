import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Paper,
  Typography,
} from "@mui/material";
import styled from "styled-components";
import { useDropzone } from "react-dropzone";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { GCodeViewer } from "react-gcode-viewer";

const DropContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  border: 2px dashed #eeeeee;
  border-radius: 8px;
  cursor: pointer;
`;

const Wrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  justify-content: center;
  flex: 1;
`;

const ContentLeft = styled.div`
  background-color: #ffffff;
  flex: 1;
  padding: 24px;
  display: flex;
  gap: 12px;
  flex-direction: column;
`;

const ContentRight = styled.div`
  background-color: #f5f5f5;
  flex: 1;
  padding: 24px;
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RightContentContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 3fr;
  gap: 12px;
`;

export const GCodeConversor: React.FC = () => {
  const [url, setUrl] = useState<string>("");

  const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
    maxFiles: 1,
  });

  const handleRemoveFile = () => {
    setUrl("");
  };

  useEffect(() => {
    if (acceptedFiles.length > 0) {
      const newUrl = URL.createObjectURL(acceptedFiles[0]);

      setUrl(newUrl);
    } else {
      setUrl("");
    }
  }, [acceptedFiles]);

  return (
    <Layout>
      <Wrapper>
        <ContentLeft>
          <Typography variant="h5">
            Conversor de GCode para Motoman GP88
          </Typography>
          <Typography>
            Inicie carregando o arquivo .gcode gerado pelo Cura.
          </Typography>
          <Typography>
            Os parâmetros sugeridos para o slicer são os seguintes:
            <ul>
              <li>Parâmetro 1: 5mm</li>
              <li>Parâmetro 2: 5mm</li>
              <li>Parâmetro 3: 5mm</li>
            </ul>
          </Typography>
          <DropContainer {...getRootProps({ className: "dropzone" })}>
            <input {...getInputProps()} />
            <Content>
              <Typography>
                Arraste e solte o arquivo .gcode aqui, ou clique para selecionar
                o arquivo.
              </Typography>
              {acceptedFiles.length > 0 && (
                <Typography color="gray" variant="body2">
                  Arquivo carregado: {acceptedFiles[0].name}
                </Typography>
              )}
            </Content>
          </DropContainer>
          {acceptedFiles.length > 0 && (
            <RightContentContainer>
              <Button color="error" onClick={() => handleRemoveFile()}>
                Remover arquivo
              </Button>
              <Button variant="contained">Continuar</Button>
            </RightContentContainer>
          )}
        </ContentLeft>
        <ContentRight>
          {url && (
            <GCodeViewer
              orbitControls
              width={20}
              style={{
                height: "100%",
              }}
              url={url}
            />
          )}
        </ContentRight>
      </Wrapper>
    </Layout>
  );
};
