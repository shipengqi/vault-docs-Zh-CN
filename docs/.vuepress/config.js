module.exports = {
  base: '/vault-docs-Zh-CN/',
  title: 'Vault 中文文档',
  description: '欢迎来到 HashiCorp Vault 介绍指南!本指南是开始使用 Vault 的最佳地点。本指南涵盖了Vault 是什么，它可以解决什么问题，它如何与现有软件进行比较，\n' +
  '并包含了使用 Vault 的快速入门。',
  head: [
    ['link', {
      rel: 'icon',
      href: '/logo.png'
    }]
  ],
  markdown: {
    toc: {
      includeLevel: [2, 3, 4, 5, 6]
    }
  },
  themeConfig: {
    repo: 'shipengqi/vault-docs-Zh-CN',
    docsDir: 'docs',
    editLinks: true,
    editLinkText: '错别字纠正',
    sidebarDepth: 3,
    nav: [{
      text: '入门指南',
      link: '/guide/',
    },{
      text: '文档',
      link: '/document/',
    },{
      text: 'API',
      link: '/api/',
    }],
    sidebar: {
      '/guide/': [{
        title: '入门指南',
        children: [
          ''
        ]
      }],
      '/document/': [{
        title: '文档（持续更新中...）',
        children: [
          '',
          'installing',
          'internals',
          'concepts',
          'configuration',
          'cli',
          'vault-agent',
          'secrets-engines',
          'auth-methods'
        ]
      }],
      '/api/': [{
        title: 'API',
        children: [
          ''
        ]
      }]
    }
  }
};
