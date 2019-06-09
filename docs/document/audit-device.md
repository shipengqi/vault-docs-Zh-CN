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