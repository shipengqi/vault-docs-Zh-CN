# Secrets 引擎
## PKI Secrets Engine
PKI secrets 引擎生成动态X.509证书。使用这个 secrets 引擎，服务可以获得证书，而不需要手动生成私钥和CSR，提交到CA，并等待验证和签名完成。
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
默认情况下，secrets 引擎将安装在引擎名称同名的路径上。要在不同路径上启用 secrets 引擎，使用`-path`参数。

2. 调整 secrets 引擎，增加 TTL。 默认值30天可能太短，因此将其增加到1年：
```bash
$ vault secrets tune -max-lease-ttl=8760h pki
Success! Tuned the secrets engine at: pki/
```

注意，这只是配置这个 secrets 引擎的全局的最大值。每个角色可以把每个证书的 TTL 限制为更短。

3. 配置 CA 证书和私钥。 Vault 可以接受现有密钥对，也可以生成自己的自签名根。通常，我们建议将**根CA**保留在Vault之外，并为 Vault 提供签名的中间CA。
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

返回的证书纯粹是提供信息。 私钥安全地存储在Vault内部。

4. 更新CRL位置并颁发证书。 这些值可以在以后更新。
```bash
$ vault write pki/config/urls \
    issuing_certificates="http://127.0.0.1:8200/v1/pki/ca" \
    crl_distribution_points="http://127.0.0.1:8200/v1/pki/crl"
Success! Data written to: pki/config/urls
```

5. 配置一个`role`，在 Vault 中的映射一个名字到生成证书的过程中。 当用户或计算机生成凭据时，将根据此角色生成凭据：
```bash
$ vault write pki/roles/my-role \
    allowed_domains=my-website.com \
    allow_subdomains=true \
    max_ttl=72h
Success! Data written to: pki/roles/my-role
```

### Usage

配置好 secrets 引擎并且用户或者计算机有了一个一定权限的`Vault token`，就可以生成凭据。

1. 通过写入`/issue`端点，并带上`role name`，来生成新凭据：
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

输出中会包含一个动态生成的私钥和证书，它对应了给定的`role`，并在 72h 到期（由我们的`role`定义决定）。为了简化自动化，还会返回`issuing_ca`和信任链。

### Considerations

#### Be Careful with Root CAs
#### One CA Certificate, One Secrets Engine
#### Keep certificate lifetimes short, for CRL's sake
#### You must configure issuing/CRL/OCSP information in advance
#### Safe Minimums
#### Token Lifetimes and Revocation
### Quick Start
#### Mount the backend
#### Configure a CA certificate
#### Set URL configuration
#### Configure a role
#### Issue Certificates
### Setting Up Intermediate CA
#### Mount the backend
#### Configure an Intermediate CA
#### Set URL configuration
#### Configure a role
#### Issue Certificates
### API