# Audit Devices
## Overview

审计设备是 Vault 保存所有请求和响应详细日志的组件。因为 Vault 的每个操作都是一个 API 请求/响应，所以审计日志包含与 Vault 的每个经过身份验证的交互，
包括错误。

可以启用多个审计设备，Vault 将向这每个设备发送审计日志。这不仅允许拥有一个冗余副本，而且还允许拥有第二个副本，以防第一个副本被篡改。、

### Format
审计日志中的每一行都是一个 JSON 对象。`type` 字段指定对象的类型。目前，只存在两种类型: `request` 和 `response`。这一行包含任何给定请求和响应的所有信息。
默认情况下，所有敏感信息在记录到审计日志之前都要先进行 hash。

### Sensitive Information
审计日志包含了与 Vault 每次交互的完整请求和响应对象。可以使用分配给每个请求的唯一标识符来匹配请求和响应。请求中的数据和响应中的数据(包括 secrets 和 tokens )将
加 salt 并使用 `HMAC-SHA256` 进行散列。

散列的目的是使 secrets 不在审计日志中以明文形式显示。但是，你仍然可以通过自己生成 HMACs 来检查 secrets 的 value。可以通过审计设备的 hash 函数和 salt
并使用 `/sys/audit-hash` API 来完成(有关详细信息，请参阅文档)。

### Enabling/Disabling Audit Devices
首次初始化 Vault 服务器时，默认不启用审计。root 用户必须使用 `vault audit enable` 启用审计设备。

当启用审计设备时，可以将选项传递给它来配置它。例如，下面的命令启用文件审计设备:
```sh
$ vault audit enable file file_path=/var/log/vault_audit.log
```

上面的命令，传入了 `file_path` 参数来指定审计日志写入的文件路径。每个审计设备都有自己的一组参数。有关详细信息，请参阅文档。
当审计设备被禁用时，会立即停止接收日志。存储的现有日志不会受到影响。

### Blocked Audit Devices
如果启用了任意审计设备，在完成一个 Vault 请求之前，Vault 要求至少要有一个持久化日志。

> 如果你只启用了一个审计设备，并且它正在阻塞(网络阻塞等)，那么 Vault 将不响应。Vault 不会完成任何请求直到在审计设备可以写入。

如果你有多个审计设备，那么只要有一个审计设备可以保存日志，Vault 就会完成请求。

如果审计设备被阻塞，Vault 将不会响应请求，因为审计日志非常重要，忽略被阻塞的请求容易被攻击。一定要**确保审计设备不会阻塞**。

### API
Audit devices 方法有完整的 HTTP API，查看更多 [Audit devices API]() 详情。

## File Audit Device
`file` 审计设备将审计日志写入文件。这是一个非常简单的审计设备: 将日志附加到文件中。

该设备目前不支持任何 log rotation （日志滚动）。已经有非常稳定且功能丰富的 log rotation 工具，因此建议使用现有的工具。

向 Vault 进程发送 `SIGHUP` 将导致文件审计设备关闭和重新打开它们的底层文件，这有助于满足 log rotation 的需要。

### Examples
在默认的路径上启用：
```sh
$ vault audit enable file file_path=/var/log/vault_audit.log
```

在不同的路径上启用。可以启用审计设备的多个副本:
```sh
$ vault audit enable -path="vault_audit_1" file file_path=/home/user/vault_audit.log
```

启用 `stdout` 上的日志。这在容器中运行时非常有用:
```sh
$ vault audit enable file file_path=stdout
```

### Configuration
注意 `audit enable` 命令选项和文件后端配置选项之间的区别。使用 `vault audit enable -help` 查看命令选项。下面是后端可用的配置选项。

- `file_path` `(string: <required>)` - 将写入审计日志的路径。如果在给定路径上已经存在一个文件，审计后端将追加到该文件。有一些特殊的关键词:
  - `stdout` 将审计日志写到标准输出
  - `discard` 写入输出(在测试场景中非常有用)
- `log_raw` `bool: false` - 如果启用，log 不会对敏感信息 hash。
- `hmac_accessor` `(bool: true)` - 如果启用，会对 token 进行 hash。
- `mode` `(string: "0600")` - 包含了表示文件模式位模式的八进制数的字符串，类似 `chmod`。设置为 `0000` 以防止 Vault 修改文件模式。
- `format` `(string: "json")` - 允许选择输出格式。有效值是 `json` 和 `jsonx` ，将普通日志条目格式化为 XML。
- `prefix` `(string: "")` - 在实际日志行之前写入的自定义的字符串前缀。

## Syslog Audit Device
`syslog` 审计设备将审计日志写入 syslog。

目前不支持可配置的 syslog 目的地，并且总是发送到本地代理。此设备仅在 Unix 系统上受支持，如果任何备用 Vault 实例不支持该设备，则不应启用该设备。

> 某些操作生成的审计消息可能非常大，并且可能比 [maximum-size single UDP packet](https://tools.ietf.org/html/rfc5426#section-3.1) 还要大。
如果可能，使用的 syslog 守护进程，配置一个 TCP 侦听器。否则，请考虑使用 `file` 后端，并将 `syslog` 配置为从文件中读取条目。或者，
同时启用 `file` 和 `syslog`，以便特定消息不能直接写入到 `syslog`，不会导致 Vault 被阻塞。

### Examples
`syslog` 审计设备可以使用下面的命令启用：
```sh
$ vault audit enable syslog
```

通过 `K=V` 对 提供配置参数:
```sh
$ vault audit enable syslog tag="vault" facility="AUTH"
```

### Configuration

- `facility` `(string: "AUTH")` - 要使用的 syslog 工具。
- `tag` `(string: "vault")` - 要使用的 syslog 标签。
- `log_raw` `bool: false` - 如果启用，log 不会对敏感信息 hash。
- `hmac_accessor` `(bool: true)` - 如果启用，会对 token 进行 hash。
- `mode` `(string: "0600")` - 包含了表示文件模式位模式的八进制数的字符串，类似 `chmod`。设置为 `0000` 以防止 Vault 修改文件模式。
- `format` `(string: "json")` - 允许选择输出格式。有效值是 `json` 和 `jsonx` ，将普通日志条目格式化为 XML。
- `prefix` `(string: "")` - 在实际日志行之前写入的自定义的字符串前缀。

## Socket Audit Device
`socket` 审计设备写入 TCP、UDP 或 UNIX 套接字。

> 由于该设备中使用的底层协议的性质，存在这样一种情况，当到套接字的连接丢失时，日志中可以省略一个审计条目，而请求仍然会成功。
将此设备与另一个审计设备一起使用将有助于提高准确性，但如果审计日志需要保证，则不应使用套接字设备。

### Enabling
在默认的路径上启用：
```sh
$ vault audit enable socket
```

通过 `K=V` 对 提供配置参数:
```sh
$ vault audit enable socket address=127.0.0.1:9090 socket_type=tcp
```

### Configuration

- `address` `(string: "")` - 要使用的套接字服务器地址。例 `127.0.0.1:9090` 或 `/tmp/audit.sock`。
- `socket_type` `(string: "tcp")` - 要使用的套接字类型，可以接受任何与 [net.Dial](https://golang.org/pkg/net/#Dial) 兼容的类型。
- `log_raw` `bool: false` - 如果启用，log 不会对敏感信息 hash。
- `hmac_accessor` `(bool: true)` - 如果启用，会对 token 进行 hash。
- `mode` `(string: "0600")` - 包含了表示文件模式位模式的八进制数的字符串，类似 `chmod`。设置为 `0000` 以防止 Vault 修改文件模式。
- `format` `(string: "json")` - 允许选择输出格式。有效值是 `json` 和 `jsonx` ，将普通日志条目格式化为 XML。
- `prefix` `(string: "")` - 在实际日志行之前写入的自定义的字符串前缀。