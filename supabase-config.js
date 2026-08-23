/* =========================================================================
 * Supabase 配置文件
 * -------------------------------------------------------------------------
 * 使用说明：
 *   1. 前往 https://supabase.com 注册并新建一个项目。
 *   2. 在项目控制台 -> Settings -> API Keys 中找到：
 *        - Project URL          （形如 https://xxxxxxxxxxxx.supabase.co）
 *        - Publishable key      （新版：sb_publishable_ 开头；旧版：eyJ 开头）
 *                              （不要复制 Secret key / service_role）
 *   3. 把下面两个字段替换为你的真实值（保留引号）。
 *   4. 在 Supabase 控制台 -> SQL Editor 中运行 schema.sql 创建数据表。
 *   5. 重新打开本页面即可使用注册/登录/数据保存功能。
 *
 * 安全说明：
 *   - Publishable key（anon key）是面向前端的公开密钥，配合 RLS（行级安全）
 *     策略使用，每个用户只能读写自己的数据，不会泄露他人数据。
 *   - 不要在这里填写 Secret key / service_role key，那是有管理员权限的密钥，
 *     绝不能放到前端。
 * ========================================================================= */
window.SUPABASE_CONFIG = {
  url: "https://uozozsvxejgbhvoposey.supabase.co",
  anonKey: "sb_publishable_4OCQ5tJD8G59ejBYwy-kpw_n_N1XkUE",
};

/* 应用启动时据此判断是否已完成配置；未配置时 auth 页面会给出引导提示。
 * 兼容两种 key 格式：
 *   新版 Supabase：sb_publishable_  开头
 *   旧版 Supabase：eyJ             开头（JWT）
 */
window.SUPABASE_CONFIGURED = (function () {
  var cfg = window.SUPABASE_CONFIG;
  if (!cfg) return false;
  var urlOk =
    typeof cfg.url === "string" &&
    cfg.url.startsWith("http") &&
    cfg.url !== "YOUR_SUPABASE_URL_HERE";
  var keyOk =
    typeof cfg.anonKey === "string" &&
    cfg.anonKey !== "YOUR_SUPABASE_ANON_KEY_HERE" &&
    (cfg.anonKey.startsWith("sb_publishable_") || cfg.anonKey.startsWith("eyJ"));
  return urlOk && keyOk;
})();

/* 手机号验证码 + 微信登录的 Cloudflare Worker 地址。
 * 例：https://nextlap-auth.你的账号.workers.dev
 * 还没部署登录服务时保持空字符串，页面会提示尚未开通。
 */
window.PHONE_WORKER_URL = "https://nextlap-auth.chenghongying83.workers.dev";
