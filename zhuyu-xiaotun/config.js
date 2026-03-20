// ============================================
// 知遇小豚 - 配置文件
// 请在此处填写您的 Supabase 项目信息
// ============================================

const SUPABASE_CONFIG = {
    // 替换为您的 Supabase 项目 URL
    url: 'https://sewiqvorkotyxcbqyrbp.supabase.co',

    // 替换为您的 Supabase anon/public key
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNld2lxdm9ya290eXhjYnF5cmJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMDAyNDIsImV4cCI6MjA4OTU3NjI0Mn0.4J69jwX3akeyOL3UPXePVaDRjz6UByebsCBNGXqq1V8'
};

// 其他配置
const APP_CONFIG = {
    // 每日免费解锁次数
    dailyFreeUnlock: 2,

    // 分享获得解锁次数
    shareUnlockCount: 1,

    // 分享 3 次获得 VIP 天数
    shareToVipDays: 1,
    shareToVipThreshold: 3,

    // 邀请 3 人获得 VIP 天数
    inviteToVipDays: 7,
    inviteToVipThreshold: 3,

    // 分页大小
    pageSize: 20,

    // 分享文案
    shareText: '🐬 知遇小豚 - 真诚交友平台\n在这里遇见那个 TA~\n快来加入我们吧！',

    // 分享标题
    shareTitle: '知遇小豚 - 真诚交友',

    // 分享图片（可选）
    shareImage: ''
};
