import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HomeScreen } from "@/pages/home-screen";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <HomeScreen />
    </StrictMode>,
);
