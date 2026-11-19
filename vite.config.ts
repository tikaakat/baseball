import { defineConfig } from 'vite';

// GitHub Pages（https://<user>.github.io/baseball/）でも動くよう相対パスで出力する
export default defineConfig({
  base: './',
});
