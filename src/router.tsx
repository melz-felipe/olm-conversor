import React from "react";
import { Routes, Route } from "react-router-dom";
import { Main } from "./pages/Main";
import { GCodeConversor } from "./pages/GCodeConversor";

const Router: React.FC = () => (
  <>
    <Routes>
    <Route path="/" element={<Main />} />
      <Route path="/conversor" element={<GCodeConversor />} />
    </Routes>
  </>
);

export default Router;
