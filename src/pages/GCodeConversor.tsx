// Arquivo responsável por renderizar a página de conversão de arquivos .gcode para o formato do Motoman GP88.

import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  LinearProgress,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import styled from "styled-components";
import { useDropzone } from "react-dropzone";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { GCodeViewer } from "react-gcode-viewer";
import { processGCode } from "../utilities/processor";

// Definição do estilo dos componentes

const StyledProgress = styled(LinearProgress)`
  height: 24px !important;
  border-radius: 4px;

  .MuiLinearProgress-bar {
    height: 24px !important;
  }
`;

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
  display: flex;
  justify-content: center;
  flex: 1;
  min-height: 0;
`;

const ContentLeft = styled.div`
  background-color: #ffffff;
  flex: 1;
  padding: 24px;
  display: flex;
  gap: 12px;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
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

const RightContentContainerStepTwo = styled.div`
  display: grid;
  grid-template-columns: 1fr 3fr;
  gap: 12px;
  margin-top: auto;
`;

const ContentWrapper = styled(Paper)`
  padding: 12px;
  min-height: 140px;
  overflow-y: auto;
`;

const RowContainer = styled(Box)`
  display: flex;
  flex-direction: row;
  gap: 12px;
`;

// Cabeçalho padrão para o arquivo de saída, contendo as configurações iniciais do manipulador (não é necessário alterar, não são comentários)

const baseHeader = `/JOB
//NAME output
//POS
///NPOS 1745,0,0,0,0,0
///TOOL 10
///POSTYPE PULSE
///PULSE
///TOOL 10
///POSTYPE BASE
///RECTAN
///RCONF 0,0,0,0,0,0,0,0`;

export const GCodeConversor: React.FC = () => {
  // Definição dos estados do componente

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [url, setUrl] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [useCircleOptimization, setUseCircleOptimization] =
    useState<boolean>(false);
  const [speed, setSpeed] = useState<string>("100");
  const [header, setHeader] = useState<string>(baseHeader);
  const [footer, setFooter] = useState<string>("END");
  const [finalResult, setFinalResult] = useState<string[] | null>(null);
  const [initialCoordinates, setInitialCoordinates] = useState<{
    x: number;
    y: number;
    z: number;
  }>({ x: 500, y: 500, z: 500 });

  const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
    maxFiles: 1,
  });

  const handleRemoveFile = () => {
    setFile(null);
    setUrl("");
  };

  // Função para processar o arquivo .gcode, lendo o arquivo e processando as linhas
  // O processamento é feito em chunks de 16KB para evitar travamentos no navegador
  // O progresso do carregamento é exibido em uma barra de progresso
  // Após o carregamento, as linhas são armazenadas no estado do componente

  const parseGCodeFile = async (file: File) => {
    const chunkSize = 1024 * 16;
    let currentPosition = 0;
    let reader = new FileReader();
    let lines: string[] = [];

    const readChunk = (start: number) => {
      setLoading(start / file.size);
      const blob = file.slice(start, start + chunkSize);
      reader.readAsText(blob);
    };

    reader.onload = (e: ProgressEvent<FileReader>) => {
      const textChunk: string = (e.target?.result as string) || "";
      lines = [...lines, ...textChunk.split("\n")];
      currentPosition += chunkSize;

      if (currentPosition < file.size) {
        readChunk(currentPosition);
      } else {
        setLoading(null);
        setLines(lines);
      }
    };

    readChunk(0);
  };

  // Funções para manipular as preferências de processamento do arquivo .gcode

  const handleCheckUseCircleOptimization = () => {
    setUseCircleOptimization(!useCircleOptimization);
  };

  const handleChangeSpeed = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const cleanedValue = e.target.value.replace(/[^0-9]/g, "");

    setSpeed(cleanedValue);
  };

  const handleChangeInitialCoordinates = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    axis: "x" | "y" | "z"
  ) => {
    const cleanedValue = e.target.value.replace(/[^0-9]/g, "");

    setInitialCoordinates({
      ...initialCoordinates,
      [axis]: Number(cleanedValue),
    });
  };

  // Função para processar o arquivo .gcode, gerando o arquivo de saída no formato do Motoman GP88

  const handleConfirmFirstStep = async () => {
    setCurrentStep(1);

    if (file) {
      setLoading(0);
      parseGCodeFile(file);
    }
  };

  // Função para resetar o processo de conversão

  const handleResetProcess = () => {
    setCurrentStep(0);
    setLines([]);
    setUseCircleOptimization(false);
    setFinalResult(null);
    setSpeed("100");
    setInitialCoordinates({ x: 500, y: 500, z: 500 });
    setHeader("");
    setFooter("END");
  };

  const handleResetSecondStep = () => {
    setCurrentStep(1);
    setFinalResult(null);
  };

  // Função para baixar o arquivo de saída, aqui é possível definir o nome do arquivo e o tipo de arquivo

  const handleDownloadFile = () => {
    if (finalResult) {
      const blob = new Blob([finalResult.join("\n")], {
        type: "text/plain",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = "output.jbi";
      a.click();
    }
  };

  const handleConfirmSecondStep = () => {
    const result = processGCode(lines, header, footer, {
      useCircleOptimization,
      speed: Number(speed || "100"),
      initialCoordinates,
    });

    setFinalResult(result);
    setCurrentStep(2);
  };

  // Atualização do estado do arquivo e da URL ao carregar um novo arquivo

  useEffect(() => {
    if (acceptedFiles.length > 0) {
      const newUrl = URL.createObjectURL(acceptedFiles[0]);

      setFile(acceptedFiles[0]);
      setUrl(newUrl);
    } else {
      setFile(null);
      setUrl("");
    }
  }, [acceptedFiles]);

  const slicedLines = useMemo(() => {
    return lines.slice(0, 100);
  }, [lines]);

  // Renderização do componente

  return (
    <Layout>
      <Wrapper>
        {currentStep === 0 && (
          <>
            <ContentLeft>
              <Typography variant="h5">
                Conversor de GCode para Motoman GP88
              </Typography>
              <Typography>
                Inicie carregando o arquivo .gcode gerado pelo Ultimaker Cura.
              </Typography>
              <DropContainer {...getRootProps({ className: "dropzone" })}>
                <input {...getInputProps()} />
                <Content>
                  <Typography>
                    Arraste e solte o arquivo .gcode aqui, ou clique para
                    selecionar o arquivo.
                  </Typography>
                  {!!file && (
                    <Typography color="gray" variant="body2">
                      Arquivo carregado: {file.name}
                    </Typography>
                  )}
                </Content>
              </DropContainer>
              {!!file && (
                <RightContentContainer>
                  <Button color="error" onClick={() => handleRemoveFile()}>
                    Remover arquivo
                  </Button>
                  <Button
                    onClick={() => handleConfirmFirstStep()}
                    variant="contained"
                  >
                    Parece certo, continuar
                  </Button>
                </RightContentContainer>
              )}
            </ContentLeft>
          </>
        )}
        {currentStep === 1 && (
          <>
            <ContentLeft>
              {loading === null && (
                <>
                  <Typography variant="h5">
                    Resultado do processamento do arquivo .gcode
                  </Typography>
                  <Typography variant="h6">
                    Conteúdo do arquivo .gcode
                  </Typography>
                  <ContentWrapper>
                    <Typography variant="body2">
                      {slicedLines.map((line, index) => (
                        <div key={index}>{line}</div>
                      ))}
                    </Typography>
                  </ContentWrapper>
                  <Typography variant="body2" color="gray">
                    As linhas exibidas são as primeiras 100 linhas do arquivo,
                    um total de {lines.length} linhas foram carregadas com
                    sucesso.
                  </Typography>
                  <Typography variant="h6">
                    Preferências de processamento
                  </Typography>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={useCircleOptimization}
                          onChange={() => handleCheckUseCircleOptimization()}
                        />
                      }
                      label="Utilizar otimização de movimentos circulares"
                    />
                  </FormGroup>
                  <TextField
                    label="Velocidade dos movimentos"
                    value={speed}
                    onChange={(e) => handleChangeSpeed(e)}
                  />
                  <RowContainer>
                    <TextField
                      label="Coordenada X inicial"
                      value={initialCoordinates.x}
                      onChange={(e) => handleChangeInitialCoordinates(e, "x")}
                      fullWidth
                    />
                    <TextField
                      label="Coordenada Y inicial"
                      value={initialCoordinates.y}
                      onChange={(e) => handleChangeInitialCoordinates(e, "y")}
                      fullWidth
                    />
                    <TextField
                      label="Coordenada Z inicial"
                      value={initialCoordinates.z}
                      onChange={(e) => handleChangeInitialCoordinates(e, "z")}
                      fullWidth
                    />
                  </RowContainer>
                  <TextField
                    multiline
                    rows={5}
                    label="Cabeçalho do arquivo de saída"
                    value={header}
                    onChange={(e) => setHeader(e.target.value)}
                  />
                  <TextField
                    multiline
                    rows={5}
                    label="Rodapé do arquivo de saída"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                  />
                  <RightContentContainerStepTwo>
                    <Button color="error" onClick={() => handleResetProcess()}>
                      Voltar
                    </Button>
                    <Button
                      onClick={() => handleConfirmSecondStep()}
                      variant="contained"
                    >
                      Continuar
                    </Button>
                  </RightContentContainerStepTwo>
                </>
              )}
              {loading !== null && (
                <>
                  <Typography variant="h5">Processando arquivo...</Typography>
                  <StyledProgress variant="determinate" value={loading * 100} />
                </>
              )}
            </ContentLeft>
          </>
        )}
        {currentStep === 2 && (
          <ContentLeft>
            <Typography variant="h5">Arquivo final</Typography>
            {finalResult && (
              <Alert severity="success">
                O arquivo foi processado com sucesso, você pode baixar o arquivo
                clicando no botão abaixo.
              </Alert>
            )}
            {lines.length > 5000 && (
              <Alert severity="warning">
                O arquivo possui mais de 5000 linhas, o manipulador pode
                rejeitar este programa, utilize otimizações para tentar reduzir
                o número de linhas.
              </Alert>
            )}
            <RightContentContainerStepTwo>
              <Button color="error" onClick={() => handleResetSecondStep()}>
                Voltar
              </Button>
              <Button onClick={() => handleDownloadFile()} variant="contained">
                Baixar arquivo
              </Button>
            </RightContentContainerStepTwo>
          </ContentLeft>
        )}
        <ContentRight>
          {url && (
            <GCodeViewer
              orbitControls
              showAxes
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
