# vault-docs-Zh-CN
HashiCorp Vault 中文文档

欢迎来到 HashiCorp Vault 介绍指南!本指南是开始使用 Vault 的最佳地点。本指南涵盖了Vault 是什么，它可以解决什么问题，它如何与现有软件进行比较，
并包含了使用 Vault 的快速入门。

## 什么是 Vault？
Vault 是一个为了安全访问 secrets 的工具。一个 secret 可以是你想要严格控制访问的任何东西，例如 API密钥、密码或证书。Vault 提供了对任何 secret 的统一接口，
同时提供严格的访问控制和并记录详细的审计日志。

现代系统需要访问大量 secrets: 数据库凭证、用于外部服务的API密钥、面向服务的体系结构通信凭证等等。了解谁正在访问什么 secret 已经变得非常困难，而且是特定于平台的。
如果没有定制化的解决方案，添加密钥滚动、安全存储和详细审计日志几乎是不可能的。这是 Vault 介入的地方。

Vault 的主要特性：
- **Secure Secret Storage**：任意键/值对 secrets 可以存储在 Vaul t中。Vault 在将 secrets 写入持久存储之前对其进行加密，因此访问原始存储并不足以
获取 secrets 。Vault可以写入磁盘、[Consul](https://www.consul.io/)等等。
- **Dynamic Secrets**：Vault 可以为某些系统(如 AWS 或SQL数据库)按需生成 secrets。例如，当应用程序需要访问 S3 bucket时，它会向 Vault 查询凭证，
Vault 将根据需要生成具有有效权限的AWS密钥对。在创建了这些动态 secrets 之后，Vault也会在租约到期后自动撤销它们。
- **Data Encryption**：Vault 可以加密和解密数据而不需要存储它。这允许安全团队定义加密参数，开发人员无需设计自己的加密方法就可以将加密数据存储在SQL之类的位置。
- **Leasing and Renewal**：Vault 中的所有 secrets 都有相关的租约。在租约结束时，Vault 会自动撤销这个 secret。客户可以通过内置的更新 API 更新租约。
- **Revocation**：Vault 内置支持 secrets 撤销。Vault不仅可以撤销单个 secret，还可以撤销一个 secrets 树，例如，由特定用户读取的所有 secrets，
或特定类型的所有 secrets。


查看[HashiCorp Vault 中文文档](https://github.com/shipengqi/vault-docs-Zh-CN)。