import { resolve } from 'node:path'
import { defineConfig, type HeadConfig } from 'vitepress'
import { loadEnv } from 'vite'
import llmstxt from 'vitepress-plugin-llms'
import { commands } from './commands'

const env = loadEnv('', resolve(import.meta.dirname, '..'))

const head: HeadConfig[] = [
  ['link', { rel: 'icon', type: 'image/svg+xml', href: '/devbox-logo-grey.svg' }],
]

if (env.VITE_RYBBIT_SRC && env.VITE_RYBBIT_SITE_ID) {
  head.push([
    'script',
    {
      src: env.VITE_RYBBIT_SRC,
      'data-site-id': env.VITE_RYBBIT_SITE_ID,
      defer: ''
    }
  ])
}

export default defineConfig({
  title: 'DevBox',
  description: 'Development environment management CLI',
  srcExclude: ['**/architecture/**'],

  sitemap: {
    hostname: 'https://devbox.noorxlabs.com'
  },

  vite: {
    plugins: [llmstxt()]
  },

  head,

  themeConfig: {
    logo: '/devbox-logo-grey.svg',

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'Reference', link: '/reference/', activeMatch: '/reference/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Concepts Overview', link: '/guide/concepts' },
            { text: 'Shell Integration', link: '/guide/shell-integration' },
          ],
        },
        {
          text: 'Workflows',
          items: [
            { text: 'New Project', link: '/guide/workflows/new-project' },
            { text: 'Daily Development', link: '/guide/workflows/daily-development' },
            { text: 'Multi-Machine', link: '/guide/workflows/multi-machine' },
          ],
        },
        {
          text: 'Help',
          items: [
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ],
        },
        {
          text: 'Resources',
          items: [
            { text: 'LLMs.txt', link: '/llms-full.txt' },
          ],
        },
      ],

      '/reference/': [
        {
          text: 'Commands',
          items: [
            { text: 'Overview', link: '/reference/' },
            ...commands.map(({ text, link }) => ({ text, link })),
            { text: 'Configuration', link: '/reference/configuration' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'Custom Templates', link: '/reference/custom-templates' },
            { text: 'Hooks', link: '/reference/hooks' },
          ],
        },
        {
          text: 'Resources',
          items: [
            { text: 'LLMs.txt', link: '/llms-full.txt' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/NoorXLabs/DevBox' },
    ],

    footer: {
      message: 'Released under the Apache License 2.0.',
      copyright: `&copy; ${new Date().getFullYear()} Noor Chasib`,
    },

    search: {
      provider: 'local',
    },
  },
})
