// ==================== 资源加载器 ====================
class ResourceLoader {
    constructor() {
        this.images = {};
        this.loaded = 0;
        this.total = 0;
        this.useImages = true; // 是否使用图片（如果加载失败则降级为纯色）
    }

    loadImage(name, src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.images[name] = img;
                this.loaded++;
                resolve(true);
            };
            img.onerror = () => {
                console.warn(`Failed to load image: ${name}`);
                this.loaded++;
                resolve(false);
            };
            img.src = src;
        });
    }

    async loadAll() {
        const imagesToLoad = [
            { name: 'background', src: 'assets/images/background.png' },
            { name: 'hero', src: 'assets/images/hero.png' },
            { name: 'enemy', src: 'assets/images/enemy.png' },
            { name: 'weapon', src: 'assets/images/weapon.png' },
            { name: 'exp_orb', src: 'assets/images/exp_orb.png' },
            { name: 'chest', src: 'assets/images/chest.png' },
            { name: 'trail', src: 'assets/images/trail.png' },
            { name: 'warning', src: 'assets/images/warning.png' }
        ];

        this.total = imagesToLoad.length;
        const promises = imagesToLoad.map(img => this.loadImage(img.name, img.src));

        await Promise.all(promises);

        // 如果主要图片都加载失败，则禁用图片模式
        if (!this.images.hero && !this.images.enemy && !this.images.weapon) {
            this.useImages = false;
            console.log('图片加载失败，使用纯色占位模式');
        }
    }

    getImage(name) {
        return this.images[name] || null;
    }

    getProgress() {
        return this.total > 0 ? (this.loaded / this.total) * 100 : 100;
    }
}

// 全局资源加载器
const Resources = new ResourceLoader();

// ==================== 工具函数 ====================
const Utils = {
    // 计算两点距离
    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },

    // 圆形碰撞检测
    circleCollision(x1, y1, r1, x2, y2, r2) {
        return this.distance(x1, y1, x2, y2) < (r1 + r2);
    },

    // 限制数值范围
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    // 随机整数
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // 随机浮点数
    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    },

    // 格式化时间
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
};

// ==================== 音效管理器 ====================
class AudioManager {
    constructor() {
        this.sounds = {};
        this.enabled = false; // 默认关闭，避免加载失败
    }

    load(name, src) {
        try {
            const audio = new Audio(src);
            audio.volume = this.getVolume(name);
            this.sounds[name] = audio;
        } catch (e) {
            console.warn(`Failed to load sound: ${name}`);
        }
    }

    getVolume(name) {
        const volumes = {
            bgm: 0.3,
            hit: 0.5,
            levelup: 0.6,
            chest_open: 0.6,
            boss_appear: 0.8,
            gameover: 0.7
        };
        return volumes[name] || 0.5;
    }

    play(name, playbackRate = 1.0) {
        if (!this.enabled || !this.sounds[name]) return;

        try {
            const sound = this.sounds[name].cloneNode();
            sound.playbackRate = playbackRate;
            sound.volume = this.getVolume(name);
            sound.play().catch(e => console.warn(`Failed to play sound: ${name}`));
        } catch (e) {
            console.warn(`Error playing sound: ${name}`);
        }
    }

    playLoop(name) {
        if (!this.enabled || !this.sounds[name]) return;

        try {
            this.sounds[name].loop = true;
            this.sounds[name].play().catch(e => console.warn(`Failed to play loop: ${name}`));
        } catch (e) {
            console.warn(`Error playing loop: ${name}`);
        }
    }

    stop(name) {
        if (this.sounds[name]) {
            this.sounds[name].pause();
            this.sounds[name].currentTime = 0;
        }
    }
}

// ==================== 玩家类 ====================
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;

        // 属性
        this.hp = 100;
        this.maxHp = 100;
        this.speed = 100; // px/s
        this.level = 1;
        this.exp = 0;
        this.expToLevel = 100;

        // 武器属性
        this.weaponCount = 2;
        this.weaponDamage = 10;
        this.weaponRadius = 80;
        this.rotateSpeed = 120; // 度/秒
        this.currentAngle = 0;

        // 防御
        this.defenseRate = 0;

        // 移动
        this.vx = 0;
        this.vy = 0;
        this.targetX = null;
        this.targetY = null;

        // buff
        this.autoCollectBuff = 0;
        this.speedBuff = 1.0;

        // 受伤无敌时间
        this.invincible = 0;

        // 武器外观
        this.weaponType = 0;
        this.weaponColors = ['#4488ff', '#ff4444', '#44ff44', '#ffaa00', '#ff44ff'];
    }

    update(deltaTime, keys, arenaRadius) {
        // 移动处理
        this.vx = 0;
        this.vy = 0;

        // 键盘移动
        if (keys['w'] || keys['arrowup']) this.vy = -1;
        if (keys['s'] || keys['arrowdown']) this.vy = 1;
        if (keys['a'] || keys['arrowleft']) this.vx = -1;
        if (keys['d'] || keys['arrowright']) this.vx = 1;

        // 鼠标移动
        if (this.targetX !== null && this.targetY !== null) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) {
                this.vx = dx / dist;
                this.vy = dy / dist;
            } else {
                this.targetX = null;
                this.targetY = null;
            }
        }

        // 归一化移动向量
        const mag = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (mag > 0) {
            this.vx /= mag;
            this.vy /= mag;
        }

        // 应用速度
        const effectiveSpeed = this.speed * this.speedBuff;
        this.x += this.vx * effectiveSpeed * deltaTime;
        this.y += this.vy * effectiveSpeed * deltaTime;

        // 圆形边界限制
        const distFromCenter = Math.sqrt(this.x * this.x + this.y * this.y);
        if (distFromCenter + this.radius > arenaRadius) {
            const angle = Math.atan2(this.y, this.x);
            const maxDist = arenaRadius - this.radius;
            this.x = Math.cos(angle) * maxDist;
            this.y = Math.sin(angle) * maxDist;
        }

        // 武器旋转
        this.currentAngle += this.rotateSpeed * deltaTime;
        if (this.currentAngle >= 360) this.currentAngle -= 360;

        // 更新buff
        if (this.autoCollectBuff > 0) {
            this.autoCollectBuff -= deltaTime;
        }

        if (this.speedBuff > 1.0) {
            // 速度buff在外部设置，这里只是占位
        }

        // 无敌时间
        if (this.invincible > 0) {
            this.invincible -= deltaTime;
        }
    }

    takeDamage(damage) {
        if (this.invincible > 0) return;

        const actualDamage = Math.max(1, damage * (1 - this.defenseRate));
        this.hp -= actualDamage;
        this.invincible = 0.5; // 0.5秒无敌

        if (this.hp < 0) this.hp = 0;
    }

    gainExp(amount) {
        this.exp += amount;
    }

    checkLevelUp() {
        if (this.exp >= this.expToLevel) {
            this.exp -= this.expToLevel;
            this.level++;
            return true;
        }
        return false;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    getWeaponPositions() {
        const positions = [];
        const angleStep = 360 / this.weaponCount;

        for (let i = 0; i < this.weaponCount; i++) {
            const angle = (this.currentAngle + i * angleStep) * Math.PI / 180;
            positions.push({
                x: this.x + Math.cos(angle) * this.weaponRadius,
                y: this.y + Math.sin(angle) * this.weaponRadius,
                angle: angle
            });
        }

        return positions;
    }

    draw(ctx) {
        // 无敌闪烁
        if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        const heroImg = Resources.getImage('hero');
        if (heroImg && Resources.useImages) {
            // 使用图片绘制
            const size = this.radius * 2;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.drawImage(heroImg, -size / 2, -size / 2, size, size);
            ctx.restore();
        } else {
            // 降级为纯色绘制
            ctx.fillStyle = '#44ff44';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // 眼睛
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(this.x - 7, this.y - 5, 3, 0, Math.PI * 2);
            ctx.arc(this.x + 7, this.y - 5, 3, 0, Math.PI * 2);
            ctx.fill();

            // 嘴巴
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y + 3, 8, 0, Math.PI);
            ctx.stroke();
        }

        ctx.globalAlpha = 1.0;

        // 武器
        this.drawWeapons(ctx);
    }

    drawWeapons(ctx) {
        const positions = this.getWeaponPositions();
        const color = this.weaponColors[this.weaponType % this.weaponColors.length];
        const weaponImg = Resources.getImage('weapon');
        const trailImg = Resources.getImage('trail');

        positions.forEach(pos => {
            // 拖尾效果
            if (trailImg && Resources.useImages) {
                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.translate(pos.x, pos.y);
                ctx.rotate(pos.angle);
                ctx.drawImage(trailImg, -30, -10, 30, 20);
                ctx.restore();
                ctx.globalAlpha = 1.0;
            } else {
                ctx.strokeStyle = color + '40';
                ctx.lineWidth = 6;
                ctx.beginPath();
                const trailLength = 15;
                ctx.moveTo(pos.x - Math.cos(pos.angle) * trailLength,
                          pos.y - Math.sin(pos.angle) * trailLength);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }

            // 武器本体
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(pos.angle);

            if (weaponImg && Resources.useImages) {
                // 使用图片绘制武器（支持多种武器外观）
                const weaponSize = 25;
                const weaponY = this.weaponType * weaponSize; // 根据武器类型选择sprite sheet的不同部分
                ctx.drawImage(weaponImg, 0, weaponY, weaponSize, weaponSize, -weaponSize/2, -weaponSize/2, weaponSize, weaponSize);
            } else {
                // 降级为纯色三角形
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(-5, -5);
                ctx.lineTo(-5, 5);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            ctx.restore();
        });
    }

    getPower() {
        return Math.floor(100 + this.weaponCount * 10 + this.weaponDamage * 0.5 + this.defenseRate * 800);
    }
}

// ==================== 敌人类 ====================
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'minion', 'elite', 'boss'

        const configs = {
            minion: { hp: 20, speed: 80, damage: 5, exp: 5, radius: 15, color: '#ff4444' },
            elite: { hp: 80, speed: 100, damage: 10, exp: 20, radius: 18, color: '#ff8800' },
            boss: { hp: 300, speed: 120, damage: 15, exp: 100, radius: 40, color: '#aa0000' }
        };

        const config = configs[type];
        this.hp = config.hp;
        this.maxHp = config.hp;
        this.speed = config.speed;
        this.damage = config.damage;
        this.exp = config.exp;
        this.radius = config.radius;
        this.color = config.color;

        this.isDead = false;
        this.slowEffect = 0;

        // BOSS特殊
        if (type === 'boss') {
            this.attackCooldown = 0;
            this.attackInterval = 5;
        }
    }

    update(deltaTime, playerX, playerY) {
        if (this.isDead) return;

        // 减速效果
        if (this.slowEffect > 0) {
            this.slowEffect -= deltaTime;
        }

        // 向玩家移动
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            const speedMult = this.slowEffect > 0 ? 0.7 : 1.0;
            this.x += (dx / dist) * this.speed * speedMult * deltaTime;
            this.y += (dy / dist) * this.speed * speedMult * deltaTime;
        }

        // BOSS攻击冷却
        if (this.type === 'boss') {
            this.attackCooldown -= deltaTime;
        }
    }

    takeDamage(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
        }
    }

    applySlow() {
        if (this.type === 'elite') {
            this.slowEffect = 2;
        }
    }

    draw(ctx) {
        if (this.isDead) return;

        const enemyImg = Resources.getImage('enemy');
        const size = this.radius * 2;

        if (enemyImg && Resources.useImages) {
            // 使用图片绘制敌人（根据类型选择不同行）
            const typeIndex = { 'minion': 0, 'elite': 1, 'boss': 2 };
            const spriteY = typeIndex[this.type] * size;

            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.drawImage(enemyImg, 0, spriteY, size, size, -size / 2, -size / 2, size, size);
            ctx.restore();
        } else {
            // 降级为纯色绘制
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // 边框
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();

            // BOSS皇冠
            if (this.type === 'boss') {
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.moveTo(this.x - 15, this.y - this.radius);
                ctx.lineTo(this.x - 10, this.y - this.radius - 8);
                ctx.lineTo(this.x - 5, this.y - this.radius - 2);
                ctx.lineTo(this.x, this.y - this.radius - 10);
                ctx.lineTo(this.x + 5, this.y - this.radius - 2);
                ctx.lineTo(this.x + 10, this.y - this.radius - 8);
                ctx.lineTo(this.x + 15, this.y - this.radius);
                ctx.closePath();
                ctx.fill();
            }

            // 精英头盔
            if (this.type === 'elite') {
                ctx.fillStyle = '#666';
                ctx.fillRect(this.x - 12, this.y - this.radius - 5, 24, 8);
            }
        }

        // 血条（总是显示）
        if (this.hp < this.maxHp) {
            const barWidth = this.radius * 2;
            const barHeight = 4;
            const barY = this.y - this.radius - 10;

            ctx.fillStyle = '#000';
            ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);

            ctx.fillStyle = '#ff0000';
            const hpPercent = this.hp / this.maxHp;
            ctx.fillRect(this.x - barWidth / 2, barY, barWidth * hpPercent, barHeight);
        }
    }

    canAttack() {
        return this.type === 'boss' && this.attackCooldown <= 0;
    }

    performAttack() {
        this.attackCooldown = this.attackInterval;
    }
}

// ==================== 经验球类 ====================
class ExpOrb {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.radius = 5;
        this.collected = false;
        this.attractDistance = 100;
        this.attractSpeed = 50;
        this.fastAttractDistance = 300;
        this.fastAttractSpeed = 200;
    }

    update(deltaTime, player, forceAttract) {
        if (this.collected) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 自动吸附或强制吸附
        let shouldAttract = false;
        let speed = this.attractSpeed;

        if (player.autoCollectBuff > 0 || dist < this.attractDistance) {
            shouldAttract = true;
            speed = this.attractSpeed;
        }

        if (forceAttract && dist < this.fastAttractDistance) {
            shouldAttract = true;
            speed = this.fastAttractSpeed;
        }

        if (shouldAttract && dist > 1) {
            this.x += (dx / dist) * speed * deltaTime;
            this.y += (dy / dist) * speed * deltaTime;
        }

        // 检查收集
        if (Utils.circleCollision(this.x, this.y, this.radius, player.x, player.y, player.radius)) {
            this.collected = true;
            return this.value;
        }

        return 0;
    }

    draw(ctx) {
        if (this.collected) return;

        const expOrbImg = Resources.getImage('exp_orb');

        if (expOrbImg && Resources.useImages) {
            // 使用图片绘制经验球
            const size = this.radius * 4;
            ctx.save();
            ctx.globalAlpha = 0.8;
            ctx.translate(this.x, this.y);
            ctx.drawImage(expOrbImg, -size / 2, -size / 2, size, size);
            ctx.restore();
            ctx.globalAlpha = 1.0;
        } else {
            // 降级为渐变色绘制
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2);
            gradient.addColorStop(0, '#ffff00');
            gradient.addColorStop(0.5, '#ffaa00');
            gradient.addColorStop(1, 'rgba(255, 170, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
            ctx.fill();

            // 核心
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ==================== 宝箱类 ====================
class Chest {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 25;
        this.isOpen = false;
        this.collected = false;
        this.glowPhase = 0;
    }

    update(deltaTime, player) {
        if (this.collected) return null;

        this.glowPhase += deltaTime * 3;

        if (!this.isOpen && Utils.circleCollision(this.x, this.y, this.radius, player.x, player.y, player.radius)) {
            this.isOpen = true;
            this.collected = true;
            return this.getRandomReward();
        }

        return null;
    }

    getRandomReward() {
        const rewards = [
            { id: 'weapon_supply', name: '刀刃补给', desc: '获得4把额外刀具，战力飙升！' },
            { id: 'sharp_upgrade', name: '锋利淬炼', desc: '武器伤害永久+10点！' },
            { id: 'auto_collect', name: '自动拾取', desc: '30秒内经验球自动吸附！' },
            { id: 'speed_burst', name: '移速爆发', desc: '移速暴增50%，持续10秒！' },
            { id: 'weapon_swap', name: '武器库', desc: '随机解锁新武器外观！' }
        ];

        return rewards[Utils.randomInt(0, rewards.length - 1)];
    }

    draw(ctx) {
        if (this.collected) return;

        const chestImg = Resources.getImage('chest');

        // 发光效果（总是显示）
        const glowRadius = this.radius + Math.sin(this.glowPhase) * 5;
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRadius);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        if (chestImg && Resources.useImages) {
            // 使用图片绘制宝箱
            const size = this.radius * 2;
            const frame = this.isOpen ? 1 : 0; // 0=关闭, 1=打开
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.drawImage(chestImg, 0, frame * size, size, size, -size / 2, -size / 2, size, size);
            ctx.restore();
        } else {
            // 降级为矩形绘制
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(this.x - this.radius * 0.6, this.y - this.radius * 0.4, this.radius * 1.2, this.radius * 0.8);

            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x - this.radius * 0.6, this.y - this.radius * 0.4, this.radius * 1.2, this.radius * 0.8);

            // 锁
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ==================== 粒子效果 ====================
class Particle {
    constructor(x, y, color, size, vx, vy, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
    }

    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.life -= deltaTime;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    isDead() {
        return this.life <= 0;
    }
}

// ==================== 游戏主类 ====================
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 1200;
        this.canvas.height = 800;

        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.arenaRadius = 500;

        this.audio = new AudioManager();

        this.keys = {};
        this.mousePressed = false;

        this.init();
        this.setupInput();
        this.showWelcome();
    }

    init() {
        this.state = 'playing'; // 'playing', 'paused', 'levelup', 'gameover', 'victory'
        this.isPaused = false;

        this.player = new Player(this.centerX, this.centerY);
        this.enemies = [];
        this.expOrbs = [];
        this.chests = [];
        this.particles = [];

        this.score = 0;
        this.killCount = 0;
        this.survivalTime = 0;

        this.enemySpawnTimer = 0;
        this.eliteSpawnTimer = 0;
        this.chestSpawnTimer = 0;

        this.bossSpawned = false;
        this.bossAlive = false;

        this.lastTime = performance.now();
        this.gameLoop();
    }

    showWelcome() {
        const welcomeMsg = document.getElementById('welcomeMsg');
        const controlHint = document.getElementById('controlHint');

        welcomeMsg.classList.add('show');
        setTimeout(() => {
            welcomeMsg.classList.remove('show');
            controlHint.classList.add('show');
            setTimeout(() => {
                controlHint.classList.remove('show');
            }, 5000);
        }, 3000);
    }

    setupInput() {
        // 键盘
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', (e) => {
            delete this.keys[e.key.toLowerCase()];
        });

        // 鼠标
        this.canvas.addEventListener('mousedown', (e) => {
            this.mousePressed = true;
            this.handleMouseMove(e);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.mousePressed) {
                this.handleMouseMove(e);
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.mousePressed = false;
        });

        window.addEventListener('mouseup', () => {
            this.mousePressed = false;
        });
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

        this.player.targetX = x;
        this.player.targetY = y;
    }

    gameLoop() {
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // 最大0.1秒，防止大跳跃
        this.lastTime = currentTime;

        if (this.state === 'playing') {
            this.update(deltaTime);
        }

        this.render();
        this.updateUI();

        requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        this.survivalTime += deltaTime;

        // 更新玩家
        const forceAttract = this.keys[' '] || this.keys['space'];
        this.player.update(deltaTime, this.keys, this.arenaRadius);

        // 检查升级
        if (this.player.checkLevelUp()) {
            this.showSkillSelection();
            this.audio.play('levelup');
        }

        // 更新敌人
        this.enemies.forEach(enemy => {
            enemy.update(deltaTime, this.player.x, this.player.y);

            // 检查玩家碰撞
            if (Utils.circleCollision(enemy.x, enemy.y, enemy.radius, this.player.x, this.player.y, this.player.radius)) {
                this.player.takeDamage(enemy.damage);
                if (enemy.type === 'elite') {
                    // 精英减速玩家（暂不实现复杂效果）
                }
            }

            // 检查武器碰撞
            const weaponPositions = this.player.getWeaponPositions();
            weaponPositions.forEach(wp => {
                if (Utils.circleCollision(wp.x, wp.y, 8, enemy.x, enemy.y, enemy.radius)) {
                    enemy.takeDamage(this.player.weaponDamage);
                    this.audio.play('hit');

                    if (enemy.isDead) {
                        this.killEnemy(enemy);
                    }
                }
            });

            // BOSS范围攻击
            if (enemy.canAttack()) {
                enemy.performAttack();
                this.createBossAttackWarning(enemy.x, enemy.y);

                setTimeout(() => {
                    const dist = Utils.distance(this.player.x, this.player.y, enemy.x, enemy.y);
                    if (dist < 200) {
                        this.player.takeDamage(15);
                    }
                }, 500);
            }
        });

        // 移除死亡敌人
        this.enemies = this.enemies.filter(e => !e.isDead);

        // 更新经验球
        this.expOrbs.forEach(orb => {
            const gained = orb.update(deltaTime, this.player, forceAttract);
            if (gained > 0) {
                this.player.gainExp(gained);
                this.audio.play('levelup');
            }
        });
        this.expOrbs = this.expOrbs.filter(orb => !orb.collected);

        // 更新宝箱
        this.chests.forEach(chest => {
            const reward = chest.update(deltaTime, this.player);
            if (reward) {
                this.applyChestReward(reward);
                this.audio.play('chest_open');
            }
        });
        this.chests = this.chests.filter(chest => !chest.collected);

        // 更新粒子
        this.particles.forEach(p => p.update(deltaTime));
        this.particles = this.particles.filter(p => !p.isDead());

        // 生成敌人
        this.spawnEnemies(deltaTime);

        // 生成宝箱
        this.chestSpawnTimer += deltaTime;
        if (this.chestSpawnTimer >= 45) {
            this.spawnChest();
            this.chestSpawnTimer = 0;
        }

        // 检查BOSS生成
        if (!this.bossSpawned && (this.player.level >= 10 || this.survivalTime >= 120)) {
            this.spawnBoss();
        }

        // 检查死亡
        if (this.player.hp <= 0) {
            this.gameOver(false);
        }

        // 更新得分
        this.score = this.killCount * 10 + Math.floor(this.survivalTime) * 2;
    }

    spawnEnemies(deltaTime) {
        // 小兵刷新
        this.enemySpawnTimer += deltaTime;
        if (this.enemySpawnTimer >= 10) {
            const count = Math.min(3 + Math.floor(this.survivalTime / 60), 8);
            for (let i = 0; i < count; i++) {
                this.spawnEnemy('minion');
            }
            this.enemySpawnTimer = 0;
        }

        // 精英刷新
        if (this.survivalTime >= 30) {
            this.eliteSpawnTimer += deltaTime;
            if (this.eliteSpawnTimer >= 30) {
                this.spawnEnemy('elite');
                this.eliteSpawnTimer = 0;
            }
        }
    }

    spawnEnemy(type) {
        const angle = Utils.randomFloat(0, Math.PI * 2);
        const x = this.centerX + Math.cos(angle) * this.arenaRadius;
        const y = this.centerY + Math.sin(angle) * this.arenaRadius;

        this.enemies.push(new Enemy(x, y, type));
    }

    spawnChest() {
        let attempts = 0;
        while (attempts < 10) {
            const angle = Utils.randomFloat(0, Math.PI * 2);
            const dist = Utils.randomFloat(0, this.arenaRadius - 100);
            const x = this.centerX + Math.cos(angle) * dist;
            const y = this.centerY + Math.sin(angle) * dist;

            // 检查是否太近
            const tooClose = Utils.distance(x, y, this.player.x, this.player.y) < 80;
            if (!tooClose) {
                this.chests.push(new Chest(x, y));
                break;
            }
            attempts++;
        }
    }

    spawnBoss() {
        this.bossSpawned = true;
        this.bossAlive = true;

        const angle = Utils.randomFloat(0, Math.PI * 2);
        const x = this.centerX + Math.cos(angle) * this.arenaRadius;
        const y = this.centerY + Math.sin(angle) * this.arenaRadius;

        this.enemies.push(new Enemy(x, y, 'boss'));

        this.showBossWarning();
        this.audio.play('boss_appear');
    }

    killEnemy(enemy) {
        this.killCount++;

        // 掉落经验球
        for (let i = 0; i < 3; i++) {
            const offsetX = Utils.randomFloat(-20, 20);
            const offsetY = Utils.randomFloat(-20, 20);
            this.expOrbs.push(new ExpOrb(enemy.x + offsetX, enemy.y + offsetY, enemy.exp / 3));
        }

        // 粒子效果
        for (let i = 0; i < 10; i++) {
            const angle = Utils.randomFloat(0, Math.PI * 2);
            const speed = Utils.randomFloat(50, 150);
            this.particles.push(new Particle(
                enemy.x, enemy.y,
                enemy.color,
                Utils.randomFloat(2, 5),
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                Utils.randomFloat(0.3, 0.8)
            ));
        }

        // 检查BOSS死亡
        if (enemy.type === 'boss') {
            this.bossAlive = false;
            this.score += 50;
            this.gameOver(true);
        }
    }

    createBossAttackWarning(x, y) {
        // 创建警告圈粒子
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            const radius = 200;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;

            this.particles.push(new Particle(
                px, py,
                '#ff0000',
                4,
                0, 0,
                0.5
            ));
        }
    }

    applyChestReward(reward) {
        switch (reward.id) {
            case 'weapon_supply':
                this.player.weaponCount = Math.min(8, this.player.weaponCount + 4);
                break;
            case 'sharp_upgrade':
                this.player.weaponDamage += 10;
                break;
            case 'auto_collect':
                this.player.autoCollectBuff = 30;
                break;
            case 'speed_burst':
                this.player.speedBuff = 1.5;
                setTimeout(() => {
                    this.player.speedBuff = 1.0;
                }, 10000);
                break;
            case 'weapon_swap':
                this.player.weaponType = Utils.randomInt(0, 4);
                break;
        }

        this.showRewardNotification(reward.name, reward.desc);
    }

    showRewardNotification(name, desc) {
        // 简单通知（可以后续改进）
        console.log(`获得奖励: ${name} - ${desc}`);
    }

    showSkillSelection() {
        this.state = 'levelup';
        const modal = document.getElementById('skillModal');
        const selection = document.getElementById('skillSelection');

        // 随机选择3个技能
        const skills = this.getRandomSkills(3);

        selection.innerHTML = '';
        skills.forEach(skill => {
            const card = document.createElement('div');
            card.className = 'skill-card';
            card.innerHTML = `
                <div class="skill-type type-${skill.type}">${skill.typeName}</div>
                <div class="skill-name">${skill.name}</div>
                <div class="skill-desc">${skill.desc}</div>
            `;
            card.onclick = () => this.selectSkill(skill);
            selection.appendChild(card);
        });

        modal.classList.add('active');

        // 倒计时自动选择
        let countdown = 3;
        const countdownEl = document.getElementById('skillCountdown');
        const timer = setInterval(() => {
            countdown--;
            countdownEl.textContent = `${countdown}秒后自动选择`;
            if (countdown <= 0) {
                clearInterval(timer);
                this.selectSkill(skills[Utils.randomInt(0, 2)]);
            }
        }, 1000);
        countdownEl.textContent = `${countdown}秒后自动选择`;
    }

    getRandomSkills(count) {
        const allSkills = [
            { id: 'add_weapon', name: '飞刀+1', type: 'attack', typeName: '进攻', desc: '额外增加1把旋转飞刀，刀阵更密集！' },
            { id: 'damage_boost', name: '飞刀伤害+10%', type: 'attack', typeName: '进攻', desc: '所有飞刀伤害永久提升10%！' },
            { id: 'radius_expand', name: '旋转半径+10px', type: 'attack', typeName: '进攻', desc: '飞刀攻击范围扩大，更安全！' },
            { id: 'rotate_faster', name: '加速转刀', type: 'attack', typeName: '进攻', desc: '转刀速度提升25%，砍怪更快！' },
            { id: 'hp_boost', name: '生命值+20', type: 'defense', typeName: '生存', desc: '永久提升生命上限并回复20点！' },
            { id: 'speed_boost', name: '移动速度+5%', type: 'defense', typeName: '生存', desc: '移速提升5%，躲避更轻松！' },
            { id: 'defense_up', name: '防御强化', type: 'defense', typeName: '生存', desc: '受到的伤害降低10%！' },
            { id: 'emergency_heal', name: '紧急救援', type: 'defense', typeName: '生存', desc: '立即回复40点生命值，绝境翻盘！' },
            { id: 'exp_magnet', name: '经验磁铁', type: 'utility', typeName: '功能', desc: '瞬间吸收全场经验球！' }
        ];

        const shuffled = allSkills.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    selectSkill(skill) {
        const modal = document.getElementById('skillModal');
        modal.classList.remove('active');

        this.applySkill(skill);
        this.state = 'playing';
        this.audio.play('levelup');
    }

    applySkill(skill) {
        switch (skill.id) {
            case 'add_weapon':
                this.player.weaponCount = Math.min(8, this.player.weaponCount + 1);
                break;
            case 'damage_boost':
                this.player.weaponDamage *= 1.1;
                break;
            case 'radius_expand':
                this.player.weaponRadius = Math.min(150, this.player.weaponRadius + 10);
                break;
            case 'rotate_faster':
                this.player.rotateSpeed *= 1.25;
                break;
            case 'hp_boost':
                this.player.maxHp += 20;
                this.player.hp += 20;
                break;
            case 'speed_boost':
                this.player.speed = Math.min(200, this.player.speed * 1.05);
                break;
            case 'defense_up':
                this.player.defenseRate = Math.min(0.5, this.player.defenseRate + 0.1);
                break;
            case 'emergency_heal':
                this.player.heal(40);
                break;
            case 'exp_magnet':
                this.expOrbs.forEach(orb => orb.collected = true);
                this.player.gainExp(this.expOrbs.reduce((sum, orb) => sum + orb.value, 0));
                break;
        }
    }

    showBossWarning() {
        const modal = document.getElementById('bossModal');
        modal.classList.add('active');

        setTimeout(() => {
            modal.classList.remove('active');
        }, 3000);
    }

    gameOver(victory) {
        this.state = 'gameover';

        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const message = document.getElementById('gameOverMessage');
        const stats = document.getElementById('finalStats');

        if (victory) {
            title.textContent = '恭喜胜利！';
            message.textContent = '你击败了BOSS，游戏胜利！';
            this.audio.play('gameover', 1.2);
        } else {
            title.textContent = '游戏结束';
            message.textContent = '你已经倒下……';
            this.audio.play('gameover', 0.8);
        }

        stats.innerHTML = `
            <div class="stat-line">最终得分: ${this.score}</div>
            <div class="stat-line">击杀总数: ${this.killCount}</div>
            <div class="stat-line">存活时间: ${Utils.formatTime(this.survivalTime)}</div>
            <div class="stat-line">最高等级: Lv.${this.player.level}</div>
        `;

        modal.classList.add('active');
    }

    restart() {
        document.getElementById('gameOverModal').classList.remove('active');
        this.init();
    }

    render() {
        const ctx = this.ctx;
        const backgroundImg = Resources.getImage('background');

        // 绘制背景
        if (backgroundImg && Resources.useImages) {
            // 使用背景图片
            ctx.drawImage(backgroundImg, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            // 降级为渐变色
            ctx.fillStyle = '#7EC850';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 绘制战场
        ctx.save();
        ctx.translate(this.centerX, this.centerY);

        // 战场背景（半透明圆形）
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.arenaRadius);
        gradient.addColorStop(0, 'rgba(142, 217, 96, 0.3)');
        gradient.addColorStop(1, 'rgba(90, 171, 48, 0.5)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.arenaRadius, 0, Math.PI * 2);
        ctx.fill();

        // 战场边界
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.restore();

        // 绘制游戏对象（相对于中心坐标系）
        ctx.save();

        // 粒子
        this.particles.forEach(p => p.draw(ctx));

        // 宝箱
        this.chests.forEach(chest => chest.draw(ctx));

        // 经验球
        this.expOrbs.forEach(orb => orb.draw(ctx));

        // 敌人
        this.enemies.forEach(enemy => enemy.draw(ctx));

        // 玩家
        this.player.draw(ctx);

        ctx.restore();
    }

    updateUI() {
        // 血条
        const hpPercent = (this.player.hp / this.player.maxHp) * 100;
        document.getElementById('hpBar').style.width = hpPercent + '%';
        document.getElementById('hpText').textContent = `HP: ${Math.ceil(this.player.hp)}/${this.player.maxHp}`;

        // 经验条
        const expPercent = (this.player.exp / this.player.expToLevel) * 100;
        document.getElementById('expBar').style.width = expPercent + '%';
        document.getElementById('expText').textContent = `${Math.floor(this.player.exp)}/${this.player.expToLevel}`;

        // 等级
        document.getElementById('levelText').textContent = `Lv.${this.player.level}`;

        // 战力
        document.getElementById('powerText').textContent = `战力: ${this.player.getPower()}`;

        // 底部统计
        document.getElementById('killText').textContent = `击杀: ${this.killCount}`;
        document.getElementById('timeText').textContent = `时间: ${Utils.formatTime(this.survivalTime)}`;
        document.getElementById('scoreText').textContent = `得分: ${this.score}`;
    }
}

// 启动游戏
let game;
window.addEventListener('load', async () => {
    // 显示加载界面
    showLoadingScreen();

    // 加载资源
    await Resources.loadAll();

    // 隐藏加载界面
    hideLoadingScreen();

    // 启动游戏
    game = new Game();
});

function showLoadingScreen() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // 绘制加载背景
    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制标题
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('鸠摩智转刀', canvas.width / 2, canvas.height / 2 - 50);

    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.fillText('加载中...', canvas.width / 2, canvas.height / 2 + 20);

    // 进度条动画
    let progress = 0;
    const loadingInterval = setInterval(() => {
        progress = Resources.getProgress();

        // 绘制进度条背景
        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(0, canvas.height / 2 + 50, canvas.width, 30);

        const barWidth = 400;
        const barHeight = 20;
        const barX = (canvas.width - barWidth) / 2;
        const barY = canvas.height / 2 + 60;

        // 进度条背景
        ctx.fillStyle = '#34495e';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // 进度条填充
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(barX, barY, barWidth * (progress / 100), barHeight);

        // 进度文字
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.fillText(`${Math.floor(progress)}%`, canvas.width / 2, barY + barHeight + 25);

        if (progress >= 100) {
            clearInterval(loadingInterval);
        }
    }, 100);
}

function hideLoadingScreen() {
    // 清空画布（会在Game.render中重绘）
    console.log('资源加载完成！');
}
