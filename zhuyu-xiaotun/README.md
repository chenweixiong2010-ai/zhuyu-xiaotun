# 知遇小豚 - 真诚交友平台

一个温馨、简洁的约会交友网站，专为中国用户设计。

## 功能特点

- ✅ 用户发布交友卡片（昵称、年龄、城市、自我介绍、期待 TA、微信号）
- ✅ 首页卡片列表，按最新发布排序
- ✅ 按城市和性别筛选
- ✅ 点赞/收藏功能
- ✅ VIP 会员系统（无限查看微信号、卡片置顶）
- ✅ 每日免费解锁 2 个微信号
- ✅ 分享解锁机制（分享 1 次解锁 1 个，分享 3 次得 1 天 VIP）
- ✅ 邀请好友奖励（邀请 3 人得 7 天 VIP）
- ✅ 移动端友好设计

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (原生)
- **后端 & 数据库**: Supabase (PostgreSQL)
- **托管**: Vercel / Netlify (静态托管)

## 快速开始

### 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com) 并注册账号
2. 创建新项目，选择靠近您的区域
3. 等待项目创建完成

### 2. 配置数据库

在 Supabase 控制台执行以下操作：

1. 进入 **SQL Editor** 页面
2. 将 `supabase-schema.sql` 文件的全部内容复制并执行
3. 确认所有表和函数创建成功

### 3. 获取 API 密钥

1. 进入 **Settings** → **API**
2. 复制以下两个值：
   - **Project URL** (例如：`https://xxxxx.supabase.co`)
   - **anon/public key** (以 `eyJ` 开头的长字符串)

### 4. 配置前端

编辑 `config.js` 文件：

```javascript
const SUPABASE_CONFIG = {
    url: 'https://你的项目.supabase.co',
    key: '你的 anon key'
};
```

### 5. 添加 Supabase JS 客户端

在 `index.html` 的 `<head>` 标签内添加（在 `</head>` 之前）：

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

或者修改 `index.html` 末尾的 script 引入顺序，确保 Supabase JS 在 `app.js` 之前加载。

### 6. 部署到 Vercel

```bash
# 安装 Vercel CLI (如未安装)
npm i -g vercel

# 进入项目目录
cd zhuyu-xiaotun

# 部署
vercel
```

按照提示完成部署即可。

### 7. 部署到 Netlify

```bash
# 安装 Netlify CLI (如未安装)
npm install -g netlify-cli

# 进入项目目录
cd zhuyu-xiaotun

# 部署
netlify deploy --prod
```

## 目录结构

```
zhuyu-xiaotun/
├── index.html          # 主页面
├── style.css           # 样式文件
├── app.js              # 前端逻辑
├── config.js           # 配置文件（填入 Supabase 信息）
├── supabase-schema.sql # 数据库建表脚本
└── README.md           # 说明文档
```

## 数据库表说明

| 表名 | 说明 |
|------|------|
| `users` | 用户信息表 |
| `dating_cards` | 交友卡片表 |
| `likes` | 点赞记录表 |
| `share_records` | 分享记录表 |
| `invite_records` | 邀请记录表 |
| `daily_unlock_log` | 每日解锁日志 |
| `cities` | 城市列表表 |

## VIP 与解锁规则

### 免费用户
- 可以浏览所有卡片
- 微信号默认隐藏
- 每日 2 次免费解锁机会
- 可通过分享获得额外解锁

### VIP 用户
- 无限查看微信号
- 卡片置顶展示（获得更好曝光）
- 专属 VIP 标识

### 获取 VIP 方式
1. **付费开通**: 7 天 ¥9.9 / 30 天 ¥29.9 / 90 天 ¥69.9
2. **分享奖励**: 每分享 3 次获得 1 天 VIP
3. **邀请奖励**: 每邀请 3 位好友注册获得 7 天 VIP

## 合规说明

本平台设计完全符合微信生态规范：

- ❌ 无现金奖励
- ❌ 无多级分销
- ✅ 分享奖励为平台内虚拟权益
- ✅ 邀请奖励有明确上限
- ✅ 无诱导分享文案

## 自定义

### 修改品牌名称

编辑 `index.html` 和 `README.md` 中的"知遇小豚"为您自己的品牌名。

### 修改配色

编辑 `style.css` 中的 CSS 变量：

```css
:root {
    --primary-color: #ff6b8a;  /* 主色调 */
    --secondary-color: #a855f7; /* 辅助色 */
    --gold-color: #fbbf24;      /* VIP 金色 */
}
```

### 添加真实支付

当前 VIP 开通为演示状态，如需接入真实支付：

1. 接入微信支付或支付宝
2. 在 `app.js` 中修改 `.btn-select-vip` 点击事件
3. 支付成功后调用 Supabase 更新用户 VIP 状态

## 安全建议

1. **启用 Supabase RLS**: 数据库已配置行级安全策略
2. **限制匿名访问**: 根据需求可开启邮箱验证
3. **内容审核**: 建议接入内容审核 API 过滤不当内容
4. **频率限制**: 使用 Supabase Edge Functions 实现 API 限流

## 许可证

MIT License

---

**知遇小豚** 🐬 - 在这里遇见那个 TA
