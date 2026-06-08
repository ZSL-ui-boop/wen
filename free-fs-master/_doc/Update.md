# Free-Fs Change Log

## V2.3.0 @2026-04-14

### 🎉 重大更新

这是一个重大版本更新，引入了工作空间和团队协作功能，让 Free FS 从个人网盘升级为企业级团队协作平台！

### ✨ 新增功能

#### 工作空间系统
- 多工作空间支持，实现团队与个人文件隔离
- 工作空间创建、管理、删除
- 工作空间详情查询
- 工作空间 slug 唯一性校验
- 工作空间成员数量统计

#### 团队协作
- 成员邀请系统
  - 邮件邀请功能
  - 邀请链接生成
  - 邀请令牌验证
  - 邀请过期机制（默认 72 小时）
  - 邀请状态管理（待接受、已接受、已过期、已取消）
- 成员管理
  - 成员列表查询（分页）
  - 成员角色更新
  - 成员移除
  - 成员权限控制
- 角色权限系统
  - 角色创建与管理
  - 角色权限分配
  - 基于角色的访问控制（RBAC）

#### 国际化支持
- 完整的中英文双语支持
- 可扩展的国际化框架
- 前后端统一的国际化方案
- 支持动态语言切换

#### 认证增强
- 邮箱验证码登录
  - 验证码发送接口
  - 验证码校验登录
  - 支持用户名或邮箱登录
- 邮件通知系统
  - 验证码邮件模板
  - 邀请邮件模板
  - 异步邮件发送

#### 邀请流程
- 新用户注册自动加入工作空间
  - 通过邀请令牌注册
  - 自动验证邮箱匹配
  - 自动创建成员关系
- 已有用户直接加入
  - 邮箱验证
  - 一键接受邀请
  - 自动更新成员数量

### 🔧 技术改进

#### 架构优化
- 工作空间上下文管理
  - ThreadLocal 存储当前工作空间
  - 请求拦截器自动注入
  - 请求结束自动清理
- 工作空间 ID 传递
  - 支持请求头传递（推荐）
  - 支持请求参数传递（用于下载等场景）
  - 优先级：请求头 > 请求参数

#### 拦截器增强
- WorkspaceInterceptor 工作空间拦截器
  - 自动提取工作空间 ID
  - 验证用户成员身份
  - 白名单机制
  - 支持双重获取方式

#### 数据库优化
- 新增表结构
  - `sys_workspace` - 工作空间表
  - `sys_workspace_member` - 工作空间成员表
  - `sys_workspace_invitation` - 工作空间邀请表
  - `sys_role` - 角色表
- 索引优化
  - 邀请令牌唯一索引
  - 工作空间和邮箱组合索引
  - 状态和过期时间组合索引

#### 配置管理
- 应用配置类 `AppProperties`
  - 前端地址配置
  - 支持环境变量覆盖
- 安全配置更新
  - 邀请接口公开访问
  - 工作空间拦截器白名单

### 🐛 Bug 修复

- 修复邮箱验证码登录缺少实现的问题
- 修复工作空间拦截器拦截邀请接口的问题
- 修复 VO 转换器缺少字段映射的问题
- 修复数据库缺少 `accepted_at` 字段的问题

### 📝 文档更新

- 新增工作空间使用指南
- 新增邀请功能实现文档
- 新增工作空间 ID 使用说明
- 新增前端邀请功能实现指南
- 新增快速修复指南
- 新增部署检查清单
- 更新 README 版本说明
- 更新 API 接口文档

### 🔄 API 变更

#### 新增接口

**工作空间管理**
- `GET /apis/workspace/list` - 获取用户工作空间列表
- `POST /apis/workspace` - 创建工作空间
- `GET /apis/workspace/current` - 获取当前工作空间详情
- `PUT /apis/workspace` - 更新工作空间信息
- `DELETE /apis/workspace` - 删除工作空间
- `GET /apis/workspace/check-slug` - 检查 slug 可用性

**成员管理**
- `GET /apis/workspace/members` - 分页查询工作空间成员
- `PUT /apis/workspace/members/{userId}/role` - 更新成员角色
- `DELETE /apis/workspace/members/{userId}` - 移除成员

**邀请管理**
- `GET /apis/workspace/invitations` - 获取邀请列表
- `POST /apis/workspace/invitations` - 创建邀请
- `DELETE /apis/workspace/invitations/{id}` - 取消邀请
- `GET /apis/invitation/verify/{token}` - 验证邀请令牌（公开）
- `POST /apis/invitation/accept` - 接受邀请

**认证**
- `POST /apis/auth/login/email-code` - 发送登录验证码

#### 接口变更

- 所有需要工作空间上下文的接口需要传递 `X-Workspace-Id`
  - 请求头方式：`X-Workspace-Id: workspace-id`
  - 请求参数方式：`?X-Workspace-Id=workspace-id`

### 🗄️ 数据库迁移

#### 必须执行的 SQL

```sql
-- 添加邀请表的 accepted_at 字段
ALTER TABLE `sys_workspace_invitation` 
ADD COLUMN `accepted_at` DATETIME NULL COMMENT '接受时间' AFTER `expires_at`;

-- 创建索引（可选，优化性能）
CREATE UNIQUE INDEX idx_invitation_token ON sys_workspace_invitation(token);
CREATE INDEX idx_invitation_workspace_email ON sys_workspace_invitation(workspace_id, email);
CREATE INDEX idx_invitation_status_expires ON sys_workspace_invitation(status, expires_at);
```

### ⚙️ 配置变更

#### application.yml 新增配置

```yaml
# 应用配置
app:
  frontend:
    url: http://localhost:3000  # 前端地址，用于生成邀请链接

# 安全配置
security:
  excludes:
    - /apis/invitation/verify/**  # 邀请验证接口
```

### 📦 依赖更新

无重大依赖更新

### ⚠️ 破坏性变更

- **工作空间 ID 必传**：除白名单接口外，所有接口都需要传递工作空间 ID
- **数据隔离**：文件、分享等数据现在按工作空间隔离
- **权限变更**：基于工作空间的权限控制

### 🔜 下一步计划

- [ ] 工作空间配额管理
- [ ] 工作空间模板
- [ ] 更细粒度的权限控制
- [ ] 工作空间统计报表
- [ ] 审计日志
- [ ] 工作空间转让
- [ ] 批量邀请
- [ ] 邀请链接短链

---

## V2.2.1 @2026-03-25

- 优化：简化LibreOffice内置包文件;
- 优化：优化预览架构，LibreOffice增加虚拟线程预览队列，防止系统奔溃;
- 优化：优化部分代码;
- 重构：重构压缩包预览，采用sevenzipjbinding实现，完美支持：zip", "rar", "7z", "tar", "gzip"等压缩包类型；
- 重构：重构首页数据结构与以及api；

## V2.2.0 @2026-03-13

### 核心架构升级

- Java 生态跨代演进：项目 JDK 版本由 `17` 升级至 `JDK 25`（2.1.1 版本为 JDK 17 的最后支持版本），支持更高效的语言特性。
- Spring Boot 核心重构：全面升级至 `Spring Boot 4.0.3`，紧跟官方最新标准 。
- Web 服务器变更：正式移除 Undertow（因 Spring Boot 4.x 官方已不再支持），系统已无缝切换至 Tomcat 默认应用服务器 。
- 依赖库全面升级：

| 组件 | 升级后版本 |
| :--- | :--- |
| SpringBoot| 4.0.3  |
| Sa-Token | 1.45.0  |
| Mybatis Flex | 1.11.6  |
| HikariCP | 7.0.2  |
| Jackson | 全面重构至 Jackson 3 (含包名与配置迁移)  |
| Hutool | 5.8.28  |
| SpringDoc | 3.0.2  |
| common-lang3| 3.20.0  |
| common-io| 2.21.0  |

### 性能重构：虚拟线程时代

- 全面异步化：系统现已全面启用 Java 虚拟线程 (Virtual Threads) 。
- 场景覆盖：包括异步任务、定时任务以及所有经 `@Async` 修饰的函数，极大提升了在高并发文件处理场景下的系统吞吐量与资源利用率 。

### 新增功能与优化

- 文件预览安全增强：新增预览独立 Token 认证机制，有效实现防盗链，确保资源访问安全性 。
- 文件预览扩展：新增对常见压缩包文件如 `zip` 、`7z`、`tar` 文件等预览支持，支持嵌套预览预览，压缩包内的子文件。
- 多云存储扩展：新增对 华为云 OBS (Object Storage Service) 的原生支持，提供更丰富的外链存储选择 。
- 兼容性修复：针对 Spring Boot 4 升级过程中引发的各项配置与底层协议问题进行了全面修复与压测 。

### ⚠️ 升级指南

- 环境要求：请确保运行环境已安装 JDK 21，旧版 JDK 将无法启动此版本 。
- 配置迁移：由于 Jackson 升级至 3.x，若有自定义序列化逻辑，请检查包名引用是否已由旧版迁移至新版 。
- Docker 部署：建议使用支持 JDK 21 的基础镜像（如 ubuntu:24.04 或 debian:12 自行安装 JRE），并注意在启动参数中添加 --enable-native-access=ALL-UNNAMED 以兼容部分底层库调用。


## V2.0.3 @2026-01-18

- bug：修复存储配置修改不立即生效问题
- bug：修复云存储分片上传失败问题
    - 移除前端调用合并接口合并文件逻辑，合并逻辑迁移到服务端自动合并。
    - 引入分布式锁，解决云存储分片上传时，文件合并的资源竞态问题。
- bug：修复前端刷新或切换路由导致的sse连接断开无法重连问题
    - 优化服务端sse重连逻辑
    - 新增 SSE 连接的心跳机制
    - 改进了连接断开的处理逻辑
    - 增强了错误事件推送的可靠性
- bug：修复前端文件上传偶发上传完成后页面未刷新列表以及弹窗提醒问题
- 优化：优化服务端错误信息用户友好化返回
- 优化：移除RequestLoggingAspect减少了不必要的日志输出，提升系统性能
- 优化：优化一部分调试日志

## V2.0.2 @2026-01-14

- 新增: 文件列表新增文件右键菜单
- 新增: 文件列表新增文件双击预览
- 优化: 优化文件列表视图切换
- 优化: 移除Redisson相关支持，简化Redis的配置


## V2.0.1 @2026-01-12
- 新增: 新增 `@StoragePlugin` 注解，支持声明式定义插件元数据
- 新增: 新增存储插件自动注册功能，应用启动时自动同步插件信息到数据库
- 新增: 新增 `StoragePluginMetadata` DTO，统一管理插件元数据
- 新增: `TEXT`文本类型预览，包含`TXT`、`LOG`、`INI`、`PROPERTIES`、`YAML`、`YML`、`CONF`
- 重构: 重构 `StoragePluginRegistry`，基于注解验证和加载插件
- 重构: 简化 `IStorageOperationService` 接口，移除 `getPlatformIdentifier()` 和 `getConfigSchema()` 方法
- 废弃: 废弃 `StoragePlatformIdentifierEnum` 枚举类，改用 `@StoragePlugin` 注解
- 优化: 统一使用 `StorageUtils.LOCAL_PLATFORM_IDENTIFIER` 常量管理 Local 标识符
- 优化: Local 存储插件简化配置，仅保留必要的注解属性
> **升级注意**: 自定义存储插件需要添加 `@StoragePlugin` 注解才能被系统识别，详见文档。

## v2.0.0-alpha (2026-01-05)

新特性

- 脱胎换骨，全新架构升级
- 支持多存储平台（本地、MinIO、阿里云 OSS 等各类S3体系云存储平台）
- 分片上传 + 断点续传 - 支持 TB 级大文件上传，网络中断后可继续上传
- 秒传功能 - 基于 MD5 双重校验，相同文件秒级完成
- 插件化存储 - SPI 机制热插拔，5 分钟接入一个新存储平台
- 模块化架构 - 清晰的分层设计，易于维护和扩展
- 安全可靠 - 集成SaToken做API认证、文件完整性校验
- 响应式前端，多端适配

## V1.2.6 @2024-07-26
- 升级: `Mybatis-Flex`版本升级到`1.9.4`
- 新增: 新增对`AWS S3`存储平台的支持
- 优化: 优化了项目的部分代码

## V1.2.5 @2024-06-11
- 升级: `SpringBoot`版本升级到`3.3.0`
- 升级: 项目`JDK`版本由1.8升级到17（1.8分支保留，但后续不在维护）
- 升级: `Sa-Token`版本升级到`1.38.0`
- 升级: `Fastjson2`版本升级到`2.0.51`
- 升级: `Hutool`版本升级到`5.8.28`
- 重构: 重构了项目的代码结构，分层更加明确和清晰
- 新增: 新增了对`Minio`存储平台的支持
- 替换: 使用`Mybatis-Flex`替换了`Mybatis-Plus`作为项目的ORM框架
- 替换: 替换了`Mysql`驱动包以支持`Mysql 8.0`以上版本
- 优化: 优化了项目的部分代码，提升了代码的可读性和可维护性
- 移除: 移除了`验证码`的功能
- 修复: 修复多层的文件夹读取时，文件夹为空的问题
- 修复: 修复`SpringBoot3.x`下，`JustAuth`第三方登录Bean装配失败问题



应该优化存储平台，一个用户针对某个存储平台可以配置多个配置，因为存储桶可能不同
