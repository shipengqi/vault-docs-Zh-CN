# Auth 方法
Auth 方法是 Vault 中执行身份验证的组件，负责为用户分配标识和一组策略。

通过使用多种身份验证方法，可以使用对你的 Vault 和你的组织的适用的身份验证方法。

例如，在开发人员计算机上，[GitHub 身份验证方法]()最容易使用。 但对于服务器，[AppRole]() 方法是推荐的选择。

要了解有关身份验证的更多信息，请参阅 [authentication concepts page]()。

## Enabling/Disabling Auth Methods
可以使用 CLI 或 API 启用或禁用 Auth 方法。

```bash
$ vault auth enable userpass
```

启用后，auth 方法类似于 [secrets 引擎]()：它们挂载在 Vault 挂载表中，可以使用标准的 read/write API 进行访问和配置。 所有 auth 方法都挂载在 `auth/` 前缀下面。

默认情况下，auth 方法挂载到 `auth/<type>`。 例如，如果启用“github”，则可以在 `auth/github` 上与其进行交互。 但是，此路径是可自定义的，允许具有高级用例的用户多次挂载单个 auth 方法。

```bash
$ vault auth enable -path=my-login userpass
```

禁用 auth 方法后，将通过该方法验证的所有用户自动注销。

## AppRole Auth Method

`approle` auth 方法允许计算机或应用程序使用 Vault 定义的 `roles` 进行身份验证。 `AppRole` 的开放式设计支持各种工作流程和配置，可处理大量应用程序。 此 auth 方法面向自动化工作流程（机器和服务），对人工操作员不太有用。

“AppRole”表示一组 Vault 策略和登录约束，必须满足这些约束才能接收带有这些策略的令牌。范围可以根据需要缩小或宽泛。可以为特定计算机创建 AppRole，甚至可以为该计算机上的特定用户创建 AppRole，也可以跨机器创建服务。
成功登录所需的凭据取决于与凭据关联的 AppRole 上设置的约束。

### Authentication
#### Via the CLI
默认路径为 `/approle`。如果在其他路径上启用了此 auth 方法，请改为指定 `auth/my-path/login`。
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
默认端点是 `auth/approle/login`。如果在其他路径上启用了此 auth 方法，请使用该值而不是 `approle`。
```bash
$ curl \
    --request POST \
    --data '{"role_id":"988a9df-...","secret_id":"37b74931..."}' \
    http://127.0.0.1:8200/v1/auth/approle/login
```

响应中，`token` 在 `auth.client_token` 上：
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
必须事先配置好 Auth 方法，然后才能对用户或计算机进行身份验证。这些步骤通常由操作员或配置管理工具完成。
#### Via the CLI
1. 启用 AppRole auth 方法：
```bash
$ vault auth enable approle
```

2. 创建并命名一个 `role`：
```bash
$ vault write auth/approle/role/my-role \
    secret_id_ttl=10m \
    token_num_uses=10 \
    token_ttl=20m \
    token_max_ttl=30m \
    secret_id_num_uses=40
```

有关配置选项的完整列表，参阅 API 文档。

3. 获取这个 `AppRole` 的`RoleID`：
```bash
$ vault read auth/approle/role/my-role/role-id
role_id     db02de05-fa39-4855-059b-67221c5c2f63
```

4. 获取针对这个 `AppRole` 颁发的 `SecretID`：
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

2. 使用所需的策略集创建 AppRole：
```bash
$ curl \
    --header "X-Vault-Token: ..." \
    --request POST \
    --data '{"policies": "dev-policy,test-policy"}' \
    http://127.0.0.1:8200/v1/auth/approle/role/my-role
```

有关配置选项的完整列表，参阅 API 文档。

3. 获取这个 `AppRole` 的 `RoleID`：
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

4. 获取针对这个 `AppRole` 颁发的 `SecretID`：
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
RoleID 是一个标识符，用于选择评估其他凭据的 AppRole。 使用 AppRole auth 方法的登录端点进行身份验证时，RoleID 始终是必需的参数（通过 `role_id`）。 默认情况下，RoleID 是唯一的 UUID，
允许它们作为其他凭据信息的辅助 secrets。但是，可以将它们设置为特定值以匹配客户端的内省信息（例如，客户端的域名）。

#### SecretID

SecretID 是所有登录（通过 `secret_id`）默认所需的凭证，并且始终是加密的。（对于高级用法，可以通过 `AppRole` 的 `bind_secret_id` 参数禁用 `SecretID`，允许只知道 `RoleID` 或者匹配其他设置约束
的计算机去获取令牌）。通过 `role` 本身（Pull 模式）或通过特定的自定义值（ Push 模式）生成 128 位纯随机 UUID，可以针对 AppRole 创建 SecretID。与令牌类似，SecretID 具有使用限制，TTL 和过期等属性。

##### Pull And Push SecretID Modes
如果用于登录的 SecretID 是从 AppRole 获取的，则它在 Pull 模式下运行。 如果客户端针对 AppRole 设置“自定义” SecretID，则将其称为推送模式。推模式模仿已弃用的 `App-ID` auth方法的行为;但是，
在大多数情况下，Pull 模式是更好的方法。

#### Further Constraints

`role_id` 是 `login` 端点的必需凭据。`role_id` 指向的 AppRole 将设置约束。这决定了登录所需的其他凭据。`bind_secret_id` 约束要求在登录端点传递 `secret_id`。这个 auth方法可以支持更多约束参数，以支持各种应用程序集。 某些约束不需要凭证，但仍然强制执行登录约束。 例如，`secret_id_bound_cidrs`将仅允许来自属于AppRole上配置的CIDR块的IP地址的登录。

### API
AppRole auth 方法有完整的 HTTP API，查看更多 [AppRole API]()详情。

## GitHub Auth Method
`github` auth 方法使 Vault 可以使用 github GitHub personal access token 进行身份验证。这种身份验证方法对
直接通过 CLI 使用 Vault 的操作人员或开发人员最有用。

> Vault 不支持生成 GitHub token 的 OAuth 工作流，因此不能当做 GitHub 应用程序。因此，该方法使用 personal access token。一个重要的结果是，
任何具有 `read:org` 作用域的有效 GitHub 访问令牌都可以用于身份验证。如果这样的令牌从第三方服务中被窃取，并且攻击者能够对 Vault 进行网络调用，那么他们将能够作为
生成了访问令牌的用户进行登录。使用此方法时，最好确保 Vault 的访问限制在网络级别，而不是公共级别。如果你不能接受这些风险，你应该使用不同的方法。

### Authentication
#### Via the CLI
默认路径为 `/github`。如果在不同的路径上启用了此 auth 方法，使用 CLI 指定 `-path=/my-path`。
```bash
$ vault login -method=github token="MY_TOKEN"
```

#### Via the API
默认端点是 `auth/github/login`。如果在不同的路径上启用了此 auth 方法，请使用该值替换 `kubernetes`。
```bash
$ curl \
    --request POST \
    --data '{"token": "MY_TOKEN"}' \
    http://127.0.0.1:8200/v1/auth/github/login
```

响应中，`token` 在 `auth.client_token` 上：
```bash
{
  "auth": {
    "renewable": true,
    "lease_duration": 2764800,
    "metadata": {
      "username": "my-user",
      "org": "my-org"
    },
    "policies": [
      "default",
      "dev-policy"
    ],
    "accessor": "f93c4b2d-18b6-2b50-7a32-0fecf88237b8",
    "client_token": "1977fceb-3bfa-6c71-4d1f-b64af98ac018"
  }
}
```

### Configuration
必须事先配置好 Auth 方法，然后才能对用户或计算机进行身份验证。这些步骤通常由操作员或配置管理工具完成。

1. 启用 Github auth 方法：
```bash
$ vault auth enable github
```

2. 通过 `/config` 端点配置 Vault 与 Github 通信。
```bash
$ vault write auth/github/config organization=hashicorp
```

3. 将 GitHub 组织的 users/teams 映射到 Vault 的策略。teams 名称必须是 "slugified"
```bash
$ vault write auth/github/map/teams/dev value=dev-policy
```

在本例中，当组织 "hashicorp" 中的 team"dev" 的成员使用 GitHub personal access token 对 Vault 进行身份验证时，
将给他们一个附带 `dev-policy` 策略的令牌。

你还可以为指定的用户创建映射，使用 `map/users/<user>` ：
```sh
$ vault write auth/github/map/users/sethvargo value=sethvargo-policy
```

在本例中，除了其他的 team 策略外，还会为 GitHub 用户名为 `sethvargo` 的用户分配 `sethvargo-policy` 策略。

### API
GitHub auth 方法有完整的 HTTP API，查看更多 [GitHub auth method API]() 详情。

## Kubernetes Auth Method
kubernetes auth 方法可以通过 Vault 验证 Kubernetes Service Account Token。

### Authentication
#### Via the CLI
默认路径为 `/kubernetes`。如果在不同的路径上启用了此 auth 方法，使用 CLI 指定 `-path=/my-path`。
```bash
$ vault write auth/kubernetes/login role=demo jwt=...
```

#### Via the API
默认端点是 `auth/kubernetes/login`。如果在不同的路径上启用了此 auth 方法，请使用该值替换 `kubernetes`。
```bash
$ curl \
    --request POST \
    --data '{"jwt": "your_service_account_jwt", "role": "demo"}' \
    http://127.0.0.1:8200/v1/auth/kubernetes/login
```

响应中，`token` 在 `auth.client_token` 上：
```bash
{
  "auth": {
    "client_token": "38fe9691-e623-7238-f618-c94d4e7bc674",
    "accessor": "78e87a38-84ed-2692-538f-ca8b9f400ab3",
    "policies": [
      "default"
    ],
    "metadata": {
      "role": "demo",
      "service_account_name": "vault-auth",
      "service_account_namespace": "default",
      "service_account_secret_name": "vault-auth-token-pd21c",
      "service_account_uid": "aa9aa8ff-98d0-11e7-9bb7-0800276d99bf"
    },
    "lease_duration": 2764800,
    "renewable": true
  }
}
```

### Configuration
必须事先配置好 Auth 方法，然后才能对用户或计算机进行身份验证。这些步骤通常由操作员或配置管理工具完成。

1. 启用 Kubernetes auth 方法：
```bash
$ vault auth enable kubernetes
```

2.  通过 `/config` 端点配置 Vault 与 Kubernetes 通信。有关可用配置选项的列表，参阅 API 文档：
```bash
$ vault write auth/kubernetes/config \
    token_reviewer_jwt="reviewer_service_account_jwt" \
    kubernetes_host=https://192.168.99.100:8443 \
    kubernetes_ca_cert=@ca.crt
```

3. 创建一个指定的 role：
```bash
vault write auth/kubernetes/role/demo \
    bound_service_account_names=vault-auth \
    bound_service_account_namespaces=default \
    policies=default \
    ttl=1h
```

这个 role 授权 `default` 命名空间中的 `vault-auth` service account ，并为其提供 `default` 策略。

有关可用配置选项的列表，参阅 API 文档。


### Configuring Kubernetes
这个 auth 方法访问 [Kubernetes TokenReview API](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.10/#tokenreview-v1-authentication-k8s-io) 来验证所提供的 JWT 仍然有效。

Kubernetes 应该使用 `--service-account-lookup` 来运行。这在 Kubernetes 1.7 中默认为 `true` ，但是之前的任何版本都应该确保 Kubernetes API 服务器启动时使用了该设置。
否则，在 Kubernetes 中删除的令牌将不会被正确地撤销，并且将能够对这个 auth 方法进行身份验证。

在这个 auth 方法中使用的 Service Accounts 要可以访问 TokenReview API。如果 Kubernetes 配置了使用 RBAC 角色，则应该授予这个 Service Accounts 访问此 API 的权限。
下面的示例 ClusterRoleBinding 可用于授予这些权限:
```yaml
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: ClusterRoleBinding
metadata:
  name: role-tokenreview-binding
  namespace: default
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:auth-delegator
subjects:
- kind: ServiceAccount
  name: vault-auth
  namespace: default
```

### API
Kubernetes Auth Plugin 有完整的 HTTP API，查看更多 [API]() 详情。


## Token Auth Method
`token` 方法是内置的，并且在 `/auth/token` 路径上自动启用。它允许用户使用令牌进行身份验证，以及创建新令牌、按令牌撤销机密等等。
当任何其他 auth 方法返回一个身份标识时，Vault core 调用令牌方法为该标识创建一个新的唯一的令牌。

令牌存储还可以用来绕过任何其他 auth 方法：你可以直接创建 tokens，也可以对令牌执行各种其他操作，比如更新和撤销。

请查看专用于令牌的 [token concepts]() 页面。

### Authentication
#### Via the CLI
```sh
$ vault login token=<token>
```

#### Via the API
令牌被直接设置为 HTTP API 的头。报头应该是 `X-VAULT-TOKEN: <token>` 或 `Authorization: Bearer <token>`。

### API
Token auth 方法有完整的 HTTP API，查看更多 [Token auth method API]() 详情。

## Userpass Auth Method
`Userpass` auth 方法允许用户使用一个 username 和 password 对 Vault 进行身份验证。

username/password 组合使用 `users/`路径直接配置到 auth 方法。此方法无法从外部源读取用户名和密码。

`Userpass` auth 方法会把所有提交的用户名转化为小写，例如 `Mary` 和 `mary`是相同的条目。

### Authentication
#### Via the CLI
```bash
$ vault login -method=userpass \
    username=mitchellh \
    password=foo
```

#### Via the API
```bash
$ curl \
    --request POST \
    --data '{"password": "foo"}' \
    http://127.0.0.1:8200/v1/auth/userpass/login/mitchellh
```

响应中，`token` 在 `auth.client_token` 上：
```bash
{
  "lease_id": "",
  "renewable": false,
  "lease_duration": 0,
  "data": null,
  "auth": {
    "client_token": "c4f280f6-fdb2-18eb-89d3-589e2e834cdb",
    "policies": [
      "admins"
    ],
    "metadata": {
      "username": "mitchellh"
    },
    "lease_duration": 0,
    "renewable": false
  }
}
```

### Configuration
必须事先配置好 Auth 方法，然后才能对用户或计算机进行身份验证。这些步骤通常由操作员或配置管理工具完成。

1. 启用 Userpass auth 方法：
```bash
$ vault auth enable userpass
```

2.  配置允许认证的用户：
```bash
$ vault write auth/userpass/users/mitchellh \
    password=foo \
    policies=admins
```

这会创建一个名为 `mitchellh` 的新用户，密码为 `foo` ，该用户将与“管理员”策略相关联。这是唯一必须的配置。

### API
Userpass  auth 方法有完整的 HTTP API，查看更多 [Userpass auth method API]() 详情。