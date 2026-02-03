import { defineConfig } from 'vitepress'
import { commands } from './commands'

export default defineConfig({
  title: 'DevBox',
  description: 'Development environment management CLI',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/devbox-logo-grey.svg' }],
    [
      'script',
      {
        src: 'https://rybbit.jcjmrhjts.uk/api/script.js',
        'data-site-id': '8bedf30d2eff',
        defer: ''
      }
    ],
  ],

  themeConfig: {
    logo: '/devbox-logo-grey.svg',

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'Reference', link: '/reference/', activeMatch: '/reference/' },
      { text: 'Architecture', link: '/architecture/', activeMatch: '/architecture/' },
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
            { text: 'Team Sharing', link: '/guide/workflows/team-sharing' },
          ],
        },
        {
          text: 'Help',
          items: [
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
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
      ],

      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/' },
            { text: 'Codebase Guide', link: '/architecture/codebase' },
            { text: 'Design Decisions', link: '/architecture/design-decisions' },
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
