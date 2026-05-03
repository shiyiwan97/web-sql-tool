import "./monacoSetup";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installSelectionHotkeyCapture } from "./lib/selectionHotkeyCapture";

installSelectionHotkeyCapture();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
