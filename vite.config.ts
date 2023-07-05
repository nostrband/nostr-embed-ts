import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import viteSvgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        viteSvgr()
    ],
    resolve: {
        alias: {
            "@src": path.resolve(__dirname, 'src'),
            "@assets": path.resolve(__dirname, 'src/assets'),
            "@components": path.resolve(__dirname, 'src/components'),
            "@hooks": path.resolve(__dirname, 'src/hooks'),
            "@pages": path.resolve(__dirname, 'src/pages'),
            "@enums": path.resolve(__dirname, 'src/enums'),
            "@types": path.resolve(__dirname, 'src/types'),
        }
    }
});
