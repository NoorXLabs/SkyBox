import { resolve } from 'node:path'
import { defineConfig, type HeadConfig } from 'vitepress'
import { loadEnv } from 'vite'
import llmstxt from 'vitepress-plugin-llms'
import { commands } from './commands'

const env = loadEnv('', resolve(import.meta.dirname, '..'))

const head: HeadConfig[] = [
  ['link', { rel: 'icon', type: 'image/svg+xml', href: '/skybox-logo-grey.svg' }],
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
  title: 'SkyBox',
  description: 'Local-first development containers with remote sync. Run containers locally, sync code bidirectionally, and switch between machines seamlessly.',
  lang: 'en-US',
  srcExclude: ['**/snippets/**'],

  sitemap: {
    hostname: 'https://skybox.noorxlabs.com'
  },

  vite: {
    plugins: [llmstxt()]
  },

  head,

  transformHead({ pageData }) {
    const head: HeadConfig[] = []
    const siteUrl = 'https://skybox.noorxlabs.com'
    const pagePath = pageData.relativePath
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '')
    const pageUrl = `${siteUrl}/${pagePath}`
    const title = pageData.frontmatter.title || pageData.title
    const description = pageData.frontmatter.description || 'Local-first development containers with remote sync.'

    head.push(['meta', { property: 'og:title', content: title }])
    head.push(['meta', { property: 'og:description', content: description }])
    head.push(['meta', { property: 'og:type', content: 'website' }])
    head.push(['meta', { property: 'og:url', content: pageUrl }])
    head.push(['meta', { property: 'og:site_name', content: 'SkyBox' }])
    head.push(['meta', { property: 'og:image', content: `${siteUrl}/og-image.png` }])
    head.push(['meta', { name: 'twitter:card', content: 'summary_large_image' }])
    head.push(['meta', { name: 'twitter:image', content: `${siteUrl}/og-image.png` }])
    head.push(['meta', { name: 'twitter:title', content: title }])
    head.push(['meta', { name: 'twitter:description', content: description }])
    head.push(['link', { rel: 'canonical', href: pageUrl }])

    return head
  },

  themeConfig: {
    logo: '/skybox-logo-grey.svg',

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
            { text: 'Daily Development', link: '/guide/workflows/daily-development' },
            { text: 'New Project', link: '/guide/workflows/new-project' },
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
      { icon: 'github', link: 'https://github.com/NoorXLabs/SkyBox' },
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
