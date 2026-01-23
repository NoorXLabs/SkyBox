import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './style.css'

export default {
  extends: DefaultTheme,
  // Add custom components or layout overrides here
  // enhanceApp({ app, router, siteData }) {
  //   // Register global components
  //   // app.component('MyComponent', MyComponent)
  // },
} satisfies Theme
