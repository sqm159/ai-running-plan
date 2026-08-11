/* =========================================================================
 * Supabase 配置文件
 * -------------------------------------------------------------------------
 * 使用说明：
 *   1. 前往 https://supabase.com 注册并新建一个项目。
 *   2. 在项目控制台 -> Settings -> API 中找到：
 *        - Project URL         （形如 https://xxxxxxxxxxxx.supabase.co）
 *        - anon public key     （一长串以 eyJ 开头的字符串）
 *   3. 把下面两个字段替换为你的真实值（保留引号）。
 *   4. 在 Supabase 控制台 -> SQL Editor 中运行 schema.sql 创建数据表。
 *   5. 重新打开本页面即可使用注册/登录/数据保存功能。
 *
 * 安全说明：
 *   - anon key 是面向前端的公开密钥，配合 RLS（行级安全）策略使用，
 *     每个用户只能读写自己的数据，不会泄露他人数据。
 *   - 不要在这里填写 service_role key，那是有管理员权限的密钥，绝不能放到前端。
 * ========================================================================= */
window.SUPABASE_CONFIG = {
  url: "YOUR_SUPABASE_URL_HERE",
  anonKey: "YOUR_SUPABASE_ANON_KEY_HERE",
};

/* 应用启动时据此判断是否已完成配置；未配置时 auth 页面会给出引导提示。 */
window.SUPABASE_CONFIGURED =
  window.SUPABASE_CONFIG &&
  typeof window.SUPABASE_CONFIG.url === "string" &&
  window.SUPABASE_CONFIG.url.startsWith("http") &&
  window.SUPABASE_CONFIG.url !== "YOUR_SUPABASE_URL_HERE" &&
  typeof window.SUPABASE_CONFIG.anonKey === "string" &&
  window.SUPABASE_CONFIG.anonKey.startsWith("eyJ") &&
  window.SUPABASE_CONFIG.anonKey !== "YOUR_SUPABASE_ANON_KEY_HERE";
