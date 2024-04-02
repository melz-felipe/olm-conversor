// Elemento da barra de navegação

import { Button, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const Wrapper = styled.div`
  background-color: #545759;
  padding: 12px 96px;
  gap: 12px;
  display: flex;
  flex-direction: row;

  & > button {
    color: #fff;
  }
`;

export const Navbar: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const navigate = useNavigate();

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Wrapper>
      <Button onClick={() => navigate("/")}>Início</Button>
      <Button color="inherit" onClick={handleClick}>
        Ferramentas
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={() => navigate("/conversor")}>
          Conversor de GCode para Motoman GP88
        </MenuItem>
      </Menu>
    </Wrapper>
  );
};
