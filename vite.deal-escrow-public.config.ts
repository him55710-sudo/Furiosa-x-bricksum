import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'web/deal-escrow-public',plugins:[react()],build:{outDir:'../../dist-deal-escrow-public',emptyOutDir:true}});
