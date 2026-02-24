import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		rollupOptions: {
			output: {
				hashCharacters: 'hex',
				manualChunks(id) {
					if (!id.includes('node_modules')) return;
					if (id.includes('mermaid')) return 'mermaid';
					if (id.includes('katex')) return 'katex';
					if (id.includes('rehype-highlight') || id.includes('highlight.js')) return 'highlight';
					if (id.includes('zod')) return 'zod';
					if (id.includes('date-fns')) return 'date-fns';
					if (id.includes('lucide')) return 'icons';
					if (id.includes('bits-ui') || id.includes('paneforge') || id.includes('svelte-sonner')) {
						return 'ui';
					}
				}
			}
		}
	}
});
