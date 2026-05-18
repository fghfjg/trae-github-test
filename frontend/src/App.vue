<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { initTheme } from '@/utils/theme.js'

onMounted(() => {
  initTheme()
})
</script>

<style>
:root {
  --primary: #667eea;
  --bg-primary: #f5f7fa;
  --bg-card: #ffffff;
  --bg-input: #f0f2f5;
  --bg-hover: #e8eaed;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-muted: #999999;
  --border: #e0e0e0;
  --shadow: rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] {
  --primary: #667eea;
  --bg-primary: #121212;
  --bg-card: #1e1e1e;
  --bg-input: #2c2c2c;
  --bg-hover: #333333;
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --text-muted: #666666;
  --border: #333333;
  --shadow: rgba(0, 0, 0, 0.3);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color 0.3s, color 0.3s;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

a {
  color: var(--primary);
  text-decoration: none;
}

button {
  font-family: inherit;
}

input, textarea, select {
  font-family: inherit;
}
</style>
