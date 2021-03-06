# 内部构件

## 架构
Vault 是一个包含和很多组件的复杂系统。这个页面记录了系统架构，为了帮助 Vault 的用户和开发人员在脑中构建一个关于 Vault 如何工作的模型。

### 术语
介绍架构之前，先介绍有关的术语：
- **Storage Backend** - 后端存储负责加密数据的持久存储。这个后端并不受 Vault 的信任，只提供数据持久化的功能。在启动 Vault 服务器时配置后端存储。
- **Barrier** - 屏障是围绕在 Vault 周围的钢筋和混凝土。在 Vault 和存储后端之间通过的所有数据都会经过这个屏障。该屏障确保只写入加密数据，并在进入时验证和解密数据。
就像银行的金库一样，访问里面的任何东西之前，这个屏障必须 "unsealed"。
- **Secrets Engine** - 一个 secrets 引擎负责管理 secrets。像 `kv` secrets 引擎在查询时只是简单的返回相同的 secret 。一些 secrets 引擎支持
使用策略，在每次查询时动态生成一个 secret 。这允许使用唯一的 secret，从而允许 Vault 执行细粒度的撤销和策略更新。例如，MySQL 的 secrets 引擎可以配置一个 "web" 策略。
当读取 "web" secret 时，将生成一对新的 MySQL user/password，并为 web 服务器提供有限的特权。
- **Audit Device** - 审计设备负责管理审计日志。对 Vault 的每个请求和响应都要经过配置的审计设备。这提供了一种将 Vault 与多个不同类型的审计日志记录目的地集成的简单方法。
- **Auth Method** - 使用 `auth` 方法对连接到Vault的用户或应用程序进行身份验证。认证之后，`auth` 方法返回应该应用的应用策略列表。Vault 接受一个经过身份验证的用户，
并返回一个可以用于请求的客户端 `token`。例如，`userpass` `auth` 方法使用用户名和密码对用户进行身份验证。或者，`github` `auth` 方法允许用户通过 github 进行身份验证。
- **Client Token** - 也叫 `Vault token`，在概念上类似于 web 站点上的会话 `cookie`。一旦用户进行了身份验证，Vault 就会返回一个客户端 `token`，用于以后的请求。
Vault 使用 `token` 来验证客户端的身份并执行适用的 ACL 策略。这个标记通过 **HTTP 头**传递。
- **Secret** - secret 是 Vault 返回的任何包含了机密或者加密材料的东西。Vault 返回的内容并不都是 secret，例如系统配置、状态信息或策略都不被认为是 secrets。
secrets 总是有租约的。这意味着客户端不能假定 secrets 内容可以无限期使用。Vault 会撤销 secret 当这个 secret 到期时，也可以在到期前撤销该 secret 。Vault 和
客户端之间的这个合同是至关重要的，因为它允许在不需要人工干预的情况下更改密钥和策略。
- **Server** - Vault 依赖于一个作为服务器运行的长时间运行的实例。Vault 服务器提供了一个 API，客户端可以通过 API 和它交互，并且管理所有 secrets 引擎、ACL 强制执行
和 secret 租约撤销之间的交互。拥有基于服务器的体系结构可以将客户端从安全密钥和策略中分离出来，支持集中审计日志记录，并简化操作管理。

### 高级概述
这是一个高级的概述，像下面这样：

![Architecture](../imgs/layers.png)

让我们开始分解这幅图。**Barrier 内外的组件有明显的分离。只有存储后端和 HTTP API 在外部，所有其他组件都在 Barrier 内**。

存储后端是被不受 Vault 信任的，只是用于持久存储加密数据。当 Vault 服务器启动时，必须为它提供一个存储后端，以便数据在重启时可用。
同样，必须由 Vault 服务器在启动时启动 HTTP API，以便客户端可以与其进行交互。

一旦启动，Vault 就处于密封状态。在 Vault 上执行任何操作之前，必须将其解封。这是通过提供 `unseal keys` 来完成的。当 Vault 初始化时，它会生成一个 `encryption key`，
用于保护所有数据。 该密钥由 `master key` 保护。默认情况下，Vault 使用一种被称为 [Shamir's secret sharing algorithm](https://en.wikipedia.org/wiki/Shamir's_Secret_Sharing)
 的技术，将主密钥分成 5 个共享 key，重构主密钥需要任意 3 个共享 key。

![Shamir](../imgs/vault-shamir-secret-sharing.svg)

份额数和所需的最小阈值都可以指定。 Shamir 的技术可以被禁用，主密钥可以直接用于开封。一旦 Vault 检索到加密密钥，它就能够解密存储后端中的数据，并进入解封状态。
一旦启封，Vault 将加载所有已配置的审计设备，auth 方法和 secrets 引擎。

这些审计设备，auth 方法和 secrets 引擎的配置必须存储在 Vault 中，因为它们对安全性敏感。只有具有正确权限的用户才能修改它们，这意味着无法在屏障之外指定它们。
通过将它们存储在 Vault 中，对它们的任何更改都受 ACL 系统保护并由审计日志跟踪。

在解封 Vault 之后，请求处理会从 HTTP API 到 Core。 Core 用于管理通过系统的请求流，强制执行 ACL，并确保完成审计日志记录。

当客户端首次连接到 Vault 时，需要进行身份验证。 Vault 提供可配置的 auth 方法，提供了灵活的身份验证机制。人机友好机制（如用户名/密码或 GitHub）可能会用于运营商，而
应用程序可能会使用公钥/私钥或令牌进行身份验证。身份验证请求流通过 core 进入 auth 方法，该方法确定请求是否有效并返回关联策略列表。

策略只是一个命名的 ACL 规则。 例如，`root` 策略是内置的，允许访问所有资源。你可以创建任意数量的命名策略，并对路径进行细粒度控制。 Vault 仅以**白名单模式**运行，
这意味着必须通过策略明确授予访问权限，否则不允许执行此操作。由于用户可能有多个相关联的策略，因此如果有任意策略允许，则允许操作。策略由内部策略存储库存储和管理。
此内部存储通过系统后端进行操作，后端始终安装在 `sys/`。

一旦身份验证发生并且 auth 方法提供了一组适用的策略，就会由令牌存储生成并管理新的客户端令牌。此客户端令牌将发送回客户端，用于生成将来的请求。这类似于用户登录后
网站发送的 `cookie`。客户端令牌可能具有与之关联的租约，具体取决于 auth 方法配置。 这意味着可能需要定期更新客户端令牌以避免失效。

经过身份验证后，请求提供客户端令牌 令牌用于验证客户端是否已获得授权并加载相关策略。 策略用于授权客户端请求。 然后将请求路由到 secrets 引擎，该引擎根据其类型进行处理。
如果 secrets 引擎返回 secret，则 Core 将其与到期管理器一起注册并附加一个租约 ID。 客户端使用租约 ID 来续订或撤销其 secret。 如果客户端允许租约到期，则到期管理器会
自动撤销该 secret。

Core 处理对审计代理的请求和响应的日志记录，该请求将请求传播到所有已配置的审计设备。在请求流之外，Core 执行某些后台活动。 租赁管理至关重要，因为它允许自动撤销过期的客户
端令牌或 secrets。此外，Vault 通过使用回滚管理器使用预写日志记录来处理某些部分故障情况。这在 Core 内透明地管理，用户不可见。