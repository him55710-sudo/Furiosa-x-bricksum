import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'web/deal-escrow',plugins:[react()],build:{outDir:'../../dist-deal-escrow',emptyOutDir:true}});
