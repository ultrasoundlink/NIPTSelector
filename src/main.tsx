import { render } from "preact";
import { App } from "./App";
import "./styles/app.css";

const MOUNT_ID = "nipt-selector";

function mount() {
  const el = document.getElementById(MOUNT_ID);
  if (!el) {
    console.error(`[nipt-selector] No element with id "${MOUNT_ID}" found.`);
    return;
  }
  render(<App />, el);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
