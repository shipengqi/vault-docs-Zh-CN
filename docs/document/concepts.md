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
## Authentication
## Tokens
## Response Wrapping
## Policies
## High Availability
## PGP,GPG and Keybase