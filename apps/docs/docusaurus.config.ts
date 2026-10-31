import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const repository = 'https://github.com/exzos28/react-native-audio-analyzer';

const config: Config = {
  title: 'react-native-audio-analyzer',
  tagline:
    'Waveforms and audio levels for React Native. Decode once, natively — draw at any size, zoom and style instantly.',
  favicon: 'img/favicon.svg',

  url: 'https://exzos28.github.io',
  baseUrl: '/react-native-audio-analyzer/',
  organizationName: 'exzos28',
  projectName: 'react-native-audio-analyzer',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
      onBrokenMarkdownImages: 'throw',
    },
  },

  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: `${repository}/edit/main/apps/docs/`,
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      // API reference generated from the library's TSDoc comments.
      'docusaurus-plugin-typedoc',
      {
        entryPoints: [
          '../../packages/react-native-audio-analyzer/src/index.ts',
        ],
        tsconfig: '../../packages/react-native-audio-analyzer/tsconfig.json',
        out: './docs/api',
        readme: 'none',
        excludePrivate: true,
        excludeInternal: true,
        parametersFormat: 'table',
        useCodeBlocks: true,
        sidebar: { pretty: true },
      },
    ],
  ],

  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: 'Audio Analyzer',
      logo: { alt: 'Waveform logo', src: 'img/logo.svg' },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        { to: '/docs/examples', label: 'Examples', position: 'left' },
        { to: '/docs/api', label: 'API', position: 'left' },
        {
          href: 'https://www.npmjs.com/package/react-native-audio-analyzer',
          label: 'npm',
          position: 'right',
        },
        { href: repository, label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting started', to: '/docs/intro' },
            { label: 'Guides', to: '/docs/guides/chat-bubbles' },
            { label: 'API reference', to: '/docs/api' },
          ],
        },
        {
          title: 'Project',
          items: [
            { label: 'GitHub', href: repository },
            { label: 'Issues', href: `${repository}/issues` },
            {
              label: 'Changelog',
              href: `${repository}/blob/main/packages/react-native-audio-analyzer/CHANGELOG.md`,
            },
          ],
        },
      ],
      copyright: `MIT © exzos. Audio decoding by <a href="https://miniaud.io">miniaudio</a>.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
