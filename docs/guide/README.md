# Getting Started

## 安装

[下载地址](https://www.vaultproject.io/downloads.html)。

```bash
wget wget https://releases.hashicorp.com/vault/0.11.4/vault_0.11.4_linux_amd64.zip
mv ./vault_0.11.4_linux_amd64.zip /usr/local/program/

# 解压 得到一个二进制文件 vault
unzip vault_0.11.4_linux_amd64.zip

# 配置环境变量
vim /etc/profile

# 添加下面的内容 /usr/local/program 改成你自己的安装目录
VAULT_PATH=/usr/local/program
export PATH=$VAULT_PATH:$PATH

# 使环境变量生效
source /etc/profile

# 验证 vault
vault

# 安装 子命令、标志和路径参数的命令行补全 自动安装 helper 到 ~/.bashrc
vault -autocomplete-install
exec $SHELL
```

## 启动 server
Vault 用作 client/server 应用程序。Vault server 是 Vault 架构中唯一与数据存储和后端交互的部分。通过 Vault CLI 完成的所有操作都通过 TLS 连接与服务器交互。

### 启动 Vault server

首先我们开启 Vault 的 `dev server`，dev server 是一个内置的、预先配置好的服务器，它不是很安全，但对于本地使用 Vault 非常有用。只能用于开发环境。
运行：
```bash
vault server -dev

# 输出
==> Vault server configuration:

             Api Address: http://127.0.0.1:8200
                     Cgo: disabled
         Cluster Address: https://127.0.0.1:8201
              Listener 1: tcp (addr: "127.0.0.1:8200", cluster address: "127.0.0.1:8201", max_request_duration: "1m30s", max_request_size: "33554432", tls: "disabled")
               Log Level: (not set)
                   Mlock: supported: true, enabled: false
                 Storage: inmem
                 Version: Vault v0.11.4
             Version Sha: 612120e76de651ef669c9af5e77b27a749b0dba3

WARNING! dev mode is enabled! In this mode, Vault runs entirely in-memory
and starts unsealed with a single unseal key. The root token is already
authenticated to the CLI, so you can immediately begin using Vault.

You may need to set the following environment variable:

    $ export VAULT_ADDR='http://127.0.0.1:8200'

The unseal key and root token are displayed below in case you want to
seal/unseal the Vault or re-authenticate.

Unseal Key: MG/XNYH+rCMgPE8QMIisDSRBmiNpzAmUI/Rj75RZ/XY=
Root Token: 2oYMZEsFTi9bfeqKIcwwKMxP

Development mode should NOT be used in production installations!

==> Vault server started! Log data will stream in below:

# ...
```

这是 Vault 开发服务器已经启动，不要关闭终端选项卡，打开一个新的选项卡，运行其他命令。

dev server 所有的数据都存储在内存（加密的），在没有 TLS 的 `localhost` 上侦听，并自动解封并显示 `unseal key` 和 `root access key`。

dev server 运行后，先做下面三件事：
1. 打开一个新的终端会话。
2. 复制并运行上面终端输出的命令 `export VAULT_ADDR='http://127.0.0.1:8200'`，这会配置 Vault 客户端与我们的 dev server 通信。
3. 复制终端输出的 `Unseal Key`，保存到任意的地方。
4. 复制终端输出的 `Root Token`，并设置到环境变量 `export VAULT_DEV_ROOT_TOKEN_ID="s.XmpNPoi9sRhYtdKHaQhkHP6x"`

### 校验 server 是否运行
打开新的终端，运行 `export VAULT_ADDR='http://127.0.0.1:8200'`：
```bash
# 校验
vault status

# 输出
Key             Value
---             -----
Seal Type       shamir
Initialized     true
Sealed          false
Total Shares    1
Threshold       1
Version         0.11.4
Cluster Name    vault-cluster-8ffc02c5
Cluster ID      6a450d7d-e4aa-b636-e338-619aff7c3626
HA Enabled      false
```

如果输出看起来不一样，特别是如果数字不同或 Vault 是 `sealed`，那么重新启动 dev server 并再次尝试。

## 第一个 Secret
现在 dev server 已经运行，开始读写我们第一个 Secret。

Vault 的核心特性之一就是安全读写任意的 secrets 。可以通过 CLI，但是也有一个完整的[HTTP API](https://www.vaultproject.io/api/index.html)，可以通过编程的方式
使用 Vault 做任何事情。

写入 Vault 的信息会被加密，然后再写入后端存储。对于 dev server，后端存储是在内存中，但是在生产环境下，应该是磁盘或者[Consul](https://www.consul.io/)。
Vault 在将值传递给存储驱动程序之前对其进行加密。后端存储机制永远不会看到未加密的值，在没有 Vault 的情况下，也没有方法解密它。

### 写一个 Secret

使用`vault kv`命令写入：
```bash
vault kv put secret/hello foo=world

# 输出
Key              Value
---              -----
created_time     2019-02-04T19:53:22.730733Z
deletion_time    n/a
destroyed        false
version          1

# 写入多对
vault kv put secret/hello foo=world excited=yes
```
将一对值 `foo=world` 写入路径 `secret/hello`。这个**路径的前缀 `secret/` 很重要**，否则这个示例将无法工作。`secret/` 前缀是任意 secrets 可以读写的地方。

`vault kv put`是一个非常强大的命令。除了直接从命令行写入数据外，它还可以从 `STDIN` 以及文件中读取值和密钥对。
更多信息，参阅[命令文档](https://www.vaultproject.io/docs/commands/index.html)。

> **但如果可能的话，使用文件更安全。通过 CLI 发送数据通常记录在 `shell` 历史记录中。对于重要 secrets ，请使用文件。**

### 读取一个 Secret
使用 `vault get` 读取：
```bash
vault kv get secret/hello

# 输出
====== Metadata ======
Key              Value
---              -----
created_time     2018-10-31T06:05:53.226450737Z
deletion_time    n/a
destroyed        false
version          2

===== Data =====
Key        Value
---        -----
excited    yes
foo        world
```
Vault 从存储中获取数据并解密。

添加参数 `-format=json`，可以输出`json`格式：
```bash
vault kv get -format=json secret/hello

# 输出
{
  "request_id": "3496c75c-9247-4d49-7ac4-8d821aa0bf43",
  "lease_id": "",
  "lease_duration": 0,
  "renewable": false,
  "data": {
    "data": {
      "excited": "yes",
      "foo": "world"
    },
    "metadata": {
      "created_time": "2018-10-31T06:05:53.226450737Z",
      "deletion_time": "",
      "destroyed": false,
      "version": 2
    }
  },
  "warnings": null
}

# 可以结合 jq 使用
vault kv get -format=json secret/hello | jq -r .data.data.excited

# 输出
yes
```

也可以直接获取指定的字段：
```bash
vault kv get -field=excited secret/hello

# 输出
yes
```

### 删除一个 Secret
`vault delete`命令删除：
```bash
vault kv delete secret/hello

# 输出
Success! Data deleted (if it existed) at: secret/hello
```

## Secrets 引擎
我们前面的读写操作。你应该注意到所有的请求都以 `secret/` 开头。如果尝试使用不同的前缀，Vault 会返回一个错误:
```bash
vault write foo/bar a=b

# 输出
Error writing data to foo/bar: Error making API request.

URL: PUT http://127.0.0.1:8200/v1/foo/bar
Code: 404. Errors:

* no handler for route 'foo/bar'
```

同样的，`vault kv put foo/bar a=b` 也会返回一个错误。

**路径前缀告诉 Vault 应该路由到哪个 secrets 引擎**。当请求到达 Vault 时，它使用最长的前缀匹配，匹配初始路径部分，然后将请求传递给相应的 secrets 引擎。

默认情况下，Vault 在路径 `secret/` 上启用了一个名为 `kv` 的 secrets 引擎。`kv` secrets 引擎将原始数据读写到后端存储。

Vault 除了 `kv` 还支持多种 secrets 引擎，这个特性使 Vault 变得灵活。例如，`aws` secrets 引擎需要生成 `aws IAM access keys` 。
`database` secrets 引擎生成按需的、有时间限制的数据库凭证。这只是一些可用的 secrets 引擎的例子。

为了简单，Vault 提供的这些 secrets 引擎了类似于文件系统。一个 secrets 引擎启用在一个路径上。Vault 本身在传入请求上执行前缀路由，
并根据启用的路径将请求路由到正确的 secrets 引擎。

### 启用一个 secrets 引擎
我们启用一个 `kv`  secrets 引擎在一个不同的路径上，像文件系统一样，我们可以在多个不同的路径上启用一个 secrets 引擎。
每个路径都是完全隔离的，不能与其他路径通信。例如，在 `foo` 路径上的`kv` secrets 引擎,不能和在 `bar` 路径上的`kv` secrets 引擎通信。
启用：
```bash
vault secrets enable -path=kv kv

# 输出
Success! Enabled the kv secrets engine at: kv/
```

在 `kv/` 路径上启用了`kv` secrets 引擎。**启用 secrets 引擎的路径默认是 secrets 引擎的名称**。也就是说 `vault secrets enable kv` 和上面的命令
是一样的效果。

查看是否操作成功，获取 secrets 引擎更多信息，使用 `vault secrets list` 命令：
```bash
vault secrets list

# 输出 n/a 表示没有描述
Path          Type         Accessor              Description
----          ----         --------              -----------
cubbyhole/    cubbyhole    cubbyhole_acf26a2e    per-token private secret storage
identity/     identity     identity_3cdd7b91     identity store
kv/           kv           kv_457c99be           n/a
secret/       kv           kv_548de4c3           key/value secret storage
sys/          system       system_6ab143cf       system endpoints used for control, policy and debugging
```

### 禁用一个 secrets 引擎
如果 secrets 引擎被禁用了，那么所有的 secrets 会被撤销，相应的 Vault 数据和配置会被删除。任何将数据路由到该路径的请求都会导致错误，
但是现在该路径可以启用另一个 secrets 引擎了。

如果由于某种原因，Vault 无法删除数据或撤销租约，禁用操作将失败。如果发生这种情况，secrets 引擎将保持启用和可用，但是请求将返回一个错误。

```bash
vault secrets disable kv/
```

注意**这个命令的参数不是 secrets 引擎的类型，而是 secrets 引擎对应的路径**。

还可以将 secrets 引擎移动到新的路径。这仍然是一个破坏性的命令。所有配置数据都被保留，但是任何 secrets 都被撤销，因为 secrets 与引擎的路径紧密相连。

### secrets 引擎是什么？

上面提到，Vault 的行为类似于虚拟文件系统。`get/write/delete/list` 操作被转发到相应的 secrets 引擎，secrets 引擎决定如何对这些操作作出反应。

这种抽象非常强大。它使 Vault 可以直接与物理系统、数据库、HSMs等进行交互。但是除了这些物理系统之外，Vault 还可以与更独特的环境进行交互，比如 AWS IAM，动态 SQL 用户创建，
并且同时使用相同的读写接口。

## Dynamic Secrets
和 `kv` secrets 不同的是，你不需要自己将数据放入存储中，**Dynamic secrets 是在访问它们时生成的。Dynamic secrets 在被读取之前是不存在的，
因此不存在有人窃取它们或其他客户使用相同 secrets 的风险**。由于 Vault 具有内置的撤销机制，Dynamic secrets 可以在使用后立即撤销，从而最小化了 secrets 存在的时间。

### 启用 AWS Secrets 引擎
AWS secrets 引擎不像 `kv` secrets 引擎一样被默认启用，需要自己在使用前启用。
```bash
vault secrets enable -path=aws aws
```
正如我们在前几节中所讨论的，不同的 secrets 引擎允许不同的行为。这个例子中，AWS secrets 引擎生成动态的、按需的 AWS 访问凭证。

### 配置 AWS Secrets 引擎
在启用 AWS secrets 引擎之后，必须将其配置为进行身份验证并与 AWS 进行通信。这需要特权帐户凭证。如果你不熟悉 AWS，请使用根帐户密钥（**不要在生产环境下使用根帐户密钥**）。

```bash
vault write aws/config/root \
   access_key=AKIAI4SGLQPBX6CSENIQ \
   secret_key=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

# 输出
Success! Data written to: aws/config/root
```
这些凭证现在存储在这个 AWS secrets 引擎中。在将来的请求中，引擎将在与 AWS 通信时使用这些凭证。

### 创建 `role`
配置一个 `role`，Vault 中 `role` 是对操作友好的标识符。把它看作一个符号链接。

Vault 知道如何通过 AWS API 创建 IAM 用户，但是它不知道想要附加到该用户的权限、组和策略。这就是 `role` 的作用—— `role` 将你的配置选项映射到那些 API 调用。

例如，这里有一个支持 EC2 上所有操作的 IAM 策略。当 Vault 生成访问密钥时，它将自动附加此策略。生成的访问密钥访问 EC2 (由此策略决定)的所有权限，但不能访问 IAM 或其他 AWS 服务。

```bash
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Stmt1426528957000",
      "Effect": "Allow",
      "Action": ["ec2:*"],
      "Resource": ["*"]
    }
  ]
}
```

如上所述，我们需要将这个策略文档映射到一个指定的 `role`。为此，向 `aws/roles/:name` 这里 `:name` 是描述角色的唯一名称(比如 `aws/roles/my-role`):
```bash
vault write aws/roles/my-role policy=-<<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Stmt1426528957000",
      "Effect": "Allow",
      "Action": [
        "ec2:*"
      ],
      "Resource": [
        "*"
      ]
    }
  ]
}
EOF

# 输出
Success! Data written to: aws/roles/my-role
```

### 生成 Secret
现在，AWS secrets 引擎已经启用并配置了一个 `role`，我们可以通过从 AWS `/creds/:name`（`:name` 对应一个已经存在的 `role` name）中读取来请求 Vault 为该 `role` 生成一
个访问密钥对:
```bash
vault read aws/creds/my-role

# 输出
Key                Value
---                -----
lease_id           aws/creds/my-role/0bce0782-32aa-25ec-f61d-c026ff22106e
lease_duration     768h
lease_renewable    true
access_key         AKIAJELUDIANQGRXCTZQ
secret_key         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
security_token     <nil>
```

`access key` 和 `secret key` 现在可以用于在 AWS 中执行任何 EC2 操作。注意，这些 `key` 是新的，它们不是你先前输入的 `key`.
如果你要再次运行该命令，你会得到一个新的访问密钥对。每次从 `aws/creds/:name` 中读取数据时，Vault 就会连接到 aws 并生成一个新的 IAM 用户和密钥对。

注意输出中的 `lease_id` 字段。此值用于更新、撤销和检查。将此 `lease_id` 复制到剪贴板。注意，`lease_id` 是完整的路径，而不仅仅是末尾的 UUID。

### 撤销 Secret
Vault 将在 768 小时后自动撤销此凭据(查看上面输出中的 `lease_duration` 字段)，但我们可能希望尽早撤销它。一旦密钥被撤销，访问密钥就不再有效。

若要撤消 Secret ，使用 `vault revoke` 加上之前保存的 `lease_id`:
```bash
$ vault lease revoke aws/creds/my-role/0bce0782-32aa-25ec-f61d-c026ff22106

Success! Revoked lease: aws/creds/my-role/0bce0782-32aa-25ec-f61d-c026ff22106e
```

完成了!如果要登录到 AWS 帐户，会看到不存在 IAM 用户。如果尝试使用生成的访问键，会发现它们不再工作。

有了这样简单的动态创建和撤销，就可以开始看到使用 Dynamic Secrets 是多么容易，并确保它们只在需要的时间内存在。

## 内置的帮助

你现在已经使用了 `vault write` 和 `vault read` 来处理多个路径:`kv` secrets 引擎(带有 `kv/`)和 AWS secrets 引擎提供商(位于 `aws/`)的动态 AWS 证书。

在这两种情况下，每个 secrets 引擎的结构和用法都不同，例如 AWS 后端有一些特殊的路径，比如 `aws/config`。

Vault 有一个内置的帮助系统，而不是必须不断地记住或参考文档以确定使用什么路径。这个帮助系统可以通过 API 或命令行访问，并为任何路径生成可读的帮助。
本小节假设你已经启用了 AWS secerts 引擎在 `aws/` 路径上。使用 `vault path-help` 命令：
```bash
$ vault path-help aws

### DESCRIPTION

The AWS backend dynamically generates AWS access keys for a set of
IAM policies. The AWS access keys have a configurable lease set and
are automatically revoked at the end of the lease.

After mounting this backend, credentials to generate IAM keys must
be configured with the "root" path and policies must be written using
the "roles/" endpoints before any access keys can be generated.

### PATHS

The following paths are supported by this backend. To view help for
any of the paths below, use the help command with any route matching
the path pattern. Note that depending on the policy of your auth token,
you may or may not be able to access certain paths.

    ^config/lease$
        Configure the default lease information for generated credentials.

    ^config/root$
        Configure the root credentials that are used to manage IAM.

    ^creds/(?P<name>\w+)$
        Generate an access key pair for a specific role.

    ^roles/(?P<name>\w+)$
        Read and write IAM policies that access keys can be made for.
```
`vault path-help` 命令带上一个路径。指定 `root` 路径，会获得 secrets 引擎的概述。
注意，帮助不仅包含描述，还包含用于匹配该后端路由的精确正则表达式，以及关于路由的简要描述。

### 路径帮助
我们可以通过为单个路径寻求帮助来继续深入研究。为此，只需使用 `vault path-help` 提供与该路径的正则表达式匹配的路径。
注意，这个路径实际上不需要是正确的。例如，我们将获得以下帮助来访问 `aws/creds/my-non-existent-role`，尽管我们从未创建过这个角色:
```bash
$ vault path-help aws/creds/my-non-existent-role

Request:        creds/my-non-existent-role
Matching Route: ^creds/(?P<name>\w(([\w-.]+)?\w)?)$

Generate an access key pair for a specific role.

### PARAMETERS

    name (string)
        Name of the role

### DESCRIPTION

This path will generate a new, never before used key pair for
accessing AWS. The IAM policy used to back this key pair will be
the "name" parameter. For example, if this backend is mounted at "aws",
then "aws/creds/deploy" would generate access keys for the "deploy" role.

The access keys will have a lease associated with them. The access keys
can be revoked by using the lease ID.
```

## Authentication

到目前为止，我们还没有登录到 Vault。**在 dev 模式下启动 Vault 服务器时，它会自动将你作为具有管理权限的根用户登录。
在非 dev 设置中，必须首先进行身份验证**。

身份验证是向 Vault 用户分配身份的机制。

Vault 具有可插入的 `auth` 方法，使用最适合你组织的任何形式的 Vault 很容易进行身份验证。

### 背景

身份验证是验证用户或机器提供的信息并将其转换为匹配策略的 Vault token 的过程。理解 Vault 认证最简单的方法是将其与网站进行比较。

当用户对网站进行身份验证时，他们会输入用户名、密码，可能还有 2FA 码。这些信息是通过外部来源(很可能是数据库)进行验证的，网站会以成功或失败作为回应。
成功后，网站还返回一个签名 `cookie`，其中包含唯一标识该会话用户的 `session id`。浏览器会自动将 `cookie` 和 `session id` 携带到将来的请求中，以便对用户进行身份验证。

Vault 的行为非常相似，但它比标准网站更加灵活和可插入。Vault 支持许多不同的身份验证机制，但它们都汇入一个 `session token`，我们称之为 `Vault token`。
身份验证就是用户或机器获取 Vault 令牌的过程。

### Tokens
`Token` 身份验证在 Vault 中默认启用，不能禁用。当使用 `vault server -dev `启动开发服务器时，它会打印出你的 `root token`。`root token` 是配置 Vault 的初始访问令牌。
它具有 root 权限，因此可以在 Vault 中执行任何操作。

可以创建更多 tokens：
```bash
$ vault token create

Key                  Value
---                  -----
token                8BveWcnoQUz8fLUzTyuu0YHv
token_accessor       288UkgZjXvKPJHxR3QqzZOa4
token_duration       âˆž
token_renewable      false
token_policies       ["root"]
identity_policies    []
policies             ["root"]
```
默认情况下，这将创建当前令牌的子令牌，并且继承所有相同策略。这里** `child` 概念非常重要: 令牌总是有一个父令牌，当父令牌被撤销时，子令牌也可以在同一个操作中全部被撤销。
这使得在删除用户访问权限时很容易，也可以删除用户创建的所有子令牌的访问权限**。

使用 `token` 验证：
```bash
$ vault login rXURJUktdBdlgeOG5xkh8jAW

Success! You are now authenticated. The token information displayed below
is already stored in the token helper. You do NOT need to run "vault login"
again. Future Vault requests will automatically use this token.

Key                  Value
---                  -----
token                rXURJUktdBdlgeOG5xkh8jAW
token_accessor       4QCLf891dUg26EzTgbrHQIWS
token_duration       âˆž
token_renewable      false
token_policies       ["root"]
identity_policies    []
policies             ["root"]
```

使用 `token` 验证，它会验证令牌，并让你知道该令牌与什么访问策略相关联。

撤销创建好的 tokens：
```bash
$ vault token revoke 8BveWcnoQUz8fLUzTyuu0YHv

Success! Revoked token (if it existed)
```
`vault lease revoke` 只能用于撤销 `lease`。

使用 root token 重新登录：
```sh
$ vault login $VAULT_DEV_ROOT_TOKEN_ID
```

#### 推荐模式
实际上，操作人员不应该使用 `token create` 命令为用户或机器生成 Vault token。用户或机器应该使用 Vault 配置的 `auth` 方法(如 GitHub、LDAP、AppRole 等)
进行 Vault 身份验证。对于不能生成自己的令牌的遗留应用程序，操作人员可能需要提前创建令牌。

### Auth Methods
Vault 支持许多 `auth` 方法，但是在使用之前必须启用它们。`auth` 方法提供了灵活性。启用和配置 `auth` 方法通常由 Vault 操作人员或安全团队执行。
作为一个以人为中心的 `auth` 方法的示例，让我们通过 GitHub 进行身份验证。

首先，启用 GitHub `auth`方法：
```bash
$ vault auth enable -path=github github

Success! Enabled github auth method at: github/
```
和 secrets 引擎一样，`auth` 方法默认以其 TYPE 作为 PATH，因此 `vault auth enable github` 与上面的命令是等价的。

与在根路由器上启用的 secrets 引擎不同，`auth` 方法总是以 `auth/` 作为前缀。因此，我们刚刚启用的 GitHub `auth` 方法可以在 `auth/github` 上访问。
另一个例子：
```bash
$ vault auth enable -path=my-github github

Success! Enabled github auth method at: my-github/
```
这样就可以在 `auth/my-github` 上访问 GitHub 的 `auth` 方法。使用 `ault path-help` 了解更多关于路径的信息。

接下来，配置 GitHub `auth` 方法。每个 `auth` 方法都有不同的配置选项，所以详细信息请参阅文档。在这种情况下，最小的配置集是将团队映射到策略。
对于 GitHub，我们告诉它哪些组织用户必须是它的一部分，并将团队映射到策略
```bash
$ vault write auth/github/config organization=hashicorp

Success! Data written to: auth/github/config

$ vault write auth/github/map/teams/my-team value=default,my-policy

Success! Data written to: auth/github/map/teams/my-team
```
第一个命令配置 Vault 从 GitHub 上的 `hashicorp` 组织中拉去身份验证数据。下一个命令告诉 Vault 映射 `my-team `团队中(在 `hashicorp` 组织中)的任何用户，
以映射到策略 `default` 和 `my-policy`。这些策略还不需要存在于系统中—— Vault 在登录时只会发出警告。

作为用户，可能希望找到启用和可用的 `auth` 方法：
```bash
$ vault auth list

Path          Type      Accessor                Description
----          ----      --------                -----------
github/       github    auth_github_4e694978    n/a
my-github/    github    auth_github_2a45ccd0    n/a
token/        token     auth_token_5edaec25     token based credentials
```

要了解更多关于如何通过 CLI 对特定 `auth` 方法进行身份验证的信息，使用 `vault auth help` 命令和 `auth` 方法的 `PATH` 或 `TYPE` 一起使用：
```bash
$ vault auth help github

Usage: vault login -method=github [CONFIG K=V...]

  The GitHub auth method allows users to authenticate using a GitHub
  personal access token. Users can generate a personal access token from the
  settings page on their GitHub account.

  Authenticate using a GitHub token:

      $ vault login -method=github token=abcd1234

Configuration:

  mount=<string>
      Path where the GitHub credential method is mounted. This is usually
      provided via the -path flag in the "vault login" command, but it can be
      specified here as well. If specified here, it takes precedence over the
      value for -path. The default value is "github".

  token=<string>
      GitHub personal access token to use for authentication. If not provided,
      Vault will prompt for the value.
```

可以获得 CLI `auth`方法的帮助信息：
```bash
$ vault auth help aws

$ vault auth help userpass

$ vault auth help token
```

根据帮助输出，使用 `vault login` 命令对 GitHub 进行身份验证。输入你的
 [GitHub personal access token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/)，
Vault 将验证你的身份。
```bash
$ vault login -method=github

GitHub Personal Access Token (will be hidden):
Success! You are now authenticated. The token information displayed below
is already stored in the token helper. You do NOT need to run "vault login"
again. Future Vault requests will automatically use this token.

Key                    Value
---                    -----
token                  7efb3969-8743-880f-e234-afca6e12d790
token_accessor         f7bfb6a3-c41e-eb87-5317-88a0aad200ae
token_duration         768h
token_renewable        true
token_policies         [default my-policy]
token_meta_org         hashicorp
token_meta_username    my-user
```
如输出所示，Vault 已经在令牌助手中保存了生成的令牌，因此不需要再次运 `vault login`。但是，我们刚刚创建的这个新用户在 Vault 中没有很多权限。
继续使用 root token 重新进行身份验证:
```bash
$ vault login <initial-root-token>
```

使用带有 `-mode` 参数的 `vault token revoke` 从 `auth` 方法中撤销任何登录：
```bash
$ vault token revoke -mode path auth/github
```
或者，禁用 GitHub `auth` 方法：
```bash
$ vault auth disable github

Success! Disabled the auth method (if it existed) at: github/
```
这也会撤销该 `auth` 方法的任何登录。

## Policies
Vault 的策略控制用户可以访问的内容。在上一节中，我们了解了身份验证( `authentication` )。这一部分是关于授权( `authorization` )的。

对于身份验证，Vault 可以启用和使用多个选项或方法。Vault 对于授权和策略总是使用相同的格式。所有 `auth` 方法都将身份映射回 Vault 配置的核心策略。

一些内置的策略不能撤销。例如，`root` 和 `default` 策略是必需的策略，不能删除。**`default` 策略提供一组公共权限，默认情况下包含在所有令牌上。
`root` 策略提供一个令牌超级管理员权限**，类似于 linux 机器上的 `root` 用户。

### 策略格式
策略是用 [HCL](https://github.com/hashicorp/hcl) 编写的，但与 JSON 兼容。下面是一个策略示例:

```bash
# Normal servers have version 1 of KV mounted by default, so will need these
# paths:
path "secret/*" {
  capabilities = ["create"]
}
path "secret/foo" {
  capabilities = ["read"]
}

# Dev servers have version 2 of KV mounted by default, so will need these
# paths:
path "secret/data/*" {
  capabilities = ["create"]
}
path "secret/data/foo" {
  capabilities = ["read"]
}
```

有了这个策略，用户可以将任何 secrets 写入 `secret/`，但 `secret/foo` 除外，因为只有读访问是允许的。策略默认拒绝，因此不允许对未指定路径的任何访问。

Vault 包含一个命令，它将根据规范自动格式化策略。它还会报告语法错误：
```bash
$ vault policy fmt my-policy.hcl
```

策略格式在 API 路径上使用前缀匹配系统来确定访问控制。使用最特定的策略，或者是精确匹配，或者是最长的前缀 glob 匹配。

由于 Vault 中的所有内容都必须通过 API 访问，因此这对 Vault 的每个方面都有严格的控制，包括启用 secrets 引擎、启用 `auth` 方法、身份验证以及访问 secrets。

### 编写策略
使用命令行编写策略，要指定要上传的策略文件的路径：
```bash
$ vault policy write my-policy my-policy.hcl

Success! Uploaded policy: my-policy
```
下面是一个可以在终端复制粘贴的策略例子：
```bash
$ vault policy write my-policy -<<EOF
# Normal servers have version 1 of KV mounted by default, so will need these
# paths:
path "secret/*" {
  capabilities = ["create"]
}
path "secret/foo" {
  capabilities = ["read"]
}

# Dev servers have version 2 of KV mounted by default, so will need these
# paths:
path "secret/data/*" {
  capabilities = ["create"]
}
path "secret/data/foo" {
  capabilities = ["read"]
}
EOF
```

查看策略列表：
```bash
$ vault policy list

default
my-policy
root
```
查看策略详情：
```bash
$ vault policy read my-policy

# Normal servers have version 1 of KV mounted by default, so will need these
# paths:
path "secret/*" {
  capabilities = ["create"]
}
```

### 测试策略

要使用该策略，请创建一个令牌并将其分配给该策略：
```bash
$ vault token create -policy=my-policy

Key                  Value
---                  -----
token                Cdjlq3aR5XhfoWPLEzmwD1qL
token_accessor       3u0AvC7P3vyuBjqZKpgERuvk
token_duration       768h
token_renewable      true
token_policies       ["default" "my-policy"]
identity_policies    []
policies             ["default" "my-policy"]

$ vault login Cdjlq3aR5XhfoWPLEzmwD1qL

Success! You are now authenticated. The token information displayed below
is already stored in the token helper. You do NOT need to run "vault login"
again. Future Vault requests will automatically use this token.

Key                  Value
---                  -----
token                Cdjlq3aR5XhfoWPLEzmwD1qL
token_accessor       3u0AvC7P3vyuBjqZKpgERuvk
token_duration       767h59m5s
token_renewable      true
token_policies       ["default" "my-policy"]
identity_policies    []
policies             ["default" "my-policy"]
```

验证可以向 `secret/` 写入任何数据，但只能从 `secret/foo` 读取:
#### Dev servers
```bash
$ vault kv put secret/bar robot=beepboop

Key              Value
---              -----
created_time     2018-11-01T02:55:34.721929175Z
deletion_time    n/a
destroyed        false
version          1

$ vault kv put secret/foo robot=beepboop

Error writing data to secret/data/foo: Error making API request.

URL: PUT http://127.0.0.1:8200/v1/secret/data/foo
Code: 403. Errors:

* permission denied
```

#### Non-dev servers
```bash
$ vault kv put secret/bar robot=beepboop

Success! Data written to: secret/bar

$ vault kv put secret/foo robot=beepboop

Error writing data to secret/foo: Error making API request.

URL: PUT http://127.0.0.1:8200/v1/secret/foo
Code: 403. Errors:

* permission denied
```

### 映射策略到 `auth` 方法
Vault 本身是单个策略权限，与身份验证不同，你可以在身份验证中启用多个 `auth` 方法。任何启用的 `auth` 方法都必须将身份映射到这些核心策略。


在 `auth` 方法中使用 `vault path-help` 系统来确定映射是如何完成的，因为它是特定于每个 `auth` 方法的。例如，使用 GitHub，每个团队使用 `map/teams/<team>` 路径完成：
```bash
$ vault write auth/github/map/teams/default value=my-policy

Success! Data written to: auth/github/map/teams/default
```

对于 GitHub 来说，默认团队是默认的策略集，每个人都被分配到它所在的任何一个团队。

## 部署 Vault
部署生产环境下的 Vault。

### 配置 Vault
Vault 使用 [HCL](https://github.com/hashicorp/hcl) 文件配置。Vault 的配置文件相对简单:
```bash
storage "consul" {
  address = "127.0.0.1:8500"
  path    = "vault/"
}

listener "tcp" {
 address     = "127.0.0.1:8200"
 tls_disable = 1
}
```

这里有两个主要的配置：
- `storage` - 这是 Vault 用来存储的物理后端。开发服务器使用了 `inmem` (在内存中)，上面的例子使用了 [Consul](https://www.consul.io/)，一个更易于生产的后端。
- `listener` - 一个或多个侦听器决定 Vault 如何侦听 API 请求。上面的示例在没有 `TLS` 的情况下监听 `localhost` 端口 `8200`。设置环境变量 `VAULT_ADDR=http://127.0.0.1:8200`，
以便 VAULT 客户端在没有 TLS 的情况下连接。

现在，将上面的配置复制粘贴到一个名为 `config.hcl` 的文件中。它将配置 Vault，并期望一个 Consul 实例在本地运行。

如何启动 Consul 实例，参考 [Consul Getting Started Guide](https://www.consul.io/intro/getting-started/install.html)，安装好以后使用下面的命令启动：
```bash
$ consul agent -dev
```

### 启动 server
配置好以后，启动服务器配合 `-config` 标志，指向配置的正确路径：
```bash
$ vault server -config=config.hcl

==> Vault server configuration:

         Log Level: info
           Storage: consul
        Listener 1: tcp (addr: "127.0.0.1:8200", tls: "disabled")

==> Vault server started! Log data will stream in below:
```

Vault 输出一些关于其配置的信息，然后阻塞。这个过程应该使用资源管理器(如 `systemd` 或 `upstart`)运行。

你会注意到不能执行任何命令。我们没有任何授权信息!当第一次设置 Vault 服务器时，必须首先初始化它。

在 Linux 上，Vault 可能无法启动并报错:
```bash
$ vault server -config=example.hcl

Error initializing core: Failed to lock memory: cannot allocate memory

This usually means that the mlock syscall is not available.
Vault uses mlock to prevent memory from being swapped to
disk. This requires root privileges as well as a machine
that supports mlock. Please enable mlock on your system or
disable Vault from using it. To disable Vault from using it,
set the `disable_mlock` configuration option in your configuration
file.
```
这个问题参考 [Server Configuration](https://www.vaultproject.io/docs/configuration/index.html) 中有关 `disable_mlock` 的讨论。

### 初始化 Vault
初始化是配置 Vault 的过程。只有当服务器针对以前从未在 Vault 中使用过的新后端启动时，才会出现这种情况。在 HA 模式下运行时，每个集群一次，
而不是每个服务器一次。

在初始化过程中，生成加密密钥，创建解锁密钥，并设置初始 `root token`。要初始化 Vault，使用 `vault operator init` 初始化 Vault。
这是一个没有验证的请求，但它只适用于没有数据的新的 Vault:
```bash
$ vault operator init

Unseal Key 1: E4GnjX+VP9G50uWQNcwpCflzGAMKGR38BbQywgq4I6L8
Unseal Key 2: PYMxcCOswEYMNz7N6UW53Up6nu6y+SjAPwTJOTtkju3d
Unseal Key 3: yuJ5cSxC7tSBR5mMVJ/WJ9bfhhfGb+uwWw9FQR0JKILh
Unseal Key 4: 0vdvEFHM9PHEGMctJrl2ylHqoKQK8DLkfMU6ntmDz6jv
Unseal Key 5: cI8yglWJX+jPf/yQG7Sg6SPWzy0WyrBPvaFTOAYkPJTx

Initial Root Token: 62421926-81b9-b202-86f8-8850176c0cf3

Vault initialized with 5 key shares and a key threshold of 3. Please securely
distribute the key shares printed above. When the Vault is re-sealed,
restarted, or stopped, you must supply at least 3 of these keys to unseal it
before it can start servicing requests.

Vault does not store the generated master key. Without at least 3 key to
reconstruct the master key, Vault will remain permanently sealed!

It is possible to generate new unseal keys, provided you have a quorum of
existing unseal keys shares. See "vault operator rekey" for more information.
```

初始化输出两个非常重要的信息: `unseal keys` 和 `root token`。
保存所有的 `unseal keys` 和 `root token`，在实际的部署场景中，永远不会将这些键保存在一起。相反，你可能会使用 Vault 的 `PGP` 和 `Keybase.io` 支持
加密这些密钥与用户的 `PGP` 密钥。这可以防止一个人拥有所有的解锁密钥。有关使用 PGP、GPG 和 Keybase 的详细信息，
请参阅[有关文档](https://www.vaultproject.io/docs/concepts/pgp-gpg-keybase.html)。


## Seal/Unseal

每个初始化的 Vault 服务器都是在密封的状态下启动。从配置中，Vault 可以访问物理存储，但是它不能读取任何数据，因为它不知道如何解密它。教 Vault 如何解密数据的过程是已知的。

每次 Vault 启动的时候都会解封。它可以通过 API 和命令行完成。要解封 Vault，你必须有阈值数的 `unseal keys`。上面的输出中，注意到 `key threshold` 是 3。
这意味着要解封 Vault，需要已经生成的 5 个 `unseal key` 中的 3 个。

开始解封 Vault：
```bash
$ vault operator unseal

Unseal Key (will be hidden):
Key                Value
---                -----
Sealed             true
Total Shares       5
Unseal Progress    1/3
Unseal Nonce       786e7190-d1e2-84d2-520c-022efee5b71e
Version            (version unknown)
HA Enabled         true
HA Mode            sealed
```

在粘贴一个有效的密钥并确认之后，看到 Vault 仍然是密封的，但是已经取得了进展。Vault 知道它已经有了 3 个钥匙中的 1 个。由于算法的性质，
Vault 在达到阈值之前不知道它是否有正确的 `key`。

还要注意，解封过程是有状态的。你可以到另一台计算机，使用 `vault operator unseal`，只要它指向同一个服务器，其他计算机就可以继续解锁过程。
这对于开启过程的设计是非常重要的: 解封 Vault 需要多个人带着多把钥匙。Vault 可以从多台电脑上打开，钥匙永远不应该放在一起。一个恶意操作没有足够的 `key` 来进行。

继续使用 `vault operator unseal`解封 Vault。要解封 Vault，你必须使用三个不同的 `key`，相同的 `key` 重复将不起作用。当使用 `key` 时，只要它们是正确的，
很快就会看到这样的输出：
```bash
$ vault operator unseal

Unseal Key (will be hidden):
# ...

$ vault operator unseal

Unseal Key (will be hidden):
# ...
```

当 `Sealed` 的值变成了 `false`，Vault 就被解封了：
```bash
Key             Value
---             -----
Sealed          false <--
Total Shares    5
Version         (version unknown)
Cluster Name    vault-cluster-8a8b2c36
Cluster ID      34e94a2e-2d8f-c7cc-271d-96fd438ccc6d
HA Enabled      true
HA Mode         standby
HA Cluster      n/a
```

最后，验证 `root token`(和 `unseal key` 都在输出中):
```bash
$ vault login 14d1316e-78f6-910b-a4cc-9ba6697ec814

Success! You are now authenticated. The token information displayed below
is already stored in the token helper. You do NOT need to run "vault login"
again. Future Vault requests will automatically use this token.

Key                Value
---                -----
token              14d1316e-78f6-910b-a4cc-9ba6697ec814
token_accessor     a8bbcc57-9be6-6584-a7a6-46290962fd33
token_duration     â
token_renewable    false
token_policies     [root]
```

`root` 用户可以使用 `vault operator seal` 重新密封 Vault。如果重新密封 Vault，那么它会从内存中清除所有状态(包括加密密钥)。Vault 是安全的，并锁住访问。

## 使用带有身份验证的 HTTP APIs

除了 CLI 之外，Vault 的所有功能都可以通过 HTTP API 访问。实际上，CLI的大多数调用实际上都调用HTTP API。在某些情况下，Vault 功能不能通过 CLI 访问，只能通过 HTTP API 访问。

启动 Vault 服务器后，可以使用 `curl` 或任何其他 `http` 客户端进行 API 调用。例如，如果在 [dev mode](https://www.vaultproject.io/docs/concepts/dev-server.html) 下
启动 Vault 服务器，可以这样验证初始化状态：
```bash
$ curl http://127.0.0.1:8200/v1/sys/init

{"initialized":true}
```

### 通过 REST APIs 访问 secrets
通过它的 REST API 访问在 Vault 中的信息。例如，如果机器使用 [AppRole](https://www.vaultproject.io/docs/auth/approle.html) 进行身份验证，Vault 首先对应用程序将
进行身份验证，返回一个 `Vault API` 令牌。应用程序将使用该令牌与 Vault 通信。

这里的例子没有启用 `TLS`，但是在生产环境下，`TLS` 不应该被禁用。保存下面的内容到 `config.hcl`，并且启动 Vault server：
```bash
# 基于文件
backend "file" {
  path = "vault"
}

listener "tcp" {
  tls_disable = 1
}
```
启动：
```bash
$ vault server -config=config.hcl
```

至此，我们可以对所有交互使用 Vault API。例如，我们可以这样初始化 Vault:
```bash
$ curl \
    --request POST \
    --data '{"secret_shares": 1, "secret_threshold": 1}' \
    http://127.0.0.1:8200/v1/sys/init


{
  "keys": ["373d500274dd8eb95271cb0f868e4ded27d9afa205d1741d60bb97cd7ce2fe41"],
  "keys_base64": ["Nz1QAnTdjrlSccsPho5N7SfZr6IF0XQdYLuXzXzi/kE="],
  "root_token": "6fa4128e-8bd2-fd02-0ea8-a5e020d9b766"
}
```

这个响应包含我们的 `root token` 和 `unseal key`。可以使用 `unseal key` 来解封 Vault，并使用 `root token` 在 Vault 中执行其他需要身份验证的请求。

为了方便我们把 `root token` 保存到环境变量 `export VAULT_TOKEN=6fa4128e-8bd2-fd02-0ea8-a5e020d9b766`。

使用 `unseal key` 通过 API 来解封 Vault：
```bash
$ curl \
    --request POST \
    --data '{"key": "Nz1QAnTdjrlSccsPho5N7SfZr6IF0XQdYLuXzXzi/kE="}' \
    http://127.0.0.1:8200/v1/sys/unseal

{
  "sealed": false,
  "t": 1,
  "n": 1,
  "progress": 0,
  "nonce": "",
  "version": "1.2.3",
  "cluster_name": "vault-cluster-9d524900",
  "cluster_id": "d69ab1b0-7e9a-2523-0d05-b0bfd09caeea"
}
```

现在所有可用的 `auth` 方法可以启用和配置了。这里使用 [AppRole](https://www.vaultproject.io/docs/auth/approle.html) 验证。
开始启用 AppRole 验证
```bash
$ curl \
    --header "X-Vault-Token: $VAULT_TOKEN" \
    --request POST \
    --data '{"type": "approle"}' \
    http://127.0.0.1:8200/v1/sys/auth/approle
```

注意，启用 AppRole 端点的请求需要一个身份验证令牌。在本例中，我们将传递启动 Vault 服务器时生成的 `root token`。我们还可以
使用任何其他身份验证机制生成令牌，但为了简单起见，我们将使用 `root token`。

现在，使用所需的 [ACL 策略集](https://www.vaultproject.io/docs/concepts/policies.html)创建一个 AppRole。在下面的命令中，
指定在 AppRole `my-role` 下发布的令牌应该与 `dev-policy` 和 `my-policy`相 关联：
```bash
$ curl \
    --header "X-Vault-Token: $VAULT_TOKEN" \
    --request POST \
    --data '{"policies": ["dev-policy", "my-policy"]}' \
    http://127.0.0.1:8200/v1/auth/approle/role/my-role
```

在默认配置中，AppRole 后端需要两个很难猜到的凭证，一个 `role ID ` 和一个 `secret ID`。获取 `my-role` 的 `role ID `：
```bash
$ curl \
    --header "X-Vault-Token: $VAULT_TOKEN" \
     http://127.0.0.1:8200/v1/auth/approle/role/my-role/role-id

{
  "data": {
    "role_id": "86a32a73-1f2b-05e0-113a-dfa930145d72"
  }
}
```
创建 `my-role` 的 `secret ID`：
```bash
$ curl \
    --header "X-Vault-Token: $VAULT_TOKEN" \
    --request POST \
    http://127.0.0.1:8200/v1/auth/approle/role/my-role/secret-id

{
  "data": {
    "secret_id": "cd4b2002-3e3b-aceb-378d-5caa84dffd14",
    "secret_id_accessor": "6b9b58f6-d11a-c73c-ffa8-04a47d42716b"
  }
}
```
这两个凭证可以提供给 `login` 端点以获取新的 Vault 令牌。
```bash
$ curl \
    --request POST \
    --data '{"role_id": "86a32a73-1f2b-05e0-113a-dfa930145d72", "secret_id": "cd4b2002-3e3b-aceb-378d-5caa84dffd14"}' \
    http://127.0.0.1:8200/v1/auth/approle/login

{
  "auth": {
    "client_token": "50617721-dfb5-1916-7b13-4091e169d28c",
    "accessor": "ada8d354-47c0-5d9e-50f9-d74e6de2df9b",
    "policies": ["default", "dev-policy", "my-policy"],
    "metadata": {
      "role_name": "my-role"
    },
    "lease_duration": 2764800,
    "renewable": true
  }
}
```

这个 `client_token` 可以用作 Vault 的身份验证。这个令牌将被授权使用 `default`,`dev-policy` 和 `my-policy` 策略所包含的所有资源的特定功能。

新获得的令牌可以作为新的 VAULT 令牌导出，并使用它对 VAULT 请求进行身份验证。
```bash
$ export VAULT_TOKEN="50617721-dfb5-1916-7b13-4091e169d28c"

# 写入新的secret foo
$ curl \
    --header "X-Vault-Token: $VAULT_TOKEN" \
    --request POST \
    --data '{"bar": "baz"}' \
    http://127.0.0.1:8200/v1/secret/foo

# 读取 foo
$ curl \
    --header "X-Vault-Token: $VAULT_TOKEN" \
    http://127.0.0.1:8200/v1/secret/foo

{
  "data": {
    "bar": "baz"
  },
  "lease_duration": 2764800,
  "renewable": false,
  "request_id": "5e246671-ec05-6fc8-9f93-4fe4512f34ab"
}
```

更多 APIs 参考 [HTTP APIs 文档](https://www.vaultproject.io/api/index.html)。

## Web UI

Vault 提供了一个用户交互界面。使用 Vault UI 可以轻松地创建、读取、更新和删除 secrets、进行身份验证、解封等等。

### Dev servers
当你在 dev 模式下启动 Vault server 时，Vault UI 会自动启用。在浏览器输入 `http://127.0.0.1:8200/ui` 来访问。

输入 root token 来登录。

### Non-Dev servers
在非 dev 模式下，Vault UI 默认是不启用的。要启用 Vault UI，需要在 Vault 配置文件中设置 `ui` 选项。
```
ui = true

listener "tcp" {
  # ...
}

storage "consul" {
  # ...
}
```

Vault UI 运行的端口和 Vault server 相同。因此，必须配置至少一个监听的端口才能访问 Vault UI。

例如：
```
ui = true

listener "tcp" {
  address = "10.0.1.35:8200"

  # If bound to localhost, the Vault UI is only
  # accessible from the local machine!
  # address = "127.0.0.1:8200"
}
...
```

在这个例子中，可以从子网上的任何机器(假设没有网络防火墙)访问以下 URL: `https://10.0.1.35:8200/ui`。

### Web UI Wizard
Vault UI 有一个内置的指南，可以指导你完成各种常见 Vault 特性的操作。
