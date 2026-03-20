// ============================================
// 知遇小豚 - 主应用逻辑
// ============================================

// Supabase 客户端初始化
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

// ============================================
// 全局状态
// ============================================
const AppState = {
    currentUser: null,
    currentCards: [],
    currentPage: 1,
    hasMore: true,
    filters: {
        gender: '',
        city: ''
    },
    unlockQueue: new Map(),  // 临时存储待解锁的卡片
    inviteCode: null
};

// ============================================
// 工具函数
// ============================================

/**
 * 生成唯一邀请码
 */
function generateInviteCode() {
    return 'ZY' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

/**
 * 获取存储的邀请码
 */
function getStoredInviteCode() {
    return localStorage.getItem('zhuyu_invite_code');
}

/**
 * 存储邀请码
 */
function storeInviteCode(code) {
    localStorage.setItem('zhuyu_invite_code', code);
}

/**
 * 显示 Toast 提示
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

/**
 * 格式化时间显示
 */
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    return date.toLocaleDateString('zh-CN');
}

/**
 * 获取性别显示
 */
function getGenderText(gender) {
    return gender === 'male' ? '男' : '女';
}

/**
 * 获取性别对应的 emoji
 */
function getGenderEmoji(gender) {
    return gender === 'male' ? '♂️' : '♀️';
}

// ============================================
// 用户认证相关
// ============================================

/**
 * 检查用户登录状态
 */
async function checkAuth() {
    const userId = localStorage.getItem('zhuyu_user_id');
    if (!userId) {
        showLoginSection();
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !data) {
            localStorage.removeItem('zhuyu_user_id');
            showLoginSection();
            return;
        }

        // 检查并更新 VIP 状态
        await checkVipStatus(data.id);

        // 重新获取最新用户数据
        const { data: userData } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', data.id)
            .single();

        AppState.currentUser = userData;
        showLoggedInSection(userData);
        updateProfileUI(userData);

        // 检查是否有邀请码（来自 URL 或其他用户）
        const inviteCode = getStoredInviteCode();
        if (inviteCode) {
            console.log('检测到邀请码:', inviteCode);
        }

    } catch (error) {
        console.error('检查登录状态失败:', error);
        showLoginSection();
    }
}

/**
 * 检查 VIP 状态
 */
async function checkVipStatus(userId) {
    try {
        await supabaseClient.rpc('check_vip_status', { p_user_id: userId });
    } catch (error) {
        console.error('检查 VIP 状态失败:', error);
    }
}

/**
 * 显示登录表单
 */
function showLoginSection() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('logged-in-section').style.display = 'none';
    document.getElementById('profile-nickname').textContent = '未登录';
    document.getElementById('profile-city').textContent = '';
    document.getElementById('profile-vip-badge').style.display = 'none';
}

/**
 * 显示已登录内容
 */
function showLoggedInSection(user) {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('logged-in-section').style.display = 'block';

    // 加载用户的卡片
    loadUserCards();

    // 更新统计信息
    updateStatsUI();
}

/**
 * 更新个人资料 UI
 */
function updateProfileUI(user) {
    document.getElementById('profile-nickname').textContent = user.nickname;
    document.getElementById('profile-city').textContent = user.city;

    const vipBadge = document.getElementById('profile-vip-badge');
    if (user.is_vip && user.vip_expires_at && new Date(user.vip_expires_at) > new Date()) {
        vipBadge.style.display = 'inline-flex';
    } else {
        vipBadge.style.display = 'none';
    }
}

/**
 * 更新统计 UI
 */
function updateStatsUI() {
    const user = AppState.currentUser;
    if (!user) return;

    // 计算今日剩余免费解锁次数
    const remainingFree = Math.max(0, APP_CONFIG.dailyFreeUnlock - (user.wechat_daily_unlock || 0));
    document.getElementById('stat-free-unlock').textContent = remainingFree;

    // 分享解锁次数
    document.getElementById('stat-share-unlock').textContent = user.wechat_share_unlock || 0;

    // 获取用户卡片的总浏览数
    loadUserCardStats();
}

/**
 * 加载用户卡片统计
 */
async function loadUserCardStats() {
    if (!AppState.currentUser) return;

    try {
        const { data, error } = await supabaseClient
            .from('dating_cards')
            .select('view_count')
            .eq('user_id', AppState.currentUser.id);

        if (!error && data) {
            const totalViews = data.reduce((sum, card) => sum + (card.view_count || 0), 0);
            document.getElementById('stat-total-views').textContent = totalViews;
        }
    } catch (error) {
        console.error('加载卡片统计失败:', error);
    }
}

/**
 * 登录/注册
 */
async function handleLogin(nickname, gender, city) {
    try {
        // 检查是否已有该用户
        let { data: existingUser } = await supabaseClient
            .from('users')
            .select('*')
            .eq('nickname', nickname)
            .eq('gender', gender)
            .eq('city', city)
            .single();

        if (existingUser) {
            // 已有用户，直接登录
            AppState.currentUser = existingUser;
            localStorage.setItem('zhuyu_user_id', existingUser.id);
            showLoggedInSection(existingUser);
            updateProfileUI(existingUser);
            showToast('欢迎回来！', 'success');

            // 如果有邀请码且不是自己，记录邀请
            const inviteCode = getStoredInviteCode();
            if (inviteCode) {
                await recordInvite(inviteCode, existingUser.id);
            }
        } else {
            // 新用户，创建记录
            const { data: newUser, error } = await supabaseClient
                .from('users')
                .insert([{
                    nickname,
                    gender,
                    city,
                    wechat_daily_unlock: 0,
                    wechat_share_unlock: 0
                }])
                .select()
                .single();

            if (error) {
                showToast('注册失败：' + error.message, 'error');
                return false;
            }

            AppState.currentUser = newUser;
            localStorage.setItem('zhuyu_user_id', newUser.id);
            showLoggedInSection(newUser);
            updateProfileUI(newUser);
            showToast('欢迎加入知遇小豚！', 'success');

            // 如果有邀请码且不是自己，记录邀请
            const inviteCode = getStoredInviteCode();
            if (inviteCode) {
                await recordInvite(inviteCode, newUser.id);
            }
        }

        return true;
    } catch (error) {
        console.error('登录失败:', error);
        showToast('登录失败，请稍后重试', 'error');
        return false;
    }
}

/**
 * 记录邀请
 */
async function recordInvite(inviteCode, invitedUserId) {
    try {
        // 查找邀请码对应的用户
        const { data: inviteRecord } = await supabaseClient
            .from('invite_records')
            .select('inviter_id')
            .eq('invite_code', inviteCode)
            .single();

        if (inviteRecord) {
            // 记录邀请
            await supabaseClient
                .from('invite_records')
                .insert([{
                    inviter_id: inviteRecord.inviter_id,
                    invited_user_id: invitedUserId,
                    invite_code: inviteCode
                }]);

            // 检查邀请人是否达到奖励条件
            await checkInviteReward(inviteRecord.inviter_id);
        }
    } catch (error) {
        console.error('记录邀请失败:', error);
    }
}

/**
 * 检查邀请奖励
 */
async function checkInviteReward(inviterId) {
    try {
        const { count, error } = await supabaseClient
            .from('invite_records')
            .select('*', { count: 'exact', head: true })
            .eq('inviter_id', inviterId);

        if (!error && count) {
            // 每邀请 3 人获得 7 天 VIP
            if (count % APP_CONFIG.inviteToVipThreshold === 0) {
                await supabaseClient.rpc('add_vip_days', {
                    p_user_id: inviterId,
                    p_days: APP_CONFIG.inviteToVipDays
                });
                showToast('恭喜！邀请好友获得 7 天 VIP！', 'success');
            }
        }
    } catch (error) {
        console.error('检查邀请奖励失败:', error);
    }
}

/**
 * 登出
 */
function handleLogout() {
    localStorage.removeItem('zhuyu_user_id');
    AppState.currentUser = null;
    showLoginSection();
    showToast('已退出登录', 'info');
}

// ============================================
// 卡片相关功能
// ============================================

/**
 * 加载卡片列表
 */
async function loadCards(page = 1, append = false) {
    const cardsList = document.getElementById('cards-list');
    const loading = document.getElementById('loading');

    if (page === 1 && !append) {
        cardsList.innerHTML = '';
        AppState.currentCards = [];
    }

    loading.style.display = 'block';

    try {
        let query = supabaseClient
            .from('dating_cards')
            .select('*')
            .eq('is_active', true)
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false })
            .range((page - 1) * APP_CONFIG.pageSize, page * APP_CONFIG.pageSize - 1);

        // 应用筛选
        if (AppState.filters.gender) {
            query = query.eq('gender', AppState.filters.gender);
        }
        if (AppState.filters.city) {
            query = query.eq('city', AppState.filters.city);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        AppState.currentCards = append ? [...AppState.currentCards, ...data] : data;
        AppState.hasMore = data.length === APP_CONFIG.pageSize;

        renderCards(data);

    } catch (error) {
        console.error('加载卡片失败:', error);
        showToast('加载失败，请稍后重试', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

/**
 * 渲染卡片列表
 */
function renderCards(cards) {
    const cardsList = document.getElementById('cards-list');
    const noMore = document.getElementById('no-more');

    if (cards.length === 0 && AppState.currentCards.length === 0) {
        cardsList.innerHTML = '<div class="text-center" style="padding: 40px; color: var(--text-secondary);">暂无卡片，快来发布第一张吧~</div>';
        noMore.style.display = 'none';
        return;
    }

    cards.forEach(card => {
        const cardEl = createCardElement(card);
        cardsList.appendChild(cardEl);
    });

    noMore.style.display = AppState.hasMore ? 'none' : 'block';
}

/**
 * 创建单个卡片元素
 */
function createCardElement(card) {
    const div = document.createElement('div');
    div.className = `card ${card.is_featured ? 'featured' : ''}`;
    div.dataset.cardId = card.id;

    const isLiked = card.is_liked || false;

    div.innerHTML = `
        <div class="card-header" onclick="openCardModal('${card.id}')">
            <div class="card-avatar ${card.gender}">
                ${card.gender === 'male' ? '👨' : '👩'}
            </div>
            <div class="card-info">
                <div class="card-name">
                    ${escapeHtml(card.nickname)}
                    ${card.is_featured ? '<span class="vip-badge"><span class="vip-icon">👑</span>VIP</span>' : ''}
                </div>
                <div class="card-meta">
                    <span class="card-tag">${card.age}岁</span>
                    <span class="card-tag">${getGenderText(card.gender)}</span>
                    <span class="card-tag">📍 ${escapeHtml(card.city)}</span>
                </div>
            </div>
        </div>
        <div class="card-intro" onclick="openCardModal('${card.id}')">
            ${escapeHtml(card.self_intro)}
        </div>
        <div class="card-footer">
            <div class="card-location">
                ${formatTimeAgo(card.created_at)} 发布
            </div>
            <div class="card-actions">
                <button class="btn-like ${isLiked ? 'liked' : ''}" onclick="toggleLike(event, '${card.id}')">
                    ${isLiked ? '❤️' : '🤍'}
                </button>
                <span class="btn-like-count">${card.like_count || 0}</span>
            </div>
        </div>
    `;

    return div;
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 打开卡片详情
 */
async function openCardModal(cardId) {
    const card = AppState.currentCards.find(c => c.id === cardId);
    if (!card) return;

    // 填充基本信息
    document.getElementById('modal-card-title').textContent = card.nickname;
    document.getElementById('modal-nickname').textContent = card.nickname;
    document.getElementById('modal-age').textContent = card.age + '岁';
    document.getElementById('modal-city').textContent = card.city;
    document.getElementById('modal-gender').textContent = getGenderText(card.gender) + getGenderEmoji(card.gender);
    document.getElementById('modal-intro').textContent = card.self_intro;
    document.getElementById('modal-requirement').textContent = card.mate_requirement;

    // 重置微信号显示
    document.getElementById('wechat-locked').style.display = 'block';
    document.getElementById('wechat-unlocked').style.display = 'none';

    // 显示弹窗
    document.getElementById('wechat-modal').classList.add('active');

    // 存储当前卡片 ID 以便解锁
    AppState.currentViewingCard = cardId;
    AppState.currentWechatId = card.wechat_id;

    // 检查是否已解锁过
    checkIfUnlocked(cardId);
}

/**
 * 检查是否已解锁
 */
function checkIfUnlocked(cardId) {
    const unlocked = localStorage.getItem(`zhuyu_unlocked_${cardId}`);
    if (unlocked) {
        showWechatId(AppState.currentWechatId);
    }
}

/**
 * 显示微信号
 */
function showWechatId(wechatId) {
    document.getElementById('wechat-locked').style.display = 'none';
    document.getElementById('wechat-unlocked').style.display = 'block';
    document.getElementById('wechat-id-display').textContent = wechatId;
}

/**
 * 关闭弹窗
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

/**
 * 解锁微信号
 */
async function unlockWechatId(useFree = true) {
    if (!AppState.currentUser) {
        showToast('请先登录', 'warning');
        closeModal('wechat-modal');
        setTimeout(() => {
            document.getElementById('profile').click();
        }, 500);
        return;
    }

    const cardId = AppState.currentViewingCard;
    const wechatId = AppState.currentWechatId;

    // 检查是否已解锁
    if (localStorage.getItem(`zhuyu_unlocked_${cardId}`)) {
        showWechatId(wechatId);
        return;
    }

    if (useFree) {
        // 使用免费解锁
        const remainingFree = APP_CONFIG.dailyFreeUnlock - (AppState.currentUser.wechat_daily_unlock || 0);

        if (remainingFree <= 0) {
            showToast('今日免费解锁次数已用完', 'warning');
            return;
        }

        try {
            // 更新数据库
            const { error } = await supabaseClient
                .from('users')
                .update({ wechat_daily_unlock: (AppState.currentUser.wechat_daily_unlock || 0) + 1 })
                .eq('id', AppState.currentUser.id);

            if (error) throw error;

            // 更新本地状态
            AppState.currentUser.wechat_daily_unlock = (AppState.currentUser.wechat_daily_unlock || 0) + 1;
            localStorage.setItem(`zhuyu_unlocked_${cardId}`, 'true');

            showToast('解锁成功！', 'success');
            showWechatId(wechatId);
            updateStatsUI();

        } catch (error) {
            console.error('解锁失败:', error);
            showToast('解锁失败，请稍后重试', 'error');
        }
    } else {
        // 使用分享解锁
        const shareUnlock = AppState.currentUser.wechat_share_unlock || 0;

        if (shareUnlock <= 0) {
            showToast('没有可用的分享解锁次数', 'warning');
            openShareModal();
            return;
        }

        try {
            // 更新数据库
            const { error } = await supabaseClient
                .from('users')
                .update({ wechat_share_unlock: shareUnlock - 1 })
                .eq('id', AppState.currentUser.id);

            if (error) throw error;

            // 更新本地状态
            AppState.currentUser.wechat_share_unlock = shareUnlock - 1;
            localStorage.setItem(`zhuyu_unlocked_${cardId}`, 'true');

            showToast('解锁成功！', 'success');
            showWechatId(wechatId);
            updateStatsUI();

        } catch (error) {
            console.error('解锁失败:', error);
            showToast('解锁失败，请稍后重试', 'error');
        }
    }
}

/**
 * 复制微信号
 */
function copyWechatId() {
    const wechatId = document.getElementById('wechat-id-display').textContent;

    navigator.clipboard.writeText(wechatId).then(() => {
        showToast('已复制到剪贴板', 'success');
    }).catch(() => {
        // 降级处理
        const input = document.createElement('input');
        input.value = wechatId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('已复制到剪贴板', 'success');
    });
}

/**
 * 点赞/取消点赞
 */
async function toggleLike(event, cardId) {
    event.stopPropagation();

    if (!AppState.currentUser) {
        showToast('请先登录', 'warning');
        setTimeout(() => {
            document.getElementById('profile').click();
        }, 500);
        return;
    }

    try {
        // 检查是否已点赞
        const { data: existingLike } = await supabaseClient
            .from('likes')
            .select('*')
            .eq('user_id', AppState.currentUser.id)
            .eq('card_id', cardId)
            .single();

        if (existingLike) {
            // 取消点赞
            await supabaseClient
                .from('likes')
                .delete()
                .eq('id', existingLike.id);

            showToast('已取消喜欢', 'info');
        } else {
            // 添加点赞
            await supabaseClient
                .from('likes')
                .insert([{
                    user_id: AppState.currentUser.id,
                    card_id: cardId
                }]);

            showToast('已添加到喜欢', 'success');
        }

        // 重新加载卡片列表以更新点赞状态
        loadCards(AppState.currentPage);

    } catch (error) {
        console.error('点赞失败:', error);
        showToast('操作失败', 'error');
    }
}

/**
 * 创建卡片
 */
async function createCard(cardData) {
    if (!AppState.currentUser) {
        showToast('请先登录', 'warning');
        return false;
    }

    try {
        const { data, error } = await supabaseClient
            .from('dating_cards')
            .insert([{
                user_id: AppState.currentUser.id,
                nickname: cardData.nickname,
                age: parseInt(cardData.age),
                city: cardData.city,
                gender: cardData.gender,
                self_intro: cardData.intro,
                mate_requirement: cardData.requirement,
                wechat_id: cardData.wechat,
                is_featured: AppState.currentUser.is_vip || false
            }])
            .select()
            .single();

        if (error) throw error;

        showToast('发布成功！', 'success');
        return true;

    } catch (error) {
        console.error('发布失败:', error);
        showToast('发布失败：' + error.message, 'error');
        return false;
    }
}

/**
 * 加载用户的卡片
 */
async function loadUserCards() {
    if (!AppState.currentUser) return;

    try {
        const { data, error } = await supabaseClient
            .from('dating_cards')
            .select('*')
            .eq('user_id', AppState.currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderUserCards(data);

    } catch (error) {
        console.error('加载卡片失败:', error);
    }
}

/**
 * 渲染用户的卡片
 */
function renderUserCards(cards) {
    const container = document.getElementById('my-cards-list');

    if (!cards || cards.length === 0) {
        container.innerHTML = '<div class="text-center" style="padding: 20px; color: var(--text-secondary);">暂无卡片</div>';
        return;
    }

    container.innerHTML = cards.map(card => `
        <div class="my-card-item">
            <div class="my-card-info">
                <div class="my-card-title">${escapeHtml(card.nickname)} · ${card.age}岁 · ${escapeHtml(card.city)}</div>
                <div class="my-card-stats">❤️ ${card.like_count || 0} 次喜欢 · 👁️ ${card.view_count || 0} 次浏览</div>
            </div>
            <div class="my-card-actions">
                <button class="btn btn-toggle ${card.is_active ? 'btn-outline' : 'btn-primary'}"
                        onclick="toggleCardStatus('${card.id}', ${card.is_active})">
                    ${card.is_active ? '下架' : '上架'}
                </button>
                <button class="btn btn-delete" onclick="deleteCard('${card.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

/**
 * 切换卡片状态
 */
async function toggleCardStatus(cardId, currentStatus) {
    try {
        const { error } = await supabaseClient
            .from('dating_cards')
            .update({ is_active: !currentStatus })
            .eq('id', cardId);

        if (error) throw error;

        showToast(currentStatus ? '已下架' : '已上架', 'success');
        loadUserCards();

    } catch (error) {
        showToast('操作失败', 'error');
    }
}

/**
 * 删除卡片
 */
async function deleteCard(cardId) {
    if (!confirm('确定要删除这张卡片吗？')) return;

    try {
        const { error } = await supabaseClient
            .from('dating_cards')
            .delete()
            .eq('id', cardId);

        if (error) throw error;

        showToast('已删除', 'success');
        loadUserCards();

    } catch (error) {
        showToast('删除失败', 'error');
    }
}

// ============================================
// 分享相关功能
// ============================================

/**
 * 打开分享弹窗
 */
function openShareModal(type = 'moment') {
    AppState.currentShareType = type;
    document.getElementById('share-confirm-modal').classList.add('active');
}

/**
 * 完成分享
 */
async function completeShare() {
    if (!AppState.currentUser) {
        showToast('请先登录', 'warning');
        closeModal('share-confirm-modal');
        return;
    }

    try {
        // 调用数据库函数记录分享并增加解锁次数
        const { data, error } = await supabaseClient
            .rpc('record_share_and_unlock', {
                p_user_id: AppState.currentUser.id,
                p_share_type: AppState.currentShareType || 'moment'
            });

        if (error) throw error;

        // 更新本地状态
        AppState.currentUser.wechat_share_unlock = data || (AppState.currentUser.wechat_share_unlock || 0) + 1;

        showToast('分享成功！获得 1 次解锁机会', 'success');
        closeModal('share-confirm-modal');
        updateStatsUI();

    } catch (error) {
        console.error('分享失败:', error);
        // 即使失败也给与奖励（简化处理）
        AppState.currentUser.wechat_share_unlock = (AppState.currentUser.wechat_share_unlock || 0) + 1;
        showToast('分享成功！获得 1 次解锁机会', 'success');
        closeModal('share-confirm-modal');
        updateStatsUI();
    }
}

/**
 * 分享到朋友圈
 */
function shareToMoment() {
    openShareModal('moment');
}

/**
 * 分享到群聊
 */
function shareToGroup() {
    openShareModal('group');
}

/**
 * 邀请好友
 */
function inviteFriend() {
    // 生成或获取邀请码
    if (!AppState.inviteCode) {
        AppState.inviteCode = generateInviteCode();
    }

    // 存储自己的邀请码
    localStorage.setItem('zhuyu_my_invite_code', AppState.inviteCode);

    const shareText = `🐬 知遇小豚 - 真诚交友平台\n我的邀请码：${AppState.inviteCode}\n一起寻找缘分吧！`;

    if (navigator.share) {
        navigator.share({
            title: APP_CONFIG.shareTitle,
            text: shareText,
            url: window.location.origin + window.location.pathname + '?invite=' + AppState.inviteCode
        }).then(() => {
            // 分享成功，记录
            recordDirectShare();
        }).catch(() => {});
    } else {
        // 复制到剪贴板
        navigator.clipboard.writeText(shareText + '\n' + window.location.origin + window.location.pathname + '?invite=' + AppState.inviteCode).then(() => {
            showToast('已复制到剪贴板，快去分享吧！', 'success');
            recordDirectShare();
        });
    }
}

/**
 * 记录直接分享
 */
async function recordDirectShare() {
    if (!AppState.currentUser) return;

    try {
        await supabaseClient
            .from('share_records')
            .insert([{
                user_id: AppState.currentUser.id,
                share_type: 'friend',
                is_verified: true
            }]);

        // 简单处理：直接增加解锁次数
        const newCount = (AppState.currentUser.wechat_share_unlock || 0) + 1;
        await supabaseClient
            .from('users')
            .update({ wechat_share_unlock: newCount })
            .eq('id', AppState.currentUser.id);

        AppState.currentUser.wechat_share_unlock = newCount;
        updateStatsUI();

    } catch (error) {
        console.error('记录分享失败:', error);
    }
}

/**
 * 检查 URL 中的邀请码
 */
function checkUrlInviteCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('invite');

    if (inviteCode) {
        storeInviteCode(inviteCode);
        showToast('已使用邀请码，注册时自动关联', 'success');
        // 清除 URL 参数
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// ============================================
// 城市列表加载
// ============================================

/**
 * 加载城市列表
 */
async function loadCities() {
    try {
        const { data, error } = await supabaseClient
            .from('cities')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');

        if (error) throw error;

        populateCitySelects(data);

    } catch (error) {
        console.error('加载城市失败:', error);
        // 使用默认城市列表
        const defaultCities = [
            '北京', '上海', '广州', '深圳', '杭州', '成都', '重庆',
            '武汉', '西安', '南京', '苏州', '天津', '长沙', '郑州',
            '济南', '青岛', '大连', '厦门', '昆明', '其他'
        ];
        populateCitySelects(defaultCities.map(c => ({ city_name: c })));
    }
}

/**
 * 填充城市选择框
 */
function populateCitySelects(cities) {
    const selects = ['filter-city', 'card-city', 'login-city'];

    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;

        // 保留第一个选项（全部/请选择）
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);

        cities.forEach(city => {
            const cityName = city.city_name;
            const option = document.createElement('option');
            option.value = cityName;
            option.textContent = cityName;
            select.appendChild(option);
        });
    });
}

// ============================================
// 页面导航
// ============================================

/**
 * 切换页面
 */
function switchPage(pageId) {
    // 更新导航状态
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageId) {
            link.classList.add('active');
        }
    });

    // 更新页面显示
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        if (page.id === pageId) {
            page.classList.add('active');
        }
    });

    // 滚动到顶部
    window.scrollTo(0, 0);

    // 如果切换到首页，重新加载卡片
    if (pageId === 'home') {
        loadCards(1);
    }
}

// ============================================
// 无限滚动
// ============================================

let isLoadingMore = false;

/**
 * 监听滚动加载更多
 */
function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

        if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoadingMore && AppState.hasMore) {
            loadMoreCards();
        }
    });
}

/**
 * 加载更多卡片
 */
async function loadMoreCards() {
    if (isLoadingMore || !AppState.hasMore) return;

    isLoadingMore = true;
    AppState.currentPage++;
    await loadCards(AppState.currentPage, true);
    isLoadingMore = false;
}

// ============================================
// 事件绑定
// ============================================

/**
 * 初始化事件监听
 */
function initEventListeners() {
    // 导航点击
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.dataset.page;
            switchPage(pageId);
        });
    });

    // 登录表单
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nickname = document.getElementById('login-nickname').value.trim();
        const gender = document.getElementById('login-gender').value;
        const city = document.getElementById('login-city').value;

        if (!nickname || !gender || !city) {
            showToast('请填写完整信息', 'warning');
            return;
        }

        const success = await handleLogin(nickname, gender, city);
        if (success) {
            // 清空表单
            e.target.reset();
        }
    });

    // 创建卡片表单
    document.getElementById('create-card-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const cardData = {
            nickname: document.getElementById('card-nickname').value.trim(),
            age: document.getElementById('card-age').value,
            gender: document.getElementById('card-gender').value,
            city: document.getElementById('card-city').value,
            intro: document.getElementById('card-intro').value.trim(),
            requirement: document.getElementById('card-requirement').value.trim(),
            wechat: document.getElementById('card-wechat').value.trim()
        };

        if (!cardData.nickname || !cardData.age || !cardData.gender ||
            !cardData.city || !cardData.intro || !cardData.requirement || !cardData.wechat) {
            showToast('请填写完整信息', 'warning');
            return;
        }

        const success = await createCard(cardData);
        if (success) {
            e.target.reset();
            // 切换到个人中心查看卡片
            switchPage('profile');
            loadUserCards();
        }
    });

    // 搜索按钮
    document.getElementById('btn-search').addEventListener('click', () => {
        AppState.filters.gender = document.getElementById('filter-gender').value;
        AppState.filters.city = document.getElementById('filter-city').value;
        AppState.currentPage = 1;
        loadCards(1);
    });

    // 弹窗关闭
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            overlay.closest('.modal').classList.remove('active');
        });
    });

    // 解锁按钮
    document.getElementById('btn-unlock-free').addEventListener('click', () => {
        unlockWechatId(true);
    });

    document.getElementById('btn-unlock-share').addEventListener('click', () => {
        closeModal('wechat-modal');
        openShareModal();
    });

    // 复制微信号
    document.getElementById('btn-copy-wechat').addEventListener('click', copyWechatId);

    // 分享按钮
    document.getElementById('btn-share-moment').addEventListener('click', shareToMoment);
    document.getElementById('btn-share-group').addEventListener('click', shareToGroup);
    document.getElementById('btn-share-friend').addEventListener('click', inviteFriend);

    // 完成分享
    document.getElementById('btn-share-complete').addEventListener('click', completeShare);

    // VIP 升级
    document.getElementById('btn-vip-upgrade').addEventListener('click', () => {
        document.getElementById('vip-modal').classList.add('active');
    });

    // 选择 VIP
    document.querySelectorAll('.btn-select-vip').forEach(btn => {
        btn.addEventListener('click', () => {
            const days = btn.dataset.days;
            const price = btn.dataset.price;
            showToast(`VIP 开通功能开发中（${days}天 - ¥${price}）`, 'info');
        });
    });

    // 登出
    document.getElementById('btn-logout').addEventListener('click', handleLogout);
}

// ============================================
// 初始化
// ============================================

async function init() {
    // 检查 URL 邀请码
    checkUrlInviteCode();

    // 加载城市列表
    await loadCities();

    // 检查登录状态
    await checkAuth();

    // 初始化事件监听
    initEventListeners();

    // 设置无限滚动
    setupInfiniteScroll();

    // 加载首页卡片
    loadCards(1);

    // 从 localStorage 恢复邀请码
    const myInviteCode = localStorage.getItem('zhuyu_my_invite_code');
    if (myInviteCode) {
        AppState.inviteCode = myInviteCode;
    }

    console.log('知遇小豚 初始化完成 🐬');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
