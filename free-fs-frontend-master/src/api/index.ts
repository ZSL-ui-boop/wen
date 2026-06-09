/**
 * API 模块统一导出入口
 *
 * 聚合各业务域 API（admin、role、permission、user、file、transfer、home、share、workspace）
 * 及底层 request 封装，供业务层统一 import。
 */
export * from './admin'
export * from './role'
export * from './permission'
export * from './user'
export * from './file'
export * from './transfer'
export * from './home'
export * from './share'
export * from './workspace'
export { request } from './request'
