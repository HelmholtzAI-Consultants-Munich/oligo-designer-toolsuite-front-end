import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import AuthProvider from "./modules/AuthProvider";
import RunsProvider from "./modules/RunsProvider";
const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
);
root.render(
    <React.StrictMode>
        <RunsProvider>
            <AuthProvider>
                <App />
            </AuthProvider>
        </RunsProvider>
    </React.StrictMode>
);
