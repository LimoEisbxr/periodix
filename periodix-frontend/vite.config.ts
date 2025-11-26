import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        proxy: {
            '/api': 'http://localhost:3001',
        },
    },
    build: {
        // Enable minification optimizations
        minify: 'esbuild',
        // Generate source maps for production debugging (can be disabled for smaller builds)
        sourcemap: false,
        // Target modern browsers for smaller bundle
        target: 'es2020',
        // Optimize chunk splitting
        rollupOptions: {
            output: {
                // Manual chunk splitting for better caching
                manualChunks: {
                    // React core in its own chunk (rarely changes)
                    'react-vendor': ['react', 'react-dom'],
                },
            },
        },
        // Increase chunk size warning limit (TailwindCSS can be large)
        chunkSizeWarningLimit: 600,
    },
    // Optimize dependency pre-bundling
    optimizeDeps: {
        include: ['react', 'react-dom'],
    },
});
