// Arquivo base com as configurações iniciais do projeto

import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { ThemeProvider as StyledThemeProvider } from "styled-components";

import Router from "./router";
import theme from "./theme";

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <StyledThemeProvider theme={theme}>
        <BrowserRouter>
          <Router />
        </BrowserRouter>
      </StyledThemeProvider>
    </ThemeProvider>
  );
};

export default App;
