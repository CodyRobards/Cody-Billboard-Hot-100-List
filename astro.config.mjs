import { defineConfig } from 'astro/config';
import critters from '@astrojs/critters';
import image from '@astrojs/image';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  integrations: [
    critters({ preload: 'swap', pruneSource: true }),
    image(),
  ],
});
