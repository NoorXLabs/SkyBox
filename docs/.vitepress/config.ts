import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'DevBox',
  description: 'Development environment management CLI',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/devbox-logo-grey.svg' }],
    [
      'script',
      {
        src: 'https://rybbit.jcjmrhjts.uk/api/script.js',
        'data-site-id': '554e65b88847',
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
      ],

      '/reference/': [
        {
          text: 'Commands',
          items: [
            { text: 'Overview', link: '/reference/' },
            { text: 'devbox init', link: '/reference/init' },
            { text: 'devbox up', link: '/reference/up' },
            { text: 'devbox down', link: '/reference/down' },
            { text: 'devbox clone', link: '/reference/clone' },
            { text: 'devbox push', link: '/reference/push' },
            { text: 'devbox browse', link: '/reference/browse' },
            { text: 'devbox list', link: '/reference/list' },
            { text: 'devbox status', link: '/reference/status' },
            { text: 'devbox editor', link: '/reference/editor' },
            { text: 'devbox rm', link: '/reference/rm' },
            { text: 'Configuration', link: '/reference/configuration' },
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
      { icon: 'github', link: 'https://github.com/noorchasib/DevBox' },
    ],

    footer: {
      message: 'Released under the Apache License 2.0.',
      copyright: `© ${new Date().getFullYear()} Noor Chasib`,
    },

    search: {
      provider: 'local',
    },
  },
})
