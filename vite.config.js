import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
    server: {
        port: 5173,
        strictPort: true,
        cors: {
            origin: "http://127.0.0.1:5000"
        }
    },

    build: {
        outDir: resolve(__dirname, "src/js/dist"),
        emptyOutDir: true,
        manifest: true,

        rolldownOptions: {
            input: {
                tooltipMover: resolve(
                    __dirname,
                    "src/js/modules/Tooltip Mover.js"
                )
            }
        }
    }
});