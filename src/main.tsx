import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "@/index.css";

const appRootNode = document.getElementById("root");
if (!appRootNode) {
  throw new Error("Unable to locate DOM mounting container (#root).");
}

createRoot(appRootNode).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
