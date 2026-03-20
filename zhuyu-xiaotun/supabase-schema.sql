-- 知遇小豚 - Supabase 数据库架构
-- 创建时间：2026-03-20

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 用户表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nickname VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    city VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_vip BOOLEAN DEFAULT FALSE,
    vip_expires_at TIMESTAMPTZ,
    wechat_daily_unlock INT DEFAULT 0,  -- 今日已解锁的微信数量
    wechat_share_unlock INT DEFAULT 0,  -- 通过分享获得的解锁次数
    last_unlock_reset TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_is_vip ON users(is_vip);

-- ============================================
-- 2. 交友卡片表 (dating_cards)
-- ============================================
CREATE TABLE IF NOT EXISTS dating_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(50) NOT NULL,
    age INT NOT NULL CHECK (age >= 18 AND age <= 100),
    city VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    self_intro TEXT NOT NULL,
    mate_requirement TEXT NOT NULL,
    wechat_id VARCHAR(100) NOT NULL,
    like_count INT DEFAULT 0,
    view_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,  -- VIP 置顶
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON dating_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_gender ON dating_cards(gender);
CREATE INDEX IF NOT EXISTS idx_cards_city ON dating_cards(city);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON dating_cards(created_at);
CREATE INDEX IF NOT EXISTS idx_cards_active ON dating_cards(is_active);
CREATE INDEX IF NOT EXISTS idx_cards_featured ON dating_cards(is_featured);

-- ============================================
-- 3. 点赞/收藏表 (likes)
-- ============================================
CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES dating_cards(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, card_id)  -- 每人每张卡片只能点赞一次
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_card_id ON likes(card_id);

-- ============================================
-- 4. 分享记录表 (share_records)
-- ============================================
CREATE TABLE IF NOT EXISTS share_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_type VARCHAR(20) NOT NULL CHECK (share_type IN ('moment', 'group', 'friend')),
    share_date TIMESTAMPTZ DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT FALSE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON share_records(user_id);
CREATE INDEX IF NOT EXISTS idx_shares_date ON share_records(share_date);

-- ============================================
-- 5. 邀请记录表 (invite_records)
-- ============================================
CREATE TABLE IF NOT EXISTS invite_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(invited_user_id)  -- 每个用户只能被邀请一次
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_invites_inviter_id ON invite_records(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invites_invite_code ON invite_records(invite_code);

-- ============================================
-- 6. 每日解锁重置记录 (daily_unlock_log)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_unlock_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unlock_date DATE NOT NULL,
    free_count_used INT DEFAULT 0,
    share_count_used INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, unlock_date)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_unlock_log_user_date ON daily_unlock_log(user_id, unlock_date);

-- ============================================
-- 7. 城市列表表 (cities) - 预置热门城市
-- ============================================
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    city_name VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0
);

-- 插入热门城市
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

-- ============================================
-- 8. 函数：检查并重置每日免费解锁次数
-- ============================================
CREATE OR REPLACE FUNCTION check_and_reset_daily_unlock(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_last_reset TIMESTAMPTZ;
    v_today DATE := CURRENT_DATE;
BEGIN
    SELECT last_unlock_reset INTO v_last_reset
    FROM users WHERE id = p_user_id;

    -- 如果上次重置时间不是今天，则重置
    IF v_last_reset IS NULL OR DATE(v_last_reset) != v_today THEN
        UPDATE users
        SET wechat_daily_unlock = 0,
            last_unlock_reset = NOW()
        WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. 函数：验证用户 VIP 状态
-- ============================================
CREATE OR REPLACE FUNCTION check_vip_status(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_vip BOOLEAN;
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT is_vip, vip_expires_at INTO v_is_vip, v_expires_at
    FROM users WHERE id = p_user_id;

    -- 如果是 VIP 但已过期，更新状态
    IF v_is_vip AND (v_expires_at IS NULL OR v_expires_at < NOW()) THEN
        UPDATE users SET is_vip = FALSE WHERE id = p_user_id;
        RETURN FALSE;
    END IF;

    RETURN v_is_vip;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. 函数：添加 VIP 时长
-- ============================================
CREATE OR REPLACE FUNCTION add_vip_days(p_user_id UUID, p_days INT)
RETURNS VOID AS $$
DECLARE
    v_current_expires TIMESTAMPTZ;
    v_new_expires TIMESTAMPTZ;
BEGIN
    SELECT vip_expires_at INTO v_current_expires
    FROM users WHERE id = p_user_id;

    -- 如果当前是 VIP 且未过期，在现有基础上延长
    IF v_current_expires IS NOT NULL AND v_current_expires > NOW() THEN
        v_new_expires := v_current_expires + (p_days || ' days')::INTERVAL;
    ELSE
        -- 否则从今天开始计算
        v_new_expires := NOW() + (p_days || ' days')::INTERVAL;
    END IF;

    UPDATE users
    SET is_vip = TRUE,
        vip_expires_at = v_new_expires
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. 函数：记录分享并增加解锁次数
-- ============================================
CREATE OR REPLACE FUNCTION record_share_and_unlock(p_user_id UUID, p_share_type VARCHAR)
RETURNS INT AS $$
DECLARE
    v_new_unlock_count INT;
BEGIN
    -- 记录分享
    INSERT INTO share_records (user_id, share_type, is_verified)
    VALUES (p_user_id, p_share_type, TRUE);

    -- 增加解锁次数
    UPDATE users
    SET wechat_share_unlock = wechat_share_unlock + 1
    WHERE id = p_user_id;

    -- 检查是否满足奖励条件
    -- 分享 3 次获得 1 天 VIP
    IF (SELECT COUNT(*) FROM share_records
        WHERE user_id = p_user_id
        AND share_date >= NOW() - INTERVAL '30 days') % 3 = 0
       AND (SELECT COUNT(*) FROM share_records
            WHERE user_id = p_user_id
            AND share_date >= NOW() - INTERVAL '30 days') > 0 THEN
        PERFORM add_vip_days(p_user_id, 1);
    END IF;

    SELECT wechat_share_unlock INTO v_new_unlock_count
    FROM users WHERE id = p_user_id;

    RETURN v_new_unlock_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 12. 触发器：点赞时更新卡片点赞数
-- ============================================
CREATE OR REPLACE FUNCTION update_card_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE dating_cards SET like_count = like_count + 1 WHERE id = NEW.card_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE dating_cards SET like_count = like_count - 1 WHERE id = OLD.card_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_update_card_like_count
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW EXECUTE FUNCTION update_card_like_count();

-- ============================================
-- 13. 触发器：更新卡片浏览数
-- ============================================
CREATE OR REPLACE FUNCTION increment_view_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- 只有当 viewed_at 发生变化时才增加计数（防止重复刷新）
        IF NEW.viewed_at IS DISTINCT FROM OLD.viewed_at THEN
            UPDATE dating_cards SET view_count = view_count + 1 WHERE id = NEW.card_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 行级安全策略 (RLS)
-- ============================================

-- 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dating_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_unlock_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- users 表策略
CREATE POLICY "允许用户读取自己的信息" ON users
    FOR SELECT USING (TRUE);  -- 公开读取基本信息

CREATE POLICY "允许用户更新自己的信息" ON users
    FOR UPDATE USING (TRUE);  -- 简化：允许更新

CREATE POLICY "允许创建用户" ON users
    FOR INSERT WITH CHECK (TRUE);

-- dating_cards 表策略
CREATE POLICY "允许读取活跃卡片" ON dating_cards
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "允许创建卡片" ON dating_cards
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "允许更新自己的卡片" ON dating_cards
    FOR UPDATE USING (TRUE);

-- likes 表策略
CREATE POLICY "允许读取点赞" ON likes
    FOR SELECT USING (TRUE);

CREATE POLICY "允许创建点赞" ON likes
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "允许删除自己的点赞" ON likes
    FOR DELETE USING (TRUE);

-- share_records 表策略
CREATE POLICY "允许读取分享记录" ON share_records
    FOR SELECT USING (TRUE);

CREATE POLICY "允许创建分享记录" ON share_records
    FOR INSERT WITH CHECK (TRUE);

-- invite_records 表策略
CREATE POLICY "允许读取邀请记录" ON invite_records
    FOR SELECT USING (TRUE);

CREATE POLICY "允许创建邀请记录" ON invite_records
    FOR INSERT WITH CHECK (TRUE);

-- daily_unlock_log 表策略
CREATE POLICY "允许读取解锁日志" ON daily_unlock_log
    FOR SELECT USING (TRUE);

CREATE POLICY "允许创建解锁日志" ON daily_unlock_log
    FOR INSERT WITH CHECK (TRUE);

-- cities 表策略
CREATE POLICY "允许读取城市列表" ON cities
    FOR SELECT USING (is_active = TRUE);

-- ============================================
-- 14. 视图：带用户信息的卡片列表
-- ============================================
CREATE OR REPLACE VIEW cards_with_users AS
SELECT
    dc.*,
    u.is_vip as user_is_vip,
    u.vip_expires_at as user_vip_expires_at
FROM dating_cards dc
LEFT JOIN users u ON dc.user_id = u.id
WHERE dc.is_active = TRUE;

-- ============================================
-- 15. 视图：城市统计
-- ============================================
CREATE OR REPLACE VIEW city_stats AS
SELECT
    city,
    COUNT(*) as card_count,
    SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) as male_count,
    SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) as female_count
FROM dating_cards
WHERE is_active = TRUE
GROUP BY city
ORDER BY card_count DESC;

-- ============================================
-- 示例数据（可选，用于测试）
-- ============================================
-- INSERT INTO users (nickname, gender, city) VALUES
--     ('小明', 'male', '北京'),
--     ('小红', 'female', '上海');

-- INSERT INTO dating_cards (user_id, nickname, age, city, gender, self_intro, mate_requirement, wechat_id) VALUES
--     ('示例用户 ID', '小明', 28, '北京', 'male', '真诚找对象', '希望对方温柔善良', 'wxid_example');

COMMENT ON TABLE users IS '用户信息表';
COMMENT ON TABLE dating_cards IS '交友卡片表';
COMMENT ON TABLE likes IS '点赞/收藏表';
COMMENT ON TABLE share_records IS '分享记录表';
COMMENT ON TABLE invite_records IS '邀请记录表';
COMMENT ON TABLE daily_unlock_log IS '每日解锁记录表';
COMMENT ON TABLE cities IS '城市列表表';
