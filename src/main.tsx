import { createRoot } from "react-dom/client";
import "@fontsource/pixelify-sans/latin-400.css";
import "@fontsource/pixelify-sans/latin-500.css";
import "@fontsource/pixelify-sans/latin-700.css";
import "@fontsource/vt323/latin-400.css";
import "./styles/game.css";
import "./styles/screens.css";
import "./styles/memex.css";
import { installTextures } from "./lib/pixels";
import { App } from "./App";
import { Memex } from "./components/Memex";

installTextures();

const isMemex = window.location.pathname.replace(/\/$/, "") === "/lotnok";

createRoot(document.getElementById("root")!).render(isMemex ? <Memex /> : <App />);
