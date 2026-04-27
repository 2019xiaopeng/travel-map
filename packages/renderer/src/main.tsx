import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

window.addEventListener("error", (event) => {
  console.error("window.error", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("window.unhandledrejection", event.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
