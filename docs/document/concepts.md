# 概念

## Dev server
使用`vault server -dev`可以在“dev”模式下将Vault作为服务器启动。 此开发模式服务器无需进一步设置，本地的 Vault CLI将通过身份验证与其通信。
这样可以轻松地试验Vault或启动Vault实例进行开发。 Vault的每个功能在“dev”模式下都是可用的。

### Properties
dev服务器的属性（有些可以使用命令行标志或通过指定配置文件来覆盖）：
- **Initialized and unsealed** - dev 服务器会自动初始化和解封。 不需要使用`vault operator unseal`。 它可以立即使用。
- **In-memory storage** - 所有数据都存储（加密）在内存中。 Vault服务器不需要任何文件权限。
- **Bound to local address without TLS** - 服务器侦听`127.0.0.1:8200`（默认服务器地址），没有使用`TLS`。
- **Automatically Authenticated** - 服务器存储你的`root`访问令牌，以便Vault CLI访问准备就绪。 如果通过API访问Vault，则需要使用打印出来的令牌进
行身份验证。
- **Single unseal key** - 使用一个`unseal key`初始化服务器。Vault 已经解封，但如果想尝试密封/解封，则只需要输出一个密钥。

## Seal/Unseal

启动Vault服务器时，它将以密封状态启动。 在此状态下，Vault配置为知道访问物理存储的位置和方式，但不知道如何解密任何物理存储。

解封是构建`master key`（因为`master key`已经被分为 5 片，所以需要提供指定阀值的分片来重组`master key`）的过程，`master key`是读取`decryption key`以解
密数据和访问 Vault 所必需的。

在解封之前，Vault几乎不可能进行任何操作。 例如，身份验证，管理挂载表等都是不可能的。 唯一可能的操作是启动Vault并检查解封的状态。

### 为什么？

Vault 存储的数据以加密方式存储。 Vault需要`encryption key`才能解密数据。 `encryption key`也与数据一起存储，但用另一个称为`master key`的加密密钥加密。
`master key`不存储在任何地方（被分为了 5 个分片）。

因此，要解密数据，Vault必须解密需要`master key`的`encryption key`。 解封是重建此`master key`的过程。

Vault使用称为[Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing)的算法将密钥拆分为分片，而不是将此主密钥作为单
个密钥分发给操作者。 需要一定的分片阈值来重建主密钥。

这是解封过程：一次添加一个分片（以任何顺序），直到存在足够的分片来重建密钥并解密数据。

### 解封

解封通过`vault operator unseal`或 API 完成。 此过程是有状态的：每个密钥都可以通过多台计算机上的多个机制输入，并且可以正常工作。 这允许`master key`的每个分片位于不同
的机器上以提高安全性。

一旦Vault被解封，它将保持解封的状态，直到发生以下两种情况之一：
1. 通过API 重新密封
2. 服务器重启

### 密封

还有一个密封 VAult 的API。 这将丢弃`master key`并需要另一个解封过程来恢复它。 密封只需要一个具有`root`权限的操作员。

这样，如果检测到入侵，可以快速锁定Vault数据以尽量减少损坏。 如果不访问`master key`分片，则无法再次访问它。

### 自动解封

自动解封的开发有助于降低对于保证`master key`安全性的操作的复杂性。此功能将保护`master key`的责任从用户委派给可信设备或服务。 `master key`不是只在内存中构造密钥，
而是使用这些服务或设备之一加密，然后存储在存储后端中，允许Vault在启动时解密`master key`并自动解封。

使用自动解封时，Vault中的某些操作仍需要法定数量的用户才能执行操作，例如生成`root token`。 在初始化过程中，会生成一组称为恢复密钥的Shamir密钥，并用于这些操作。

### Seal Migration
密封可以在Shamir键和自动解封之间迁移。

要从Shamir键迁移到Auto Unseal，请使服务器群集脱机并使用适当的[密封配置]()更新密封配置。当您重新启动服务器时，使用`-migrate`标志运行解封过程。
所有`unseal`命令都必须指定`-migrate`标志。输入所需的密封密钥阈值后，密封密钥将迁移到恢复密钥。
```bash
$ vault operator unseal -migrate
```

要从`Auto Unseal`迁移到Shamir键，请使服务器群集脱机并更新密封配置并将`disabled =“true”`添加到密封块。这允许迁移使用此信息来解密密钥，但不会启动Vault。
当您重新启动服务器时，使用`-migrate`标志运行`unseal`进程并使用`Recovery Keys`执行迁移。所有`unseal`命令都必须指定`-migrate`标志。输入所需的恢复密钥阈值后，
将迁移恢复密钥以用作取消密钥。

## Lease,Renew and Revoke
对于**每个动态 secret 和`service`类型的身份验证令牌，Vault 都会创建租约（Lease）：包含持续时间，可续订性等信息的元数据**。 Vault 承诺数据在给定的持续时间或
生存时间（TTL）内有效。 租约到期后，Vault 可以自动撤销（Revoke）数据，并且 secret 的消费者不再能够确定它是否有效。

好处很明显：secrets 的消费者需要定期检查 Vault 以续订租约（如果允许）或要求更换（Renew）secret。 这使得 Vault 审计日志更有价值，并且使密钥滚动变得更加容易。

Vault中的所有动态 secret 都必须具有租约（Lease）。 即使数据是永久有效的，也需要租约，强制消费者定期检查。

除续期外，还可以撤销租约。 当租约被撤销时，它会立即使该 secret 无效并阻止任何进一步的续订。 例如，使用[AWS secrets 引擎]()，在撤销租约时，将从AWS中删除访问密钥。

撤销可以通过API，通过`vault revoke` cli命令手动进行，也可以由Vault自动进行。 租约到期后，Vault将自动撤销该租约。

### Lease IDs

读取动态 secrets 时，例如通过`vault read`，Vault 总是会返回一个`lease_id`。 这是用于`vault renew`和`vault revoke`等命令管理 secret 的租约。

### Lease Durations and Renewal

除了`lease_id`，还可以读取到租约期限（`lease duration`）。 租约期限是生存时间值：租约有效的时间（以秒为单位）。 消费者必须在这个有效时间内续订这个 secret 的租约。

在续订租约时，用户可以从现在开始请求特定的时间来延长租约。 例如：`vault renew my-lease-id 3600`，请求将`my-lease-id`的租约延长1小时（3600秒）。

对于大多数 secrets ，后端通常会限制续约时间，以确保每隔一段时间更新一次。

### Prefix-based Revocation

除了撤销（Revoke）一个 secret 之外，还可以根据`lease_id`撤销多个 secret。

`lease_id`的结构使其前缀始终是请求 secret 的路径。 这可以让你撤销 secret 树。 例如，要撤消所有AWS访问密钥，您可以执行`vault revoke -prefix aws/`。

这是非常有用的：如果特定系统中存在入侵，可以快速地撤销特定后端或某个已配置后端的所有 secrets。

## Authentication

Vault 的身份验证就是由一个内部或外部的系统来验证用户或者机器提供的信息的过程。 Vault 支持多种[auth methods]()，包括GitHub，LDAP，AppRole等。
每个auth 方法都有一个特定的用例。

在客户端可以与 Vault 交互之前，它必须针对 auth 方法进行身份验证。 在验证时，会生成一个令牌。 此令牌在概念上类似于网站上的`session ID`。 令牌可能具有附加策略，
策略是在认证时映射上去的。

### auth methods

Vault 支持许多 auth 方法。 一些 backends 针对用户，而另一些 backends 针对机器。 大多数身份验证 backends 必须在使用前启用。 要启用身份验证方法：
```bash
$ vault write sys/auth/my-auth type=userpass
```
这会在路径`my-auth`上启用`userpass` auth 方法。在路径`my-auth`上可以使用这个身份验证来访问。 通常，你会在与其名称相同的路径上看到身份验证，但这不是必需的。

要了解有关此身份验证的更多信息，使用内置的`path-help`命令：
```bash
$ vault path-help auth/my-auth
# ...
```
Vault同时支持多种 auth 方法，甚至可以在不同的路径上挂载相同类型的 auth 方法。 必须有一个身份验证才能获得对 Vault 的访问权限，并且目前无法强制用户通过多种
身份验证方法来获取访问权限，尽管某些后端确实支持MFA。

### Tokens

这是一个[关于 Token 的详细页面]()，但重要的是要了解身份验证的工作方式是验证你的身份，然后生成与该身份相关联的令牌。

例如，即使你可以使用 GitHub 之类的东西进行身份验证，Vault 也会生成一个唯一的访问令牌，供你以后使用。 CLI 会自动将此令牌附加到请求，但如果你使用的是API，
则必须手动执行此操作。

这个Token 可以为任何后端进行身份验证，也可以与完整的令牌命令集一起使用，例如创建新的`sub-tokens`，撤消令牌和续订令牌。 这些都包含在[Token concepts page]()。

### Authenticating
#### 使用CLI
要使用CLI进行身份验证，请使用 Vault 登录。这支持许多内置的`auth`方法。 例如，使用 GitHub `auth`方法：
```bash
$ vault login -method=github token=<token>
...
```
身份验证完成后，就会登录，CLI命令还将输出你的原始令牌。此令牌用于撤销和续订。当用户登录时，令牌的主要用例是更新，下面将在“Auth Leases”部分中介绍。

要确定 auth 方法需要哪些变量，请提供`-method`标志，不带任何其他参数，将显示帮助。

#### 使用API

API身份验证通常用于机器的身份验证。 每个 auth 方法都实现自己的登录端点。 使用`vault path-help`机制查找正确的端点。

例如，GitHub登录端点位于`auth/github/login`。 并且为了确定所需的参数，可以使用`vault path-help auth/github/login`。

### Auth Leases

和 secrets 一样，身份也有与之相关的租约（leases）。 这意味着你必须在租约过期后重新进行身份验证才能继续访问Vault。

要设置与身份关联的租约，参考你正在使用的 auth 方法的帮助，可以查看每个后端如何实现租约。

身份也是可以更新的，而不必完全重新认证。只需使用`vault token renew <token>`，这个 Token 是与你的身份相关联的令牌。

## Tokens

Tokens 是 Vault 内部用于验证的核心方法。 Tokens 可以直接使用，或者可以使用 auth 方法基于外部身份动态生成 tokens。

如果你已经阅读了入门指南，可能会注意到`vault server -dev`（或非开发服务器的`vault operator init`）会输出一个初始的`root token`。 这是 Vault 的第一种身份验证方法。
它也是唯一无法禁用的身份验证方法。

如身概念[Authentication]()中所述，**所有外部身份验证机制（如 GitHub）都映射到动态创建的 tokens**。 这些 tokens 具有与普通手动创建的令牌相同的属性。

在Vault中，tokens 映射到信息。 映射到 tokens 的最重要信息是一组一个或多个附加的[策略]()。这些策略控制允许 tokens 持有者在Vault中执行的操作。
其他映射信息包括可以查看并添加到审核日志的元数据，创建时间，上次续订时间等。

### Token Types
### The Token Store
### Root Tokens
### Token Hierarchies and Orphan Tokens
### Token Accessors
### Token Time-To-Live, Periodic Tokens, and Explicit Max TTLs
#### The General Case
#### Explicit Max TTLs
#### Periodic Tokens
### CIDR-Bound Tokens
### Token Types in Detail
#### Service Tokens
#### Batch Tokens
#### Token Type Comparison
#### Service vs. Batch Token Lease Handling
##### Service Tokens
##### Batch Tokens

## Response Wrapping
## Policies
## High Availability
## PGP,GPG and Keybase
