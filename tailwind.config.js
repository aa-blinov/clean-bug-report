import ui from '@monos/ui/tailwind-preset';

export default {
  presets: [ui],
  content: [
    './index.html',
    './src/**/*.{svelte,js,ts}',
    './node_modules/@monos/ui/src/**/*.svelte'
  ]
};
