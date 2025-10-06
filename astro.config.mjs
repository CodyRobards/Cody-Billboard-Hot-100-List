import { defineConfig } from 'astro/config';
import critters from '@astrojs/critters';
import mdx from '@astrojs/mdx';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  integrations: [mdx(), critters({ preload: 'swap', pruneSource: true })],
});
