import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import CrashBoundary from "./app/CrashBoundary";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CrashBoundary>
      <App />
    </CrashBoundary>
  </React.StrictMode>,
);
