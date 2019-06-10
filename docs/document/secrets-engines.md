# Secrets 引擎
## Overview
Secrets 引擎是存储、生成或加密数据的组件。Secrets 引擎是非常灵活的，所以从它们的功能而言是很容易理解的。Secrets 引擎提供了一些数据集，它们对这些数据
执行一些操作，然后返回一个结果。

一些 Secrets 引擎只是简单地存储和读取数据——比如加密的 Redis/Memcached 。其他 Secrets 引擎连接到其他服务，并根据需要生成动态凭据。其他 Secrets 引擎
提供加密服务、totp 生成、证书等等。

Secrets 引擎在 Vault 中的一个 `path` 上启用。当一个请求到达 Vault 时，路由器自动将带有路由前缀的任何东西路由到 secret 引擎。通过这种方式，
每个 secret 引擎都定义了自己的路径和属性。对于用户来说，secret 引擎的行为类似于虚拟文件系统，支持读、写和删除等操作。

### Secrets Engines Lifecycle

大多数 Secrets 引擎都可以通过 CLI 或 API 启用、禁用、调优和移动。Vault 以前的版本将这些称为 "mount"，但是这个术语已经被覆盖了。

- `Enable` - 这将在给定的路径上启用 secret 引擎。除了少数例外，secrets 引擎可以在多个路径上启用。每个 secret 引擎都与它的路径隔离。默认情况下，
它们在与 `type` 相同的路径上是启用的(例如。`aws` 默认启用于 `aws/` 上)。
- `Disable` - 这将禁用现有的 secrets 引擎。当一个 secrets 引擎被禁用时，它的所有 secrets 都会被撤销(如果它们支持的话)，并且在物理存储层中为该引
擎存储的所有数据都会被删除。
- `Move` - 这将移动现有的 secrets 引擎的 path。这个过程撤销所有 secrets ，因为 secrets 租约与创建它们的 path 绑定在一起。为引擎存储的配置数据
在移动过程中保持不变。
- `Tune` - 这将调整 Secrets 引擎(如 TTLs )的全局配置。

一旦一个 secret 引擎被启用，就可以根据它自己的 API 在它的路径上直接与它交互。使用 `vault path -help` 确定它响应的路径。

注意，Vault 中的挂载点不能相互冲突。这个事实有两个广泛的含义。首先，你不能有一个以已存在的挂载为前缀的挂载。第二，你不能创建一个名为已存在的挂载前缀的挂载点。
例如，挂载 `foo/bar` 和 `foo/baz` 可以和平共处，而 `foo` 和 `foo/baz` 则不能

### Barrier View
secret 引擎接受一个 `barrier view` 已配置的 vault 物理存储。这很像 [chroot](https://en.wikipedia.org/wiki/Chroot)。

当启用 secret 引擎时，将生成一个随机 UUID。这将成为该引擎的数据根。每当该引擎写入物理存储层时，它都以该 UUID 文件夹作为前缀。
由于 Vault 存储层不支持相对访问(例如 `../`)，这使得启用的 secret 引擎不可能访问其他数据。

这是 Vault 中一个重要的安全特性 —— 即使一个恶意的引擎也不能访问任何其他引擎的数据。

## KV Secrets Engine
### Overview
`kv` Secrets 引擎用于存储任意的 secrets 到 Vault 配置的物理存储中。此后端可以以两种模式之一运行。它可以是一个通用的 `Key-Value` 存储，存储健值对。
可以启用版本控制，并为每个 key 存储可配置的版本号。

#### KV Version 1
当运行 `kv` secret backend 无版本控制时，仅保留 key 的最近写入值。无版本 `kv` 的好处是减少了每个 key 的存储大小，因为不存储额外的元数据或历史记录。
此外，通过这种方式配置到后端的请求将具有更高的性能，因为对于任何给定的请求，将有更少的存储调用，并且没有锁定。

有关在这种模式下运行的更多信息可以在 [K/V Version 1 Docs]() 中找到。

#### KV Version 2
当运行 v2 版本的 `kv` 后端时，key 可以保留一定数量可配置的版本。默认为 10 个版本。可以检索旧版本的元数据和数据。此外，可以使用 `Check-and-Set` 操作来避免无意中覆盖数据。

当一个版本被删除时，底层数据并没有被删除，而是被标记为已删除。已删除的版本可以取消删除。要永久删除版本的数据，可以使用 destroy 命令或 API 端点。
此外，可以通过删除 metadata 命令或 API 端点删除 key 的所有版本和元数据。每个操作都可以采用不同的 ACL'ed，从而限制谁具有软删除、取消删除或完全删除数据的权限。

有关在这种模式下运行的更多信息可以在 [K/V Version 2 Docs]() 中找到。

### KV Secrets Engine - Version 1
`kv` Secrets 引擎用于存储任意的 secrets 到 Vault 配置的物理存储中。

写入一个 key 到 `kv` 后端会替换旧值;子字段不会合并在一起。

key 名必须始终是字符串。如果直接通过 CLI 编写非字符串值，它们将被转换成字符串。

但是，可以通过编写保存非字符串值的 key/value 对的 JSON 文件传递给 Vault，或使用 HTTP API 进行调用。

这个 secret 引擎支持 ACL 策略中的 `create` 和 `update` 功能之间的区别。

> Path 和 key 名是不会被加密的，只有 key 的值会被加密。不应该将敏感信息存储在 secret 的 path 中。

#### Setup
启用一个版本为 1 的 `kv` 存储：
```sh
vault secrets enable -version=1 kv
```

#### Usage
在配置了 secret 引擎并且 用户/机器 具有具有适当权限的 Vault 令牌之后，它可以生成凭证。`kv` secret 引擎允许写入任意的健值对。

1. 写入任意数据：
```sh
$ vault kv put kv/my-secret my-value=s3cr3t
Success! Data written to: kv/my-secret
```

2. 读取任意数据：
```sh
$ vault kv get kv/my-secret
Key                 Value
---                 -----
my-value            s3cr3t
```

3. 列出所有的 keys：
```sh
$ vault kv list kv/
Keys
----
my-secret
```

4. 删除一个 key：
```sh
$ vault kv delete kv/my-secret
Success! Data deleted (if it existed) at: kv/my-secret
```

#### TTLs
和其他 secret 引擎不同， `kv` secret 引擎不强制 TTLs 过期。相反，`lease_duration` 只是为了提示使用者应该多久检查一次新值。

若一个 key 提供了 `ttl`，KV secret 引擎将以此值作为租期:
```sh
$ vault kv put kv/my-secret ttl=30m my-value=s3cr3t
Success! Data written to: kv/my-secret
```
即使设置了 `ttl`，secret 引擎也不会自己删除数据。`ttl` 的关键仅仅是建议。

当读取一个带有 `ttl` 的值时，`ttl` 键和刷新间隔都会显示:
```sh
$ vault kv get kv/my-secret
Key                 Value
---                 -----
my-value            s3cr3t
ttl                 30m
```

### KV Secrets Engine - Version 2
#### Setup
一个 v2 版本的 secret 引擎可以使用下面的命令启用：
```sh
$ vault secrets enable -version=2 kv
```
或者，你可以通过 `kv-v2` 作为 secret 引擎类型:
```sh
$ vault secrets enable kv-v2
```

此外，当运行一个 dev-mode 服务器时，默认情况下在路径 `secret/` 上启用了v2 kv secret 引擎(对于非开发服务器，当前为 v1)。可以在不同的路径上多次禁用、移动或启用它。
KV secret 引擎的每个实例都是独立且唯一的。

#### Upgrading from Version 1
现有版本 1 的 `kv` 存储可以通过 CLI 或 API 升级到版本 2，如下所示。这将启动一个升级过程，将现有的 key/value 数据升级为版本化的格式。在此过程中，
挂载将不可访问。这个过程可能需要很长时间，所以要相应地计划。

一旦升级到版本 2，以前数据可访问的路径不可以再满足。你需要调整用户策略，以添加对 version 2 路径的访问，详细介绍 [the ACL Rules section]()。
同样，一旦 kv 数据升级到版本 2，用户/应用程序 将需要更新与 kv 数据交互的路径。

现有版本 1 的 `kv` 存储可以通过 CLI 升级到版本 2:
```sh
$ vault kv enable-versioning secret/
Success! Tuned the secrets engine at: secret/
```
或者通过 API：
```sh
$ cat payload.json
{
  "options": {
      "version": "2"
  }
}

$ curl \
    --header "X-Vault-Token: ..." \
    --request POST \
    --data @payload.json \
    http://127.0.0.1:8200/v1/sys/mounts/secret/tune
```

#### ACL Rules
版本 2 kv 存储使用前缀 API，这与版本 1 API不同。在从版本 1 kv 升级之前，应该更改 ACL 规则。此外，版本 2 API 中的不同路径可以采用不同的 ACL'ed。

写入和读取版本的前缀是 `data/` 的路径。适用于 1 kv 版本的策略:
```
path "secret/dev/team-1/*" {
  capabilities = ["create", "update", "read"]
}
```

需要改为：
```
path "secret/data/dev/team-1/*" {
  capabilities = ["create", "update", "read"]
}
```
这个后端有不同级别的数据删除。若要授予策略删除 key 最新版本的权限，请:
```
path "secret/data/dev/team-1/*" {
  capabilities = ["delete"]
}
```

允许策略删除任何版本的 key:
```
path "secret/delete/dev/team-1/*" {
  capabilities = ["update"]
}
```

允许策略取消删除数据:
```
path "secret/undelete/dev/team-1/*" {
  capabilities = ["update"]
}
```

允许策略销毁版本:
```
path "secret/destroy/dev/team-1/*" {
  capabilities = ["update"]
}
```
允许策略列出所有的 key:
```
path "secret/metadata/dev/team-1/*" {
  capabilities = ["list"]
}
```
允许策略读取每个版本的元数据:
```
path "secret/metadata/dev/team-1/*" {
  capabilities = ["read"]
}
```
允许策略永久删除 key 的所有版本和元数据:
```
path "secret/metadata/dev/team-1/*" {
  capabilities = ["delete"]
}
```

#### Usage
##### Writing/Reading arbitrary data
1. 写入任意数据：
```sh
$ vault kv put secret/my-secret my-value=s3cr3t
Key              Value
---              -----
created_time     2018-03-30T22:11:48.589157362Z
deletion_time    n/a
destroyed        false
version          1
```

2. 读取任意数据：
```sh
$ vault kv get secret/my-secret
====== Metadata ======
Key              Value
---              -----
created_time     2018-03-30T22:11:48.589157362Z
deletion_time    n/a
destroyed        false
version          1

====== Data ======
Key         Value
---         -----
my-value    s3cr3t
```

3. 写入另一个版本，仍然可以访问以前的版本。可以选择传递 `-cas` 标志来执行 `check-and-set` 操作。如果没有设置，那么写操作是允许的。如果设置 `-cas=0`，则仅在 key 不存在的情况下才
允许写入。如果索引非零，则仅当 key 的当前版本与 `cas` 参数中指定的版本匹配时才允许写入。
```sh
$ vault kv put -cas=1 secret/my-secret my-value=new-s3cr3t
Key              Value
---              -----
created_time     2018-03-30T22:18:37.124228658Z
deletion_time    n/a
destroyed        false
version          2
```

4. 现在读取将返回最新版本的数据:
```sh
$ vault kv get secret/my-secret
====== Metadata ======
Key              Value
---              -----
created_time     2018-03-30T22:18:37.124228658Z
deletion_time    n/a
destroyed        false
version          2

====== Data ======
Key         Value
---         -----
my-value    new-s3cr3t
```

5. 之前的版本可以通过 `-version` 标志来访问：
```sh
$ vault kv get -version=1 secret/my-secret
====== Metadata ======
Key              Value
---              -----
created_time     2018-03-30T22:16:39.808909557Z
deletion_time    n/a
destroyed        false
version          1

====== Data ======
Key         Value
---         -----
my-value    s3cr3t
```

##### Deleting and Destroying Data
当执行标准命令 `vault kv delete` 删除数据时会执行**软删除**。它将把版本标记为已删除，并填充一个 `deletion_time` 时间戳。
软删除不会从底层存储删除版本数据，这样的话，允许撤销删除版本。命令 `vault kv undelete` 是用来处理版本的撤销删除。当使用 destroy 命令时，底层的版本数据将被删除，
key 元数据将被标记为已销毁。

只有当 key 的版本数超过 `max-versions` 设置所允许的版本数时，或者当使用 `vault kv destroy` 时，版本的数据才会被永久删除。
如果超过了 `max-versions` 而清除了某个版本，那么版本元数据也将从 key 中删除。

有关更多信息，参阅下面的命令:
1. 一个 key 的最新版本可以用 delete 命令删除，删除之前的版本需要 `-versions` 标志:
```sh
$ vault kv delete secret/my-secret
Success! Data deleted (if it existed) at: secret/my-secret
```

2. 撤销删除版本：
```sh
$ vault kv undelete -versions=2 secret/my-secret
Success! Data written to: secret/undelete/my-secret

$ vault kv get secret/my-secret
====== Metadata ======
Key              Value
---              -----
created_time     2018-03-30T22:18:37.124228658Z
deletion_time    n/a
destroyed        false
version          2

====== Data ======
Key         Value
---         -----
my-value    new-s3cr3t
```

3. 销毁一个版本永久删除底层数据:
```sh
$ vault kv destroy -versions=2 secret/my-secret
Success! Data written to: secret/destroy/my-secret
```

##### Key Metadata
可以使用 metadata 命令 & API跟 踪所有版本和 key 元数据。删除元数据 key 将导致永久删除该 key 的所有元数据和版本。

有关更多信息，参阅下面的命令:
1. key 的所有元数据和版本都可以查看:
```sh
$ vault kv metadata get secret/my-secret
======= Metadata =======
Key                Value
---                -----
created_time       2018-03-30T22:16:39.808909557Z
current_version    2
max_versions       0
oldest_version     0
updated_time       2018-03-30T22:18:37.124228658Z

====== Version 1 ======
Key              Value
---              -----
created_time     2018-03-30T22:16:39.808909557Z
deletion_time    n/a
destroyed        false

====== Version 2 ======
Key              Value
---              -----
created_time     2018-03-30T22:18:37.124228658Z
deletion_time    n/a
destroyed        true
```

2. key 的元数据设置可以配置:
```sh
$ vault kv metadata put -max-versions 1 secret/my-secret
Success! Data written to: secret/metadata/my-secret
```

最大版本的变化适用于下一个写操作:
```sh
$ vault kv put secret/my-secret my-value=newer-s3cr3t
Key              Value
---              -----
created_time     2018-03-30T22:41:09.193643571Z
deletion_time    n/a
destroyed        false
version          3
```

一旦一个 key 的版本数量超过最大版本数，最老的版本就会被清除:
```sh
$ vault kv metadata get secret/my-secret
======= Metadata =======
Key                Value
---                -----
created_time       2018-03-30T22:16:39.808909557Z
current_version    3
max_versions       1
oldest_version     3
updated_time       2018-03-30T22:41:09.193643571Z

====== Version 3 ======
Key              Value
---              -----
created_time     2018-03-30T22:41:09.193643571Z
deletion_time    n/a
destroyed        false
```

3. 永久删除一个 key 的所有元数据和版本:
```sh
$ vault kv metadata delete secret/my-secret
Success! Data deleted (if it existed) at: secret/metadata/my-secret
```

## PKI Secrets Engine
PKI secrets 引擎生成动态 `X.509` 证书。使用这个 secrets 引擎，服务可以获得证书，而不需要手动生成私钥和 CSR，提交到 CA，并等待验证和签名完成。
Vault 的内置身份验证和授权机制提供了验证功能。

通过保持相对较短的 TTL，不太可能需要撤销操作，保持 CRL 简短并帮助 secrets 引擎扩展到大型工作负载。 反过来就允许每个正在运行的应用程序实例都具有唯一的证书，
从而消除了共享以及随之而来的撤销和反复的痛苦。

此外，允许撤销操作主要是放弃证书，这个 secrets 引擎允许短暂的证书。应用程序启动时可以获取证书并将其存储在内存中，并在关闭时丢弃，而不必写入磁盘。

### Setup

大多数 secrets 引擎必须事先配置才能执行其功能。 这些步骤通常由操作员或配置管理工具完成。

1. 启用 PKI secrets 引擎：
```bash
$ vault secrets enable pki
Success! Enabled the pki secrets engine at: pki/
```
**默认情况下，secrets 引擎将安装在引擎名称同名的路径上**。要在不同路径上启用 secrets 引擎，使用 `-path` 参数。

2. 调整 secrets 引擎，增加 TTL。 默认值 30 天可能太短，因此将其增加到 1 年：
```bash
$ vault secrets tune -max-lease-ttl=8760h pki
Success! Tuned the secrets engine at: pki/
```

注意，这只是配置这个 secrets 引擎的全局的最大值。每个角色可以把每个证书的 TTL 限制为更短。

3. 配置 CA 证书和私钥。 Vault 可以接受现有密钥对，也可以生成自己的自签名根。通常，我们建议将**根 CA **保留在 Vault 之外，并为 Vault 提供签名的中间 CA。
```bash
$ vault write pki/root/generate/internal \
    common_name=my-website.com \
    ttl=8760h

Key              Value
---              -----
certificate      -----BEGIN CERTIFICATE-----...
expiration       1536807433
issuing_ca       -----BEGIN CERTIFICATE-----...
serial_number    7c:f1:fb:2c:6e:4d:99:0e:82:1b:08:0a:81:ed:61:3e:1d:fa:f5:29
```

返回的证书纯粹是提供信息。 私钥安全地存储在 Vault 内部。

4. 更新 CRL 位置并颁发证书。 这些值可以在以后更新。
```bash
$ vault write pki/config/urls \
    issuing_certificates="http://127.0.0.1:8200/v1/pki/ca" \
    crl_distribution_points="http://127.0.0.1:8200/v1/pki/crl"
Success! Data written to: pki/config/urls
```

5. 配置一个 `role`，在 Vault 中的映射一个名字到生成证书的过程中。 当用户或计算机生成凭据时，将根据此角色生成凭据：
```bash
$ vault write pki/roles/my-role \
    allowed_domains=my-website.com \
    allow_subdomains=true \
    max_ttl=72h
Success! Data written to: pki/roles/my-role
```

### Usage

配置好 secrets 引擎并且用户或者计算机有了一个一定权限的 `Vault token`，就可以生成凭据。

1. 通过写入 `/issue` 端点，并带上 `role name`，来生成新凭据：
```bash
$ vault write pki/issue/my-role \
    common_name=www.my-website.com

Key                 Value
---                 -----
certificate         -----BEGIN CERTIFICATE-----...
issuing_ca          -----BEGIN CERTIFICATE-----...
private_key         -----BEGIN RSA PRIVATE KEY-----...
private_key_type    rsa
serial_number       1d:2e:c6:06:45:18:60:0e:23:d6:c5:17:43:c0:fe:46:ed:d1:50:be
```

输出中会包含一个动态生成的私钥和证书，它对应了给定的 `role`，并在 72h 到期（由我们的 `role` 定义决定）。为了简化自动化，还会返回 `issuing_ca` 和信任链。

### Considerations

要成功部署这个 secrets 引擎，需要考虑到一些重要的因素，以及应该采取的一些准备步骤。 在使用这个 secrets 引擎或生成 CA 以使用此 secrets 引擎之前，应该阅读所有这些内容。

#### Be Careful with Root CAs

Vault 存储是安全的，但不如银行保险库中的纸张安全。毕竟，这是网络软件。**如果你的 `根 CA` 托管在 Vault 之外，请不要将其放在 Vault 中;相反，发出一个寿命较短的中间 CA 证书并将
其放入 Vault。这符合行业最佳实践**。

从 0.4 开始，secrets 引擎支持生成自签名 `根 CA` 以及为 `中间 CA` 创建和签署 CSR。在每个实例中，出于安全原因，私钥只能在生成时导出，并且执行此操作的能力是命令路径的
一部分（因此可以将其放入 ACL 策略中）。

如果你计划将 `中间 CA` 与 Vault 一起使用，建议让 Vault 创建 CSR 并且不导出私钥，然后使用 `根CA`（可能是 pki secrets 引擎的第二个挂载）对其进行签名。

#### One CA Certificate, One Secrets Engine

为了简化 PKI secrets 引擎的配置和代码库，每个 secrets 引擎只允许一个 CA 证书。 如果要从多个 CA 颁发证书，将 PKI secrets 引擎安装在多个安装点，每个安装点都
有单独的 CA 证书。

这也提供了一种切换到新 CA 证书的便捷方法，同时保持 CRL 对旧 CA 证书有效; 只需安装一个新的 secrets 引擎并从那里发出。

常见模式是将一个安装程序用作 `根 CA`，并仅使用此 CA 从其他 PKI secrets 引擎签署中间 CA CSR。

#### Keep certificate lifetimes short, for CRL's sake
这个 secrets 引擎与 Vault 短暂的 secrets 理念保持一致。 因此，预计 CRL 不会增长; 唯一返回私钥的地方是请求客户端（此 secrets 引擎不存储生成的私钥，CA 证书除外）。
在大多数情况下，如果密钥丢失，则可以简单地忽略证书，因为它很快就会过期。

如果必须撤销证书，则可以使用正常的 Vault 撤销功能; 或者，可以使用根令牌来使用证书的序列号撤销证书。任何撤销操作都将导致重新生成 CRL。重新生成 CRL 时，将从 CRL 中删除所
有过期的证书（并且从 secrets 引擎存储中删除任何已撤销的过期证书）。

这个 secrets 引擎不支持具有滑动日期窗口的多个 CRL 端点; 通常这样的机制将具有相隔几天的转换点，但是这进入了从这个 secrets 引擎发出的实际证书有效期的预期范围。
这个 secrets 引擎的一个好的经验法则是不发布有效期大于最大舒适 CRL 生命周期的证书。 或者，可以控制客户端上的CRL缓存行为，以确保更频繁地进行检查。

通常在单个 CRL 端点关闭时使用多个端点，以便客户端不必弄清楚如何处理缺少响应。 在 HA 模式下运行 Vault，即使特定节点关闭，CRL 端点也应可用。

#### You must configure issuing/CRL/OCSP information in advance
这个 secrets 引擎从可预测的位置提供 CRL，但 secrets 引擎不可能知道它在哪里运行。因此，必须使用 `config/urls` 端点手动为颁发证书，CRL 分发点和 OCSP 服务器配置所需的 URL。
通过将多个URL作为逗号分隔的字符串参数传递，支持它们中的每一个都有多个。

#### Safe Minimums
自成立以来，这个秘密引擎已经强制使用 SHA256 签名哈希而不是 SHA1。 从 0.5.1 开始，RSA 密钥的最小值为 2048 位。 可以处理 SHA256 签名的软件也应该能够处理 2048 位密钥，
并且 1024 位密钥被认为是不安全的，并且在 Internet PKI 中是不允许的。

#### Token Lifetimes and Revocation
当令牌到期时，它会撤销与之关联的所有租约。 这意味着长期使用的 CA 证书需要相应的长期令牌，这很容易被遗忘。 从 0.6 开始，`根 CA` 和 `中间 CA` 证书不再具有关联租约，
以防止在不使用具有足够长寿命的令牌时意外撤销。要撤消这些证书，使用 `pki/revoke` 端点。

### Quick Start

#### Mount the backend

使用 `pki` 后端的第一步是挂载它。 与 `kv` 后端不同，默认情况下不会安装 `pki` 后端。
```bash
$ vault secrets enable pki
Successfully mounted 'pki' at 'pki'!
```

#### Configure a CA certificate

下一步，必须使用 CA 证书和关联的私钥配置 Vault。 我们将利用后端的自签名根生成支持，但 Vault 还支持生成 `中间 CA`（使用CSR进行签名）或将 PEM 编码的证书和私钥包直接设
置到后端。

通常，希望根证书仅用于签署 CA 中间证书，但是对于此示例，我们将继续执行，将直接从根颁发证书。 因为它是根，我们要为证书设置一个很长的最大生命周期; 首先调整：
```bash
$ vault secrets tune -max-lease-ttl=87600h pki
Successfully tuned mount 'pki'!
```
这里设置 secrets 的从挂载发出后的最大 TTL 为 10 年。 （请注意，`role` 可以进一步限制最大 TTL。）

现在，生成根证书：
```bash
$ vault write pki/root/generate/internal common_name=myvault.com ttl=87600h
Key             Value
---             -----
certificate     -----BEGIN CERTIFICATE-----
MIIDNTCCAh2gAwIBAgIUJqrw/9EDZbp4DExaLjh0vSAHyBgwDQYJKoZIhvcNAQEL
BQAwFjEUMBIGA1UEAxMLbXl2YXVsdC5jb20wHhcNMTcxMjA4MTkyMzIwWhcNMjcx
MjA2MTkyMzQ5WjAWMRQwEgYDVQQDEwtteXZhdWx0LmNvbTCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBAKY/vJ6sRFym+yFYUneoVtDmOCaDKAQiGzQw0IXL
wgMBBb82iKpYj5aQjXZGIl+VkVnCi+M2AQ/iYXWZf1kTAdle4A6OC4+VefSIa2b4
eB7R8aiGTce62jB95+s5/YgrfIqk6igfpCSXYLE8ubNDA2/+cqvjhku1UzlvKBX2
hIlgWkKlrsnybHN+B/3Usw9Km/87rzoDR3OMxLV55YPHiq6+olIfSSwKAPjH8LZm
uM1ITLG3WQUl8ARF17Dj+wOKqbUG38PduVwKL5+qPksrvNwlmCP7Kmjncc6xnYp6
5lfr7V4DC/UezrJYCIb0g/SvtxoN1OuqmmvSTKiEE7hVOAcCAwEAAaN7MHkwDgYD
VR0PAQH/BAQDAgEGMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFECKdYM4gDbM
kxRZA2wR4f/yNhQUMB8GA1UdIwQYMBaAFECKdYM4gDbMkxRZA2wR4f/yNhQUMBYG
A1UdEQQPMA2CC215dmF1bHQuY29tMA0GCSqGSIb3DQEBCwUAA4IBAQCCJKZPcjjn
7mvD2+sr6lx4DW/vJwVSW8eTuLtOLNu6/aFhcgTY/OOB8q4n6iHuLrEt8/RV7RJI
obRx74SfK9BcOLt4+DHGnFXqu2FNVnhDMOKarj41yGyXlJaQRUPYf6WJJLF+ZphN
nNsZqHJHBfZtpJpE5Vywx3pah08B5yZHk1ItRPEz7EY3uwBI/CJoBb+P5Ahk6krc
LZ62kFwstkVuFp43o3K7cRNexCIsZGx2tsyZ0nyqDUFsBr66xwUfn3C+/1CDc9YL
zjq+8nI2ooIrj4ZKZCOm2fKd1KeGN/CZD7Ob6uNhXrd0Tjwv00a7nffvYQkl/1V5
BT55jevSPVVu
-----END CERTIFICATE-----
expiration      1828121029
issuing_ca      -----BEGIN CERTIFICATE-----
MIIDNTCCAh2gAwIBAgIUJqrw/9EDZbp4DExaLjh0vSAHyBgwDQYJKoZIhvcNAQEL
BQAwFjEUMBIGA1UEAxMLbXl2YXVsdC5jb20wHhcNMTcxMjA4MTkyMzIwWhcNMjcx
MjA2MTkyMzQ5WjAWMRQwEgYDVQQDEwtteXZhdWx0LmNvbTCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBAKY/vJ6sRFym+yFYUneoVtDmOCaDKAQiGzQw0IXL
wgMBBb82iKpYj5aQjXZGIl+VkVnCi+M2AQ/iYXWZf1kTAdle4A6OC4+VefSIa2b4
eB7R8aiGTce62jB95+s5/YgrfIqk6igfpCSXYLE8ubNDA2/+cqvjhku1UzlvKBX2
hIlgWkKlrsnybHN+B/3Usw9Km/87rzoDR3OMxLV55YPHiq6+olIfSSwKAPjH8LZm
uM1ITLG3WQUl8ARF17Dj+wOKqbUG38PduVwKL5+qPksrvNwlmCP7Kmjncc6xnYp6
5lfr7V4DC/UezrJYCIb0g/SvtxoN1OuqmmvSTKiEE7hVOAcCAwEAAaN7MHkwDgYD
VR0PAQH/BAQDAgEGMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFECKdYM4gDbM
kxRZA2wR4f/yNhQUMB8GA1UdIwQYMBaAFECKdYM4gDbMkxRZA2wR4f/yNhQUMBYG
A1UdEQQPMA2CC215dmF1bHQuY29tMA0GCSqGSIb3DQEBCwUAA4IBAQCCJKZPcjjn
7mvD2+sr6lx4DW/vJwVSW8eTuLtOLNu6/aFhcgTY/OOB8q4n6iHuLrEt8/RV7RJI
obRx74SfK9BcOLt4+DHGnFXqu2FNVnhDMOKarj41yGyXlJaQRUPYf6WJJLF+ZphN
nNsZqHJHBfZtpJpE5Vywx3pah08B5yZHk1ItRPEz7EY3uwBI/CJoBb+P5Ahk6krc
LZ62kFwstkVuFp43o3K7cRNexCIsZGx2tsyZ0nyqDUFsBr66xwUfn3C+/1CDc9YL
zjq+8nI2ooIrj4ZKZCOm2fKd1KeGN/CZD7Ob6uNhXrd0Tjwv00a7nffvYQkl/1V5
BT55jevSPVVu
-----END CERTIFICATE-----
serial_number   26:aa:f0:ff:d1:03:65:ba:78:0c:4c:5a:2e:38:74:bd:20:07:c8:18
```

返回的证书纯粹是信息性的; 它及其私钥安全地存储在后端挂载中。

#### Set URL configuration

生成的证书可以具有 CRL 位置和颁发证书编码的位置。 这些值必须手动设置，通常设置为与 Vault 服务器关联的 FQDN，但可以随时更改。
```bash
$ vault write pki/config/urls issuing_certificates="http://vault.example.com:8200/v1/pki/ca" crl_distribution_points="http://vault.example.com:8200/v1/pki/crl"
Success! Data written to: pki/ca/urls
```
#### Configure a role
下一步是配置 `role`。 `role` 是映射到用于生成这些凭据的策略的逻辑名称。 例如，我们创建一个 “example-dot-com” 的 `role`：
```bash
$ vault write pki/roles/example-dot-com \
    allowed_domains=example.com \
    allow_subdomains=true max_ttl=72h
Success! Data written to: pki/roles/example-dot-com
```

#### Issue Certificates
通过写入 `roles/example-dot-com` 路径，我们定义了 `example-dot-com` 角色。要生成新证书，我们只需使用该 `role` 名称写入 `issue` 端点：Vault 现已配置好，可以创建和管理证书。
```bash
$ vault write pki/issue/example-dot-com \
    common_name=blah.example.com
Key                 Value
---                 -----
certificate         -----BEGIN CERTIFICATE-----
MIIDvzCCAqegAwIBAgIUWQuvpMpA2ym36EoiYyf3Os5UeIowDQYJKoZIhvcNAQEL
BQAwFjEUMBIGA1UEAxMLbXl2YXVsdC5jb20wHhcNMTcxMjA4MTkyNDA1WhcNMTcx
MjExMTkyNDM1WjAbMRkwFwYDVQQDExBibGFoLmV4YW1wbGUuY29tMIIBIjANBgkq
hkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1CU93lVgcLXGPxRGTRT3GM5wqytCo7Z6
gjfoHyKoPCAqjRdjsYgp1FMvumNQKjUat5KTtr2fypbOnAURDCh4bN/omcj7eAqt
ldJ8mf8CtKUaaJ1kp3R6RRFY/u96BnmKUG8G7oDeEDsKlXuEuRcNbGlGF8DaM/O1
HFa57cM/8yFB26Nj5wBoG5Om6ee5+W+14Qee8AB6OJbsf883Z+zvhJTaB0QM4ZUq
uAMoMVEutWhdI5EFm5OjtMeMu2U+iJl2XqqgQ/JmLRjRdMn1qd9TzTaVSnjoZ97s
jHK444Px1m45einLqKUJ+Ia2ljXYkkItJj9Ut6ZSAP9fHlAtX84W3QIDAQABo4H/
MIH8MA4GA1UdDwEB/wQEAwIDqDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUH
AwIwHQYDVR0OBBYEFH/YdObW6T94U0zuU5hBfTfU5pt1MB8GA1UdIwQYMBaAFECK
dYM4gDbMkxRZA2wR4f/yNhQUMDsGCCsGAQUFBwEBBC8wLTArBggrBgEFBQcwAoYf
aHR0cDovLzEyNy4wLjAuMTo4MjAwL3YxL3BraS9jYTAbBgNVHREEFDASghBibGFo
LmV4YW1wbGUuY29tMDEGA1UdHwQqMCgwJqAkoCKGIGh0dHA6Ly8xMjcuMC4wLjE6
ODIwMC92MS9wa2kvY3JsMA0GCSqGSIb3DQEBCwUAA4IBAQCDXbHV68VayweB2tkb
KDdCaveaTULjCeJUnm9UT/6C0YqC/RxTAjdKFrilK49elOA3rAtEL6dmsDP2yH25
ptqi2iU+y99HhZgu0zkS/p8elYN3+l+0O7pOxayYXBkFf5t0TlEWSTb7cW+Etz/c
MvSqx6vVvspSjB0PsA3eBq0caZnUJv2u/TEiUe7PPY0UmrZxp/R/P/kE54yI3nWN
4Cwto6yUwScOPbVR1d3hE2KU2toiVkEoOk17UyXWTokbG8rG0KLj99zu7my+Fyre
sjV5nWGDSMZODEsGxHOC+JgNAC1z3n14/InFNOsHICnA5AnJzQdSQQjvcZHN2NyW
+t4f
-----END CERTIFICATE-----
issuing_ca          -----BEGIN CERTIFICATE-----
MIIDNTCCAh2gAwIBAgIUJqrw/9EDZbp4DExaLjh0vSAHyBgwDQYJKoZIhvcNAQEL
BQAwFjEUMBIGA1UEAxMLbXl2YXVsdC5jb20wHhcNMTcxMjA4MTkyMzIwWhcNMjcx
MjA2MTkyMzQ5WjAWMRQwEgYDVQQDEwtteXZhdWx0LmNvbTCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBAKY/vJ6sRFym+yFYUneoVtDmOCaDKAQiGzQw0IXL
wgMBBb82iKpYj5aQjXZGIl+VkVnCi+M2AQ/iYXWZf1kTAdle4A6OC4+VefSIa2b4
eB7R8aiGTce62jB95+s5/YgrfIqk6igfpCSXYLE8ubNDA2/+cqvjhku1UzlvKBX2
hIlgWkKlrsnybHN+B/3Usw9Km/87rzoDR3OMxLV55YPHiq6+olIfSSwKAPjH8LZm
uM1ITLG3WQUl8ARF17Dj+wOKqbUG38PduVwKL5+qPksrvNwlmCP7Kmjncc6xnYp6
5lfr7V4DC/UezrJYCIb0g/SvtxoN1OuqmmvSTKiEE7hVOAcCAwEAAaN7MHkwDgYD
VR0PAQH/BAQDAgEGMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFECKdYM4gDbM
kxRZA2wR4f/yNhQUMB8GA1UdIwQYMBaAFECKdYM4gDbMkxRZA2wR4f/yNhQUMBYG
A1UdEQQPMA2CC215dmF1bHQuY29tMA0GCSqGSIb3DQEBCwUAA4IBAQCCJKZPcjjn
7mvD2+sr6lx4DW/vJwVSW8eTuLtOLNu6/aFhcgTY/OOB8q4n6iHuLrEt8/RV7RJI
obRx74SfK9BcOLt4+DHGnFXqu2FNVnhDMOKarj41yGyXlJaQRUPYf6WJJLF+ZphN
nNsZqHJHBfZtpJpE5Vywx3pah08B5yZHk1ItRPEz7EY3uwBI/CJoBb+P5Ahk6krc
LZ62kFwstkVuFp43o3K7cRNexCIsZGx2tsyZ0nyqDUFsBr66xwUfn3C+/1CDc9YL
zjq+8nI2ooIrj4ZKZCOm2fKd1KeGN/CZD7Ob6uNhXrd0Tjwv00a7nffvYQkl/1V5
BT55jevSPVVu
-----END CERTIFICATE-----
private_key         -----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1CU93lVgcLXGPxRGTRT3GM5wqytCo7Z6gjfoHyKoPCAqjRdj
sYgp1FMvumNQKjUat5KTtr2fypbOnAURDCh4bN/omcj7eAqtldJ8mf8CtKUaaJ1k
p3R6RRFY/u96BnmKUG8G7oDeEDsKlXuEuRcNbGlGF8DaM/O1HFa57cM/8yFB26Nj
5wBoG5Om6ee5+W+14Qee8AB6OJbsf883Z+zvhJTaB0QM4ZUquAMoMVEutWhdI5EF
m5OjtMeMu2U+iJl2XqqgQ/JmLRjRdMn1qd9TzTaVSnjoZ97sjHK444Px1m45einL
qKUJ+Ia2ljXYkkItJj9Ut6ZSAP9fHlAtX84W3QIDAQABAoIBAQCf5YIANfF+gkNt
/+YM6yRi+hZJrU2I/1zPETxPW1vaFZR8y4hEoxCEDD8JCRm+9k+w1TWoorvxgkEv
r1HuDALYbNtwLd/71nCHYCKyH1b2uQpyl07qOAyASlb9r5oVjz4E6eobkd3N9fJA
QN0EdK+VarN968mLJsD3Hxb8chGdObBCQ+LO+zdqQLaz+JwhfnK98rm6huQtYK3w
ccd0OwoVmtZz2eJl11TJkB9fi4WqJyxl4wST7QC80LstB1deR78oDmN5WUKU12+G
4Mrgc1hRwUSm18HTTgAhaA4A3rjPyirBohb5Sf+jJxusnnay7tvWeMnIiRI9mqCE
dr3tLrcxAoGBAPL+jHVUF6sxBqm6RTe8Ewg/8RrGmd69oB71QlVUrLYyC96E2s56
19dcyt5U2z+F0u9wlwR1rMb2BJIXbxlNk+i87IHmpOjCMS38SPZYWLHKj02eGfvA
MjKKqEjNY/md9eVAVZIWSEy63c4UcBK1qUH3/5PNlyjk53gCOI/4OXX/AoGBAN+A
Alyd6A/pyHWq8WMyAlV18LnzX8XktJ07xrNmjbPGD5sEHp+Q9V33NitOZpu3bQL+
gCNmcrodrbr9LBV83bkAOVJrf82SPaBesV+ATY7ZiWpqvHTmcoS7nglM2XTr+uWR
Y9JGdpCE9U5QwTc6qfcn7Eqj7yNvvHMrT+1SHwsjAoGBALQyQEbhzYuOF7rV/26N
ci+z+0A39vNO++b5Se+tk0apZlPlgb2NK3LxxR+LHevFed9GRzdvbGk/F7Se3CyP
cxgswdazC6fwGjhX1mOYsG1oIU0V6X7f0FnaqWETrwf1M9yGEO78xzDfgozIazP0
s0fQeR9KXsZcuaotO3TIRxRRAoGAMFIDsLRvDKm1rkL0B0czm/hwwDMu/KDyr5/R
2M2OS1TB4PjmCgeUFOmyq3A63OWuStxtJboribOK8Qd1dXvWj/3NZtVY/z/j1P1E
Ceq6We0MOZa0Ae4kyi+p/kbAKPgv+VwSoc6cKailRHZPH7quLoJSIt0IgbfRnXC6
ygtcLNMCgYBwiPw2mTYvXDrAcO17NhK/r7IL7BEdFdx/w8vNJQp+Ub4OO3Iw6ARI
vXxu6A+Qp50jra3UUtnI+hIirMS+XEeWqJghK1js3ZR6wA/ZkYZw5X1RYuPexb/4
6befxmnEuGSbsgvGqYYTf5Z0vgsw4tAHfNS7TqSulYH06CjeG1F8DQ==
-----END RSA PRIVATE KEY-----
private_key_type    rsa
serial_number       59:0b:af:a4:ca:40:db:29:b7:e8:4a:22:63:27:f7:3a:ce:54:78:8a
```

Vault 现在使用 `example-dot-com` 角色配置生成一组新凭据。在这里，我们看到动态生成的私钥和证书。

使用 ACL，可以限制使用 `pki` 后端，以便可信操作者可以管理角色定义，并且用户和应用程序都受限于这个凭据，仅允许读取。

如果在任何时候遇到困难，只需运行 `vault path-help pki` 或使用子路径输出帮助。

### Setting Up Intermediate CA
在快速入门指南中，证书直接从根证书颁发机构颁发。 如示例中所述，这不是推荐的做法。本指南以先前指南的根证书颁发机构为基础，使用根权限创建中间权限以签署中间证书。

#### Mount the backend
要将另一个证书颁发机构添加到 Vault 实例，我们必须将其安装在其他路径上。
```bash
$ vault secrets enable -path=pki_int pki
Successfully mounted 'pki' at 'pki_int'!
```

#### Configure an Intermediate CA
```bash
$ vault secrets tune -max-lease-ttl=43800h pki_int
Successfully tuned mount 'pki_int'!
```
这里将最大 TTL 设置为5年。 此值应小于或等于根证书颁发机构。

现在，我们生成中间证书签名请求
```bash
$ vault write pki_int/intermediate/generate/internal common_name="myvault.com Intermediate Authority" ttl=43800h
Key Value
csr -----BEGIN CERTIFICATE REQUEST-----
MIICsjCCAZoCAQAwLTErMCkGA1UEAxMibXl2YXVsdC5jb20gSW50ZXJtZWRpYXRl
IEF1dGhvcml0eTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJU1Qh8l
BW16WHAu34Fy92FnSy4219WVlKw1xwpKxjd95xH6WcxXozOs6oHFQ9c592bz51F8
KK3FFJYraUrGONI5Cz9qHbzC1mFCmjnXVXCoeNKIzEBG0Y+ehH7MQ1SvDCyvaJPX
ItFXaGf6zENiGsApw3Y3lFr0MjPzZDBH1p4Nq3aA6L2BaxvO5vczdQl5tE2ud/zs
GIdCWnl1ThDEeiX1Ppduos/dx3gaZa9ly3iCuDMKIL9yK5XTBTgKB6ALPApekLQB
kcUFbOuMzjrDSBe9ytu65yICYp26iAPPA8aKTj5cUgscgzEvQS66rSAVG/unrWxb
wbl8b7eQztCmp60CAwEAAaBAMD4GCSqGSIb3DQEJDjExMC8wLQYDVR0RBCYwJIIi
bXl2YXVsdC5jb20gSW50ZXJtZWRpYXRlIEF1dGhvcml0eTANBgkqhkiG9w0BAQsF
AAOCAQEAZA9A1QvTdAd45+Ay55FmKNWnis1zLjbmWNJURUoDei6i6SCJg0YGX1cZ
WkD0ibxPYihSsKRaIUwC2bE8cxZM57OSs7ISUmyPQAT2IHTHvuGK72qlFRBlFOzg
SHEG7gfyKdrALphyF8wM3u4gXhcnY3CdltjabL3YakZqd3Ey4870/0XXeo5c4k7w
/+n9M4xED4TnXYCGfLAlu5WWKSeCvu9mHXnJcLo1MiYjX7KGey/xYYbfxHSPm4ul
tI6Vf59zDRscfNmq37fERD3TiKP0QZNGTSRvnrxrx2RUQGXFywM8l4doG8nS5BxU
2jP20cdv0lJFvHr9663/8B/+F5L6Yw==
-----END CERTIFICATE REQUEST-----
```
从中间权限获取签名请求，并使用另一个证书颁发机构对其进行签名，在本例中为第一个示例中生成的根证书颁发机构。
```bash
$ vault write pki/root/sign-intermediate csr=@pki_int.csr format=pem_bundle ttl=43800h
Key             Value
certificate     -----BEGIN CERTIFICATE-----
MIIDZTCCAk2gAwIBAgIUENxQD7KIJi1zE/jEiYqAG1VC4NwwDQYJKoZIhvcNAQEL
BQAwFjEUMBIGA1UEAxMLbXl2YXVsdC5jb20wHhcNMTcxMTI4MTcwNzIzWhcNMjIx
MTI3MTcwNzUzWjAtMSswKQYDVQQDEyJteXZhdWx0LmNvbSBJbnRlcm1lZGlhdGUg
QXV0aG9yaXR5MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5seNV4Yd
uCMX0POUUuSzCBiR3Cyf9b9tGsCX7UfvZmjPs+Fl/X+Ovq6UtHM9RuTGlyfFrCWy
pflO7mc0H8PBzlvhv1WQet5aRyUOXkG6iYmooG9iobIY8z/TZCaCF605pgygfOaS
DIlwOdJkfiXxGpQ00pfIwe/Y2OK2I5e36u0E2EA6kXvcfexLjQGFPbod+H0R29Ro
/GwOJ6MpSHqB77mF025x1y08EtqT1z1kFCiDzFSkzNZEZYWljhDS6ZRY9ctzKufm
5CkUwmvCVRI2CivDJvmfhXyv0DRoq4IhYdJHo179RSObq3BY9f9LQ0balNLiM0Ft
O8f0urTqUAbySwIDAQABo4GTMIGQMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8E
BTADAQH/MB0GA1UdDgQWBBSQgTfcMrKYzyckP6t/0iVQkl0ZBDAfBgNVHSMEGDAW
gBRccsCARqs3wQDjW7JMNXS6pWlFSDAtBgNVHREEJjAkgiJteXZhdWx0LmNvbSBJ
bnRlcm1lZGlhdGUgQXV0aG9yaXR5MA0GCSqGSIb3DQEBCwUAA4IBAQABNg2HxccY
DwRpsJ+sxA0BgDyF+tYtOlXViVNv6Z+nOU0nNhQSCjfzjYWmBg25nfKaFhQSC3b7
fIW+e7it/FLVrCgaqdysoxljqhR0gXMAy8S/ubmskPWjJiKauJB5bfB59Uf2GP6j
zimZDu6WjWvvgkKcJqJEbOOS9DWBvCTdmmml1NMXZtcytpod2Y7mxninqNRx3qpx
Pst4vgAbyM/3zLSzkyUD+MXIyRXwxktFlyEYBHvMd9OoHzLO6WLxk22FyQQ+w4by
NfXJY4r5pj6a4lJ6pPuqyfBhidYMTdY3AI7w/QRGk4qQv1iDmnZspk2AxdbR5Lwe
YmChIML/f++S
-----END CERTIFICATE-----
expiration      1669568873
issuing_ca      -----BEGIN CERTIFICATE-----
MIIDNTCCAh2gAwIBAgIUdR44qhhyh3CZjnCtflGKQlTI8NswDQYJKoZIhvcNAQEL
BQAwFjEUMBIGA1UEAxMLbXl2YXVsdC5jb20wHhcNMTcxMTI4MTYxODA2WhcNMjcx
MTI2MTYxODM1WjAWMRQwEgYDVQQDEwtteXZhdWx0LmNvbTCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBANTPnQ2CUkuLrYT4V6/IIK/gWFZXFG4lWTmgM5Zh
PDquMhLEikZCbZKbupouBI8MOr5i8tycENaTnSs9dBwVEOWAHbLkliVgvCKgLi0F
PfPM87FnBoKVctO2ip8AdmYcAt/wc096dWBG6eKLVP5xsAe7NcYDtF/inHgEZ22q
ZjGVEyC6WntIASgULoHGgHakPp1AHLhGm8nL5YbusWY7RgZIlNeGWLVoneG0pxdV
7W1SPO67dsQyq58mTxMIGVUj5YE1q7/C6OhCTnAHc+sRm0oUehPfO8kY4NHpCJGv
nDRdJi6k6ewk94c0KK2tUUM/TN6ZSRfx6ccgfPH8zNcVPVcCAwEAAaN7MHkwDgYD
VR0PAQH/BAQDAgEGMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFFxywIBGqzfB
AONbskw1dLqlaUVIMB8GA1UdIwQYMBaAFFxywIBGqzfBAONbskw1dLqlaUVIMBYG
A1UdEQQPMA2CC215dmF1bHQuY29tMA0GCSqGSIb3DQEBCwUAA4IBAQBgvsgpBuVR
iKVdXXpFyoQLImuoaHZgaj5tuUDqnMoxOA1XWW6SVlZmGfDQ7+u5NBkp2cGSDRGm
ARHJTeURvdZIwdFdGkNqfAZjutRjjQOnXgS65ujZd7AnlZq1v0ZOZqVVk9YEOhOe
Rh2MjnHGNuiLBib1YNQHNuRef1mPwIE2Gm/Tz/z3JPHtkKNIKbn60zHrIIM/OT2Z
HYjcMUcqXtKGYfNjVspJm3lSDUoyJdaq80Afmy2Ez1Vt9crGG3Dj8mgs59lEhEyo
MDVhOP116M5HJfQlRPVd29qS8pFrjBvXKjJSnJNG1UFdrWBJRJ3QrBxUQALKrJlR
g5lvTeymHjS/
-----END CERTIFICATE-----
serial_number   10:dc:50:0f:b2:88:26:2d:73:13:f8:c4:89:8a:80:1b:55:42:e0:dc
```
现在将中间证书颁发机构签名证书设置为根签名证书。
```bash
$ vault write pki_int/intermediate/set-signed certificate=@signed_certificate.pem
Success! Data written to: pki_int/intermediate/set-signed
```
现在配置好了中间证书颁发机构，并且可以颁发证书。

#### Set URL configuration
生成的证书可以具有 CRL 位置和颁发证书编码的位置。 这些值必须手动设置，但可以随时更改。
```bash
$ vault write pki_int/config/urls issuing_certificates="http://127.0.0.1:8200/v1/pki_int/ca" crl_distribution_points="http://127.0.0.1:8200/v1/pki_int/crl"
Success! Data written to: pki_int/ca/urls
```
#### Configure a role
下一步是配置 `role`。 `role` 是映射到用于生成这些凭据的策略的逻辑名称。 例如，我们创建一个 “example-dot-com” 的 `role`：
```bash
$ vault write pki_int/roles/example-dot-com \
    allowed_domains=example.com \
    allow_subdomains=true max_ttl=72h
Success! Data written to: pki_int/roles/example-dot-com
```
#### Issue Certificates
通过写入 `roles/example-dot-com` 路径，我们定义了 `example-dot-com` 角色。 要生成新证书，我们只需使用该 `role` 名称写入 `issue` 端点：Vault 现已配置好，可以创建和管理证书。
```bash
$ vault write pki_int/issue/example-dot-com \
    common_name=blah.example.com
Key                 Value
---                 -----
certificate         -----BEGIN CERTIFICATE-----
MIIDbDCCAlSgAwIBAgIUPiAyxq+nIE6xlWf7hrzLkPQxtvMwDQYJKoZIhvcNAQEL
BQAwMzExMC8GA1UEAxMoVmF1bHQgVGVzdGluZyBJbnRlcm1lZGlhdGUgU3ViIEF1
dGhvcml0eTAeFw0xNjA5MjcwMDA5MTNaFw0xNjA5MjcwMTA5NDNaMBsxGTAXBgNV
BAMTEGJsYWguZXhhbXBsZS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK
AoIBAQDJAYB04IVdmSC/TimaA6BbXlvgBTZHL5wBUTmO4iHhenL0eDEXVe2Fd7Yq
75LiBJmcC96hKbqh5rwS8KwN9ElZI52/mSMC+IvoNlYHAf7shwfsjrVx3q7/bTFg
lz6wECn1ugysxynmMvgQD/pliRkxTQ7RMh4Qlh75YG3R9BHy9ZddklZp0aNaitts
0uufHnN1UER/wxBCZdWTUu34KDL9I6yE7Br0slKKHPdEsGlFcMkbZhvjslZ7DGvO
974S0qtOdKiawJZbpNPg0foGZ3AxesDUlkHmmgzUNes/sjknDYTHEfeXM6Uap0j6
XvyhCxqdeahb/Vtibg0z9I0IusJbAgMBAAGjgY8wgYwwDgYDVR0PAQH/BAQDAgOo
MB0GA1UdJQQWMBQGCCsGAQUFBwMBBggrBgEFBQcDAjAdBgNVHQ4EFgQU/5oy0rL7
TT0wX7KZK7qcXqgayNwwHwYDVR0jBBgwFoAUgM37P8oXmA972ztLfw+b1eIY5now
GwYDVR0RBBQwEoIQYmxhaC5leGFtcGxlLmNvbTANBgkqhkiG9w0BAQsFAAOCAQEA
CT2vI6/taeLTw6ZulUhLXEXYXWZu1gF8n2COjZzbZXmHxQAoZ3GtnSNwacPHAyIj
f3cA9Moo552y39LUtWk+wgFtQokWGK7LXglLaveNUBowOHq/xk0waiIinJcgTG53
Z/qnbJnTjAOG7JwVJplWUIiS1avCksrHt7heE2EGRGJALqyLZ119+PW6ogtCLUv1
X8RCTw/UkIF/LT+sLF0bXWy4Hn38Gjwj1MVv1l76cEGOVSHyrYkN+6AMnAP58L5+
IWE9tN3oac4x7jhbuNpfxazIJ8Q6l/Up5U5Evfbh6N1DI0/gFCP20fMBkHwkuLfZ
2ekZoSeCgFRDlHGkr7Vv9w==
-----END CERTIFICATE-----
issuing_ca          -----BEGIN CERTIFICATE-----
MIIDijCCAnKgAwIBAgIUB28DoGwgGFKL7fbOu9S4FalHLn0wDQYJKoZIhvcNAQEL
BQAwLzEtMCsGA1UEAxMkVmF1bHQgVGVzdGluZyBJbnRlcm1lZGlhdGUgQXV0aG9y
aXR5MB4XDTE2MDkyNzAwMDgyMVoXDTI2MDkxNjE2MDg1MVowMzExMC8GA1UEAxMo
VmF1bHQgVGVzdGluZyBJbnRlcm1lZGlhdGUgU3ViIEF1dGhvcml0eTCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBAOSCiSij4wy1wiMwvZt+rtU3IaO6ZTn9
LfIPuGsR5/QSJk37pCZQco1LgoE/rTl+/xu3bDovyHDmgObghC6rzVOX2Tpi7kD+
DOZpqxOsaS8ebYgxB/XJTSxyEJuSAcpSNLqqAiZivuQXdaD0N7H3Or0awwmKE9mD
I0g8CF4fPDmuuOG0ASn9fMqXVVt5tXtEqZ9yJYfNOXx3FOPjRVOZf+kvSc31wCKe
i/KmR0AQOmToKMzq988nLqFPTi9KZB8sEU20cGFeTQFol+m3FTcIru94EPD+nLUn
xtlLELVspYb/PP3VpvRj9b+DY8FGJ5nfSJl7Rkje+CD4VxJpSadin3kCAwEAAaOB
mTCBljAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQU
gM37P8oXmA972ztLfw+b1eIY5nowHwYDVR0jBBgwFoAUj4YAIxRwrBy0QMRKLnD0
kVidIuYwMwYDVR0RBCwwKoIoVmF1bHQgVGVzdGluZyBJbnRlcm1lZGlhdGUgU3Vi
IEF1dGhvcml0eTANBgkqhkiG9w0BAQsFAAOCAQEAA4buJuPNJvA1kiATLw1dVU2J
HPubk2Kp26Mg+GwLn7Vz45Ub133JCYfF3/zXLFZZ5Yub9gWTtjScrvNfQTAbNGdQ
BdnUlMmIRmfB7bfckhryR2R9byumeHATgNKZF7h8liNHI7X8tTzZGs6wPdXOLlzR
TlM3m1RNK8pbSPOkfPb06w9cBRlD8OAbNtJmuypXA6tYyiiMYBhP0QLAO3i4m1ns
aAjAgEjtkB1rQxW5DxoTArZ0asiIdmIcIGmsVxfDQIjFlRxAkafMs74v+5U5gbBX
wsOledU0fLl8KLq8W3OXqJwhGLK65fscrP0/omPAcFgzXf+L4VUADM4XhW6Xyg==
-----END CERTIFICATE-----
ca_chain            [-----BEGIN CERTIFICATE-----
MIIDijCCAnKgAwIBAgIUB28DoGwgGFKL7fbOu9S4FalHLn0wDQYJKoZIhvcNAQEL
BQAwLzEtMCsGA1UEAxMkVmF1bHQgVGVzdGluZyBJbnRlcm1lZGlhdGUgQXV0aG9y
aXR5MB4XDTE2MDkyNzAwMDgyMVoXDTI2MDkxNjE2MDg1MVowMzExMC8GA1UEAxMo
VmF1bHQgVGVzdGluZyBJbnRlcm1lZGlhdGUgU3ViIEF1dGhvcml0eTCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBAOSCiSij4wy1wiMwvZt+rtU3IaO6ZTn9
LfIPuGsR5/QSJk37pCZQco1LgoE/rTl+/xu3bDovyHDmgObghC6rzVOX2Tpi7kD+
DOZpqxOsaS8ebYgxB/XJTSxyEJuSAcpSNLqqAiZivuQXdaD0N7H3Or0awwmKE9mD
I0g8CF4fPDmuuOG0ASn9fMqXVVt5tXtEqZ9yJYfNOXx3FOPjRVOZf+kvSc31wCKe
i/KmR0AQOmToKMzq988nLqFPTi9KZB8sEU20cGFeTQFol+m3FTcIru94EPD+nLUn
xtlLELVspYb/PP3VpvRj9b+DY8FGJ5nfSJl7Rkje+CD4VxJpSadin3kCAwEAAaOB
mTCBljAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQU
gM37P8oXmA972ztLfw+b1eIY5nowHwYDVR0jBBgwFoAUj4YAIxRwrBy0QMRKLnD0
kVidIuYwMwYDVR0RBCwwKoIoVmF1bHQgVGVzdGluZyBJbnRlcm1lZGlhdGUgU3Vi
IEF1dGhvcml0eTANBgkqhkiG9w0BAQsFAAOCAQEAA4buJuPNJvA1kiATLw1dVU2J
HPubk2Kp26Mg+GwLn7Vz45Ub133JCYfF3/zXLFZZ5Yub9gWTtjScrvNfQTAbNGdQ
BdnUlMmIRmfB7bfckhryR2R9byumeHATgNKZF7h8liNHI7X8tTzZGs6wPdXOLlzR
TlM3m1RNK8pbSPOkfPb06w9cBRlD8OAbNtJmuypXA6tYyiiMYBhP0QLAO3i4m1ns
aAjAgEjtkB1rQxW5DxoTArZ0asiIdmIcIGmsVxfDQIjFlRxAkafMs74v+5U5gbBX
wsOledU0fLl8KLq8W3OXqJwhGLK65fscrP0/omPAcFgzXf+L4VUADM4XhW6Xyg==
-----END CERTIFICATE-----]
private_key         -----BEGIN RSA PRIVATE KEY-----
MIIEpgIBAAKCAQEAyQGAdOCFXZkgv04pmgOgW15b4AU2Ry+cAVE5juIh4Xpy9Hgx
F1XthXe2Ku+S4gSZnAveoSm6oea8EvCsDfRJWSOdv5kjAviL6DZWBwH+7IcH7I61
cd6u/20xYJc+sBAp9boMrMcp5jL4EA/6ZYkZMU0O0TIeEJYe+WBt0fQR8vWXXZJW
adGjWorbbNLrnx5zdVBEf8MQQmXVk1Lt+Cgy/SOshOwa9LJSihz3RLBpRXDJG2Yb
47JWewxrzve+EtKrTnSomsCWW6TT4NH6BmdwMXrA1JZB5poM1DXrP7I5Jw2ExxH3
lzOlGqdI+l78oQsanXmoW/1bYm4NM/SNCLrCWwIDAQABAoIBAQCCbHMJY1Wl8eIJ
v5HG2WuHXaaHqVoavo2fXTDXwWryfx1v+zz/Q0YnQBH3shPAi/OQCTOfpw/uVWTb
dUZul3+wUyfcVmUdXGCLgBY53dWna8Z8e+zHwhISsqtDXV/TpelUBDCNO324XIIR
Cg0TLO4nyzQ+ESLo6D+Y2DTp8lBjMEkmKTd8CLXR2ycEoVykN98qPZm8keiLGO91
I8K7aRd8uOyQ6HUfJRlzFHSuwaLReErxGTEPI4t/wVqh2nP2gGBsn3apiJ0ul6Jz
NlYO5PqiwpeDk4ibhQBpicnm1jnEcynH/WtGuKgMNB0M4SBRBsEguO7WoKx3o+qZ
iVIaPWDhAoGBAO05UBvyJpAcz/ZNQlaF0EAOhoxNQ3h6+6ZYUE52PgZ/DHftyJPI
Y+JJNclY91wn91Yk3ROrDi8gqhzA+2Lelxo1kuZDu+m+bpzhVUdJia7tZDNzRIhI
24eP2GdochooOZ0qjvrik4kuX43amBhQ4RHsBjmX5CnUlL5ZULs8v2xnAoGBANjq
VLAwiIIqJZEC6BuBvVYKaRWkBCAXvQ3j/OqxHRYu3P68PZ58Q7HrhrCuyQHTph2v
fzfmEMPbSCrFIrrMRmjUG8wopL7GjZjFl8HOBHFwzFiz+CT5DEC+IJIRkp4HM8F/
PAzjB2wCdRdSjLTD5ph0/xQIg5xfln7D+wqU0QHtAoGBAKkLF0/ivaIiNftw0J3x
WxXag/yErlizYpIGCqvuzII6lLr9YdoViT/eJYrmb9Zm0HS9biCu2zuwDijRSBIL
RieyF40opUaKoi3+0JMtDwTtO2MCd8qaCH3QfkgqAG0tTuj1Q8/6F2JA/myKYamq
MMhhpYny9+7rAlemM8ZJIqtvAoGBAKOI3zpKDNCdd98A4v7B7H2usZUIJ7gOTZDo
XqiNyRENWb2PK6GNq/e6SrxvuclvyKA+zFnXULJoYtsj7tAH69lieGaOCc5uoRgZ
eBU7/euMj/McE6vEO3GgJawaJYCQi3uJMjvA+bp7i81+hehOfU5ZfmmbFaZSBoMh
u+U5Vu3tAoGBANnBIbHfD3E7rqnqdpH1oRRHLA1VdghzEKgyUTPHNDzPJG87RY3c
rRqeXepblud3qFjD60xS9BzcBijOvZ4+KHk6VIMpkyqoeNVFCJbBVCw+JGMp88+v
e9t+2iwryh5+rnq+pg6anmgwHldptJc1XEFZA2UUQ89RP7kOGQF6IkIS
-----END RSA PRIVATE KEY-----
private_key_type    rsa
serial_number       3e:20:32:c6:af:a7:20:4e:b1:95:67:fb:86:bc:cb:90:f4:31:b6:f3
```
Vault 现在使用 `example-dot-com` 角色配置生成一组新凭据。 在这里，我们看到动态生成的私钥和证书。 还将返回颁发CA证书和CA信任链。 CA Chain 返回信任链中的所有中间权限。
不包括根权限，因为底层操作系统通常会信任它。

### API
PKI secrets 引擎有完整的 HTTP API，查看更多 [PKI secrets engine API]() 详情。
