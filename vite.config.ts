import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Two build modes:
//   default  → hashed JS/CSS in dist/, mount into <div id="nipt-selector"></div>
//   "embed"  → single-file HTML in dist/ (copy/paste into Webflow Embed)
export default defineConfig(({ mode }) => {
  const embed = mode === "embed";
  return {
    plugins: [preact(), ...(embed ? [viteSingleFile()] : [])],
    build: {
      target: "es2020",
      cssCodeSplit: false,
      outDir: embed ? "dist-embed" : "dist",
      assetsInlineLimit: embed ? 100_000_000 : 4096,
      rollupOptions: {
        output: embed
          ? undefined
          : {
              entryFileNames: "nipt-selector.js",
              assetFileNames: (info) => {
                if (info.name?.endsWith(".css")) return "nipt-selector.css";
                return "assets/[name]-[hash][extname]";
              },
            },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  };
});
