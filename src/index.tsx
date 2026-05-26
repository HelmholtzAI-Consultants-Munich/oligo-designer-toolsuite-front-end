import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import AuthProvider from "./contexts/AuthProvider";
import RunsProvider from "./contexts/RunsProvider";
import CacheProvider from "./contexts/CacheProvider";
const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
);
root.render(
    <React.StrictMode>
        <RunsProvider>
            <AuthProvider>
                <CacheProvider>
                    <App />
                </CacheProvider>
            </AuthProvider>
        </RunsProvider>
    </React.StrictMode>
);
