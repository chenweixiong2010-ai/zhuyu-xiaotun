# 知遇小豚 - 部署检查清单

## 部署前准备

### 1. Supabase 配置

- [ ] 创建 Supabase 项目 (https://supabase.com)
- [ ] 在 SQL Editor 中执行 `supabase-schema.sql` 创建数据库表
- [ ] 复制 Project URL (格式：https://xxxxx.supabase.co)
- [ ] 复制 anon/public key (以 eyJ 开头的长字符串)

### 2. 前端配置

- [ ] 编辑 `config.js` 文件
- [ ] 将 `YOUR_SUPABASE_URL` 替换为您的 Project URL
- [ ] 将 `YOUR_SUPABASE_ANON_KEY` 替换为您的 anon key

示例：
```javascript
const SUPABASE_CONFIG = {
    url: 'https://abcdefghij.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx'
};
```

### 3. 本地测试

- [ ] 在项目目录运行本地服务器测试
  ```bash
  # 使用 Python
  python -m http.server 8000

  # 或使用 Node.js (需先安装)
  npx serve

  # 或使用 PHP
  php -S localhost:8000
  ```
- [ ] 浏览器访问 http://localhost:8000
- [ ] 测试登录功能
- [ ] 测试发布卡片功能
- [ ] 测试查看/解锁微信号功能

## 部署到 Vercel（推荐）

### 方法一：Vercel CLI

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 进入项目目录
cd zhuyu-xiaotun

# 3. 登录 Vercel
vercel login

# 4. 部署
vercel

# 5. 按提示操作
#    - Set up and deploy? Y
#    - Which scope? (选择您的账户)
#    - Link to existing project? N
#    - What's your project's name? (输入项目名)
#    - In which directory is your code located? ./
#    - Want to override the settings? N

# 6. 部署完成后会获得一个 https://your-project.vercel.app 域名
```

### 方法二：GitHub + Vercel

```bash
# 1. 初始化 Git (如未初始化)
git init
git add .
git commit -m "Initial commit"

# 2. 推送到 GitHub
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main

# 3. 访问 Vercel (https://vercel.com)
# 4. 点击 "New Project"
# 5. 导入 GitHub 仓库
# 6. 点击 "Deploy"
```

## 部署到 Netlify

### 方法一：Netlify CLI

```bash
# 1. 安装 Netlify CLI
npm install -g netlify-cli

# 2. 进入项目目录
cd zhuyu-xiaotun

# 3. 登录 Netlify
netlify login

# 4. 初始化并部署
netlify init
netlify deploy --prod

# 5. 按提示操作
#    - Choose "Create & configure a new site"
#    - 选择团队
#    - 输入站点名称
```

### 方法二：Netlify 拖拽部署

1. 访问 https://app.netlify.com/drop
2. 将 `zhuyu-xiaotun` 文件夹拖拽到上传区域
3. 等待部署完成
4. 获得临时域名（可在站点设置中绑定自定义域名）

## 部署到 Cloudflare Pages

```bash
# 1. 安装 Wrangler CLI
npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 进入项目目录
cd zhuyu-xiaotun

# 4. 部署
wrangler pages deploy .

# 5. 按提示完成部署
```

## 自定义域名

### Vercel
1. 访问 Vercel Dashboard
2. 选择项目 → Settings → Domains
3. 添加您的域名
4. 按提示配置 DNS

### Netlify
1. 访问 Netlify Dashboard
2. 选择站点 → Domain settings
3. 添加自定义域名
4. 按提示配置 DNS

## 数据库检查清单

部署后请检查以下内容：

- [ ] 访问 Supabase Dashboard → Table Editor
- [ ] 检查以下表是否存在：
  - [ ] users
  - [ ] dating_cards
  - [ ] likes
  - [ ] share_records
  - [ ] invite_records
  - [ ] daily_unlock_log
  - [ ] cities
- [ ] 检查 cities 表是否有数据（至少包含 20 个默认城市）

## 功能测试清单

部署完成后，请按以下清单测试：

### 用户功能
- [ ] 新用户注册（昵称 + 性别 + 城市）
- [ ] 老用户登录
- [ ] 退出登录

### 卡片功能
- [ ] 发布新卡片
- [ ] 查看卡片列表
- [ ] 卡片筛选（性别、城市）
- [ ] 卡片详情查看
- [ ] 点赞功能

### 解锁功能
- [ ] 查看未解锁的微信号
- [ ] 使用免费解锁次数
- [ ] 查看已解锁的微信号
- [ ] 复制微信号

### VIP 功能
- [ ] VIP 标识显示
- [ ] VIP 升级弹窗

### 分享功能
- [ ] 分享朋友圈按钮
- [ ] 分享群聊按钮
- [ ] 邀请好友按钮
- [ ] 完成分享后获得解锁次数

## 故障排查

### 问题：无法加载卡片

**可能原因**：
1. Supabase URL 或 key 配置错误
2. 数据库表未创建
3. 浏览器控制台有 CORS 错误

**解决方法**：
1. 检查 `config.js` 配置是否正确
2. 在 Supabase SQL Editor 重新执行建表脚本
3. 在 Supabase Dashboard 启用 RLS（行级安全）

### 问题：无法登录/注册

**可能原因**：
1. users 表不存在或 RLS 策略问题
2. 必填字段缺失

**解决方法**：
1. 检查浏览器控制台错误信息
2. 检查 Supabase 表结构

### 问题：城市列表为空

**可能原因**：
1. cities 表无数据

**解决方法**：
```sql
-- 在 Supabase SQL Editor 执行
INSERT INTO cities (city_name, is_active, sort_order) VALUES
    ('北京', TRUE, 1),
    ('上海', TRUE, 2),
    ('广州', TRUE, 3),
    ('深圳', TRUE, 4),
    ('杭州', TRUE, 5),
    ('成都', TRUE, 6),
    ('重庆', TRUE, 7),
    ('武汉', TRUE, 8),
    ('西安', TRUE, 9),
    ('南京', TRUE, 10),
    ('苏州', TRUE, 11),
    ('天津', TRUE, 12),
    ('长沙', TRUE, 13),
    ('郑州', TRUE, 14),
    ('济南', TRUE, 15),
    ('青岛', TRUE, 16),
    ('大连', TRUE, 17),
    ('厦门', TRUE, 18),
    ('昆明', TRUE, 19),
    ('其他', TRUE, 20)
ON CONFLICT (city_name) DO NOTHING;
```

## 安全建议

1. **启用 Supabase RLS**: 确保行级安全策略已启用
2. **限制匿名访问**: 根据需求可开启邮箱验证
3. **内容审核**: 建议接入内容审核 API
4. **备份数据**: 定期导出数据库备份

## 后续优化

1. 接入微信支付/支付宝实现 VIP 付费
2. 添加图片上传功能
3. 添加实名认证
4. 添加举报功能
5. 添加屏蔽功能
6. 添加推荐算法

---

祝您部署顺利！🐬
