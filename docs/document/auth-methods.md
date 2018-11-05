# Auth 方法
Auth方法是Vault中执行身份验证的组件，负责为用户分配标识和一组策略。

通过使用多种身份验证方法，可以使用对你的Vault和你的组织的适用的身份验证方法。

例如，在开发人员计算机上，[GitHub身份验证方法]()最容易使用。 但对于服务器，[AppRole]()方法是推荐的选择。

要了解有关身份验证的更多信息，请参阅[authentication concepts page]()。

## Enabling/Disabling Auth Methods
可以使用CLI或API启用或禁用Auth方法。

```bash
$ vault auth enable userpass
```

启用后，auth方法类似于 [secrets 引擎]()：它们挂载在Vault挂载表中，可以使用标准的 read/write API进行访问和配置。 所有auth方法都挂载在`auth/`前缀下面。

默认情况下，auth方法挂载到`auth/<type>`。 例如，如果启用“github”，则可以在`auth/github`上与其进行交互。 但是，此路径是可自定义的，允许具有高级用例的用户多次挂载单个auth方法。

```bash
$ vault auth enable -path=my-login userpass
```

禁用auth方法后，将通过该方法验证的所有用户自动注销。

## AppRole Auth Method

`approle`auth方法允许计算机或应用程序使用Vault定义的`roles`进行身份验证。 `AppRole`的开放式设计支持各种工作流程和配置，可处理大量应用程序。 此auth方法面向自动化工作流程（机器和服务），对人工操作员不太有用。

“AppRole”表示一组Vault策略和登录约束，必须满足这些约束才能接收带有这些策略的令牌。范围可以根据需要缩小或宽泛。 可以为特定计算机创建AppRole，甚至可以为该计算机上的特定用户创建AppRole，也可以跨机器创建服务。成功登录所需的凭据取决于与凭据关联的AppRole上设置的约束。

### Authentication
#### Via the CLI
默认路径为`/approle`。 如果在其他路径上启用了此auth方法，请改为指定`auth/my-path/login`。
```bash
$ vault write auth/approle/login \
    role_id=db02de05-fa39-4855-059b-67221c5c2f63 \
    secret_id=6a174c20-f6de-a53c-74d2-6018fcceff64

Key                Value
---                -----
token              65b74ffd-842c-fd43-1386-f7d7006e520a
token_accessor     3c29bc22-5c72-11a6-f778-2bc8f48cea0e
token_duration     20m0s
token_renewable    true
token_policies     [default]
```

#### Via the API
默认端点是`auth/approle/login`。如果在其他路径上启用了此auth方法，请使用该值而不是`approle`。
```bash
$ curl \
    --request POST \
    --data '{"role_id":"988a9df-...","secret_id":"37b74931..."}' \
    http://127.0.0.1:8200/v1/auth/approle/login
```

响应中，`token`在`auth.client_token`上：
```bash
{
  "auth": {
    "renewable": true,
    "lease_duration": 2764800,
    "metadata": {},
    "policies": [
      "default",
      "dev-policy",
      "test-policy"
    ],
    "accessor": "5d7fb475-07cb-4060-c2de-1ca3fcbf0c56",
    "client_token": "98a4c7ab-b1fe-361b-ba0b-e307aacfd587"
  }
}
```

### Configuration
必须事先配置好Auth方法，然后才能对用户或计算机进行身份验证。这些步骤通常由操作员或配置管理工具完成。
#### Via the CLI
1. 启用 AppRole auth 方法：
```bash
$ vault auth enable approle
```

2. 创建并命名一个`role`：
```bash
$ vault write auth/approle/role/my-role \
    secret_id_ttl=10m \
    token_num_uses=10 \
    token_ttl=20m \
    token_max_ttl=30m \
    secret_id_num_uses=40
```

有关配置选项的完整列表，参阅API文档。

3. 获取这个`AppRole`的`RoleID`：
```bash
$ vault read auth/approle/role/my-role/role-id
role_id     db02de05-fa39-4855-059b-67221c5c2f63
```

4. 获取针对这个`AppRole`颁发的`SecretID`：
```bash
$ vault write -f auth/approle/role/my-role/secret-id
secret_id               6a174c20-f6de-a53c-74d2-6018fcceff64
secret_id_accessor      c454f7e5-996e-7230-6074-6ef26b7bcf86
```

#### Via the API
1. 启用 AppRole auth 方法：
```bash
$ curl \
    --header "X-Vault-Token: ..." \
    --request POST \
    --data '{"type": "approle"}' \
    http://127.0.0.1:8200/v1/sys/auth/approle
```

2. 使用所需的策略集创建AppRole：
```bash
$ curl \
    --header "X-Vault-Token: ..." \
    --request POST \
    --data '{"policies": "dev-policy,test-policy"}' \
    http://127.0.0.1:8200/v1/auth/approle/role/my-role
```

有关配置选项的完整列表，参阅API文档。

3. 获取这个`AppRole`的`RoleID`：
```bash
$ curl \
    --header "X-Vault-Token: ..." \
    http://127.0.0.1:8200/v1/auth/approle/role/my-role/role-id

{
  "data": {
    "role_id": "988a9dfd-ea69-4a53-6cb6-9d6b86474bba"
  }
}		
```

4. 获取针对这个`AppRole`颁发的`SecretID`：
```bash
$ curl \
    --header "X-Vault-Token: ..." \
    --request POST \
     http://127.0.0.1:8200/v1/auth/approle/role/my-role/secret-id

{
  "data": {
    "secret_id_accessor": "45946873-1d96-a9d4-678c-9229f74386a5",
    "secret_id": "37b74931-c4cd-d49a-9246-ccc62d682a25"
  }
}		 
```

### Credentials/Constraints
#### RoleID
RoleID是一个标识符，用于选择评估其他凭据的AppRole。 使用 AppRole auth方法的登录端点进行身份验证时，RoleID始终是必需的参数（通过`role_id`）。 默认情况下，RoleID是唯一的UUID，允许它们作为其他凭据信息的辅助 secrets。但是，可以将它们设置为特定值以匹配客户端的内省信息（例如，客户端的域名）。

#### SecretID

SecretID是所有登录（通过`secret_id`）默认所需的凭证，并且始终是加密的。（对于高级用法，可以通过`AppRole`的`bind_secret_id`参数禁用`SecretID`，允许只知道`RoleID`或者匹配其他设置约束的计算机去获取令牌）。 通过`role`本身（Pull 模式）或通过特定的自定义值（Push 模式）生成128位纯随机UUID，可以针对AppRole创建SecretID。 与令牌类似，SecretID具有使用限制，TTL和过期等属性。

##### Pull And Push SecretID Modes
如果用于登录的SecretID是从AppRole获取的，则它在Pull模式下运行。 如果客户端针对AppRole设置“自定义”SecretID，则将其称为推送模式。推模式模仿已弃用的`App-ID` auth方法的行为; 但是，在大多数情况下，Pull 模式是更好的方法。

#### Further Constraints

`role_id`是`login`端点的必需凭据。`role_id`指向的AppRole将设置约束。这决定了登录所需的其他凭据。`bind_secret_id`约束要求在登录端点传递`secret_id`。这个 auth方法可以支持更多约束参数，以支持各种应用程序集。 某些约束不需要凭证，但仍然强制执行登录约束。 例如，`secret_id_bound_cidrs`将仅允许来自属于AppRole上配置的CIDR块的IP地址的登录。

### API
AppRole auth 方法有完整的 HTTP API，查看更多[AppRole API]()详情。