# 内部构件

## 架构
Vault 是一个包含和很多组件的复杂系统。这个页面记录了系统架构，为了帮助 Vault 的用户和开发人员在心中构建一个关于 Vault 如何工作的模型。

### 术语
介绍架构之前，先介绍有关的术语：
- **Storage Backend** - 后端存储负责加密数据的持久存储。这个后端并不受 Vault 的信任，只提供数据持久化的功能。在启动 Vault 服务器时配置后端存储。
- **Barrier** - 屏障是围绕在Vault 周围的密码写的钢筋和混凝土。在 Vault 和 存储后端之间通过的所有数据都会经过这个屏障。该屏障确保只写入加密数据，并在进入时验证和解密数据。
就像银行的金库一样，访问里面的任何东西之前，这个屏障必须“打开”。
- **Secrets Engine** - 一个 secrets 引擎负责管理 secrets。像`kv` secrets 引擎在查询时只是简单的返回相同的 secret 。一些 secrets 引擎支持
使用策略，在每次查询时动态生成一个 secret 。这允许使用唯一的 secret，从而允许 Vault 执行细粒度的撤销和策略更新。例如，MySQL 的 secrets 引擎可以配置一个“web”策略。
当读取“web” secret 时，将生成一对新的 MySQL user/password，并为 web 服务器提供有限的特权。
- **Audit Device** - 审计设备负责管理审计日志。对 Vault 的每个请求和响应都要经过配置的审计设备。这提供了一种将 Vault 与不同类型的多个审计日志记录目的地集成的简单方法。
- **Auth Method** - 使用`auth`方法对连接到Vault的用户或应用程序进行身份验证。认证之后，`auth`方法返回应该应用的应用策略列表。Vault接受一个经过身份验证的用户，
并返回一个可以用于请求的客户端`token`。例如，`userpass` `auth`方法使用用户名和密码对用户进行身份验证。或者，`github` `auth`方法允许用户通过 github进行身份验证。
- **Client Token** - 也叫`Vault token`，在概念上类似于 web 站点上的会话`cookie`。一旦用户进行了身份验证，Vault 就会返回一个客户端`token`，用于以后的请求。
Vault 使用`token`来验证客户端的身份并执行适用的 ACL 策略。这个标记通过 **HTTP 头**传递。
- **Secret** - secret 是 Vault 返回的任何包含了机密或者加密材料的东西。Vault 返回的内容并不都是 secret，例如系统配置、状态信息或策略都不被认为是 secrets。
secrets 总是有租约的。这意味着客户端不能假定 secrets 内容可以无限期使用。Vault 会撤销 secret 当这个 secret 到期时，也可以在到期前撤销该 secret 。Vault 和
客户端之间的这个合同是至关重要的，因为它允许在不需要人工干预的情况下更改密钥和策略。
- **Server** - Vault依 赖于一个作为服务器运行的长时间运行的实例。Vault 服务器提供了一个API，客户端可以通过API和它交互，并且管理所有 secrets 引擎、ACL 强制执行
和 secret 租约撤销之间的交互。拥有基于服务器的体系结构可以将客户端从安全密钥和策略中分离出来，支持集中审计日志记录，并简化操作管理。

### 高级概述
这是一个高级的概述，像下面这样：

![Architecture](imgs/layers.png)

让我们开始分解这幅图。Barrier 内外的组件有明显的分离。只有存储后端和 HTTP API 在外部，所有其他组件都在 Barrier 内。

存储后端是被不受 Vault 信任的，只是用于持久存储加密数据。当 Vault 服务器启动时，必须为它提供一个存储后端，以便数据在重启时可用。
同样，必须由Vault服务器在启动时启动HTTP API，以便客户端可以与其进行交互。

一旦启动，Vault 就处于密封状态。 在 Vault 上执行任何操作之前，必须将其解封。这是通过提供`unseal keys`来完成的。当Vault初始化时，它会生成一个`encryption key`，
用于保护所有数据。 该密钥由`master key`保护。默认情况下，Vault使用一种被称为[Shamir's secret sharing algorithm](https://en.wikipedia.org/wiki/Shamir's_Secret_Sharing)
的技术，将主密钥分成 5 个共享，重构主密钥需要任意 3 个共享。

![Architecture](imgs/vault-shamir-secret-sharing.svg)