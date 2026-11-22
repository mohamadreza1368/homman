import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "@/index.css";

/**
 * Encapsulated runtime bootstrapper for the Hoomaan 3D Anatomy platform.
 * Ensures document layout readiness, handles mounting container resolution,
 * and sets up React StrictMode execution.
 */
export class HoomaanPlatformBootstrap {
  public static readonly ROOT_ELEMENT_ID = "root";

  public static initialize(): void {
    if (typeof document === "undefined") return;

    this.configureDocumentAttributes();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.mountAppTree(), { once: true });
    } else {
      this.mountAppTree();
    }
  }

  private static configureDocumentAttributes(): void {
    const htmlNode = document.documentElement;
    if (!htmlNode.getAttribute("lang")) {
      htmlNode.setAttribute("lang", "fa");
    }
    if (!htmlNode.getAttribute("dir")) {
      htmlNode.setAttribute("dir", "rtl");
    }
  }

  private static mountAppTree(): void {
    const container = this.ensureRootNode();
    const reactRoot = createRoot(container);

    reactRoot.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }

  private static ensureRootNode(): HTMLElement {
    const existing = document.getElementById(this.ROOT_ELEMENT_ID);
    if (existing) return existing;

    console.warn(`[Hoomaan] Mount element #${this.ROOT_ELEMENT_ID} not found in DOM. Creating fallback host.`);
    const fallbackNode = document.createElement("div");
    fallbackNode.id = this.ROOT_ELEMENT_ID;
    document.body.appendChild(fallbackNode);
    return fallbackNode;
  }
}

HoomaanPlatformBootstrap.initialize();
