import * as THREE from 'three';

/** * 1. CONFIGURACIÓN Y RECURSOS */
const CONFIG = {
    lanes: 5,
    rows: 6,
    laneWidth: 3.2,
    rowHeight: 3.8, // Este es el paso entre filas
    fireRate: 600,
    spawnRate: 3000,
    totalWidth: 16,
    totalHeight: 22.8
};

const ENEMY_STATS = { maxHealth: 150, bulletDamage: 25 };
const COSTS = { tower: 50 };

const container = document.getElementById('game-container');
const canvas = document.getElementById('gameCanvas');

const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true,
    powerPreference: "high-performance",
    depth: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0x000000);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);

const loader = new THREE.TextureLoader();
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

/** * MODIFICACIÓN EN SETUPTEX: Quitamos el zoom excesivo para que no se vea mal */
const setupTex = (url, isGrass = false) => {
    const t = loader.load(url);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = maxAnisotropy;
    t.generateMipmaps = true;
    t.colorSpace = THREE.SRGBColorSpace;

    if (isGrass) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        // MODIFICADO: Zoom original (1.0) y sin offset. Con transparencia activada abajo,
        // los bordes negros (si son transparentes) desaparecerán.
        t.repeat.set(1.0, 1.0);
        t.offset.set(0, 0);
    }
    return t;
};
const towerTextures = [setupTex('assets/player-1.png'), setupTex('assets/player-2.png'), setupTex('assets/player-3.png'), setupTex('assets/player-4.png')];
const enemyTextures = [setupTex('assets/zomb-ox.png'), setupTex('assets/zomb-me.png')];
const batTexture = setupTex('assets/bat.png');
const coreTexture = setupTex('assets/nucleo.png');
const bossTexture = setupTex('assets/boss.png');
const bulletTexture = setupTex('assets/proyectil-1.png');
const bulletTexture2 = setupTex('assets/proyectil-2.png');
const bulletTexture3 = setupTex('assets/proyectil-3.png');
const bulletTexture3_1 = setupTex('assets/proyectil-3.1.png');
const swordTexture = setupTex('assets/efecto-espada.png');
const coinTexture = setupTex('assets/oro-2.png');

/** * 2. ESTADO DEL JUEGO */
let enemies = [], bullets = [], connections = [], worldCoins = [];
let gold = 150, maxHealth = 150, health = 150;
let lastSpawn = 0;
let lastBossAttack = 0;
let gameActive = false;
let shakeIntensity = 0;
let bossSpawned = false, bossActive = false;
let bossWarningShown = false, bossWarningActive = false, bossWarningStartTime = 0;
let nextTowerIndex = 0; // PREVIEW STATE
const towerAssets = ['assets/player-1.png', 'assets/player-2.png', 'assets/player-3.png', 'assets/player-4.png'];

// GHOST PLACEMENT SPRITE
const placementGhost = new THREE.Sprite(new THREE.SpriteMaterial({
    map: towerTextures[0],
    transparent: true,
    opacity: 0.5,
    color: 0xcccccc, // Grayish
    depthWrite: false
}));
placementGhost.scale.set(3, 3, 1);
placementGhost.visible = false;
scene.add(placementGhost);

let startTime = 0; // GLOBAL START TIME

/** * 3. FUNCIONES DE CONTROL */
window.initGame = function () {
    gameActive = true;
    lastSpawn = performance.now();
    startTime = performance.now(); // Fix: Match performance.now() used in animate
    bossSpawned = false;
    bossActive = false;
    bossWarningShown = false;
    bossWarningActive = false;

    // init preview
    nextTowerIndex = getNewRandomTower(-1);
    updatePreviewUI();
};

function getNewRandomTower(exclude) {
    let newIdx;
    do {
        newIdx = Math.floor(Math.random() * towerTextures.length);
    } while (newIdx === exclude && towerTextures.length > 1);
    return newIdx;
}

window.rerollTower = function () {
    if (gold >= 10) {
        gold -= 10;
        nextTowerIndex = getNewRandomTower(nextTowerIndex);
        updatePreviewUI();
    } else {
        const btn = document.querySelector('.btn-reroll');
        if (btn) {
            btn.style.backgroundColor = '#e74c3c';
            setTimeout(() => btn.style.backgroundColor = '#4caf50', 200);
        }
    }
};

function updatePreviewUI() {
    let container = document.getElementById('next-tower-preview');
    if (!container) {
        container = document.createElement('div');
        container.id = 'next-tower-preview';
        container.innerHTML = `
            <div class="preview-label">NEXT</div>
            <img id="preview-img-el" class="preview-img" src="" />
            <button class="btn-reroll" onclick="rerollTower()"><div>↻</div><div>10g</div></button>
        `;
        document.getElementById('bottom-ui').appendChild(container);
    }

    const img = document.getElementById('preview-img-el');
    if (img) img.src = towerAssets[nextTowerIndex];
}

/** * 4. FUNCIONES DE CREACIÓN */

function createCable(tower) {
    const corePos = new THREE.Vector3(0, 2.0, (CONFIG.totalHeight / 2) + 2.8);
    const towerPos = new THREE.Vector3(tower.mesh.position.x, 0.4, tower.mesh.position.z);
    const points = [
        corePos,
        new THREE.Vector3(corePos.x, 0.5, corePos.z - 1.5),
        new THREE.Vector3(towerPos.x, 0.5, towerPos.z + 1.5),
        towerPos
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 64, 0.08, 12, false);
    const material = new THREE.MeshStandardMaterial({
        color: 0x050505, emissive: 0x00f2ff, emissiveIntensity: 1.2, roughness: 0.3
    });
    const cable = new THREE.Mesh(geometry, material);
    scene.add(cable);
    return cable;
}

function spawnCoin(x, z) {
    const material = new THREE.SpriteMaterial({ map: coinTexture, transparent: true, depthWrite: false });
    const coin = new THREE.Sprite(material);
    coin.scale.set(1.5, 1.5, 1);
    coin.position.set(x, 1.2, z);
    scene.add(coin);
    worldCoins.push({ mesh: coin, born: performance.now(), vy: 0.2, yPos: 1.2 });
}

function createFloatingText(x, z, text) {
    const group = new THREE.Group();
    const canvasT = document.createElement('canvas');
    const ctx = canvasT.getContext('2d');
    canvasT.width = 512; canvasT.height = 256;
    ctx.font = "Bold 100px Arial";
    ctx.fillStyle = text.includes('-') ? "#ff4757" : "#f1c40f";
    ctx.textAlign = "right";
    const cleanText = text.replace(/[^\d+-]/g, '');
    ctx.fillText(cleanText, 320, 150);
    const txtTexture = new THREE.CanvasTexture(canvasT);
    const txtSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: txtTexture, transparent: true, depthWrite: false }));
    txtSprite.scale.set(4, 2, 1);
    group.add(txtSprite);
    const iconSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: coinTexture, transparent: true, depthWrite: false }));
    iconSprite.scale.set(0.8, 0.8, 1);
    iconSprite.position.set(0.8, 0.1, 0);
    group.add(iconSprite);
    group.position.set(x, 4, z);
    scene.add(group);

    let start = Date.now();
    const anim = () => {
        let elapsed = Date.now() - start;
        let delta = elapsed / 1000;
        group.position.y += 0.04;
        txtSprite.material.opacity = 1 - delta;
        iconSprite.material.opacity = 1 - delta;
        if (delta < 1) { requestAnimationFrame(anim); }
        else {
            scene.remove(group);
            txtTexture.dispose();
            txtSprite.material.dispose();
            iconSprite.material.dispose();
        }
    };
    anim();
}

function removeTower(index) {
    const tower = connections[index];
    gold += 25;
    createFloatingText(tower.mesh.position.x, tower.mesh.position.z, "+25");
    scene.remove(tower.mesh);
    if (tower.cable) {
        scene.remove(tower.cable);
        tower.cable.geometry.dispose();
        tower.cable.material.dispose();
    }
    connections.splice(index, 1);
}

// Local showGameOver/showVictory removed in favor of global progression.js version

/** * 5. ESCENA E ILUMINACIÓN */
function updateCamera() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    if (w < h) { camera.fov = 42; camera.position.set(0, 28, 25); }
    else { camera.fov = 22; camera.position.set(0, 20, 18); }
    camera.lookAt(0, 0, 2);
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', updateCamera);
updateCamera();

scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(10, 40, 20);
sun.castShadow = true;
scene.add(sun);

// --- SECCIÓN CÉSPED: TILES INDEPENDIENTES (Ajuste 400x604 + Corrección Visual) ---
const grassGroup = new THREE.Group();

// 1. CREAR TEXTURA DE CÉSPED PROCEDURAL REALISTA
function createGrassTexture(baseColor, seed = Math.random()) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Usar seed para variación controlada
    let random = seed;
    const seededRandom = () => {
        random = (random * 9301 + 49297) % 233280;
        return random / 233280;
    };

    // Fondo base con gradiente sutil
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 400);
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(1, baseColor === '#2ecc71' ? '#27ae60' : '#1e8449');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Paleta de colores más rica y natural
    const darkColors = ['#1b4332', '#1e5631', '#2d6a4f', '#1a472a', '#154734'];
    const midColors = ['#27ae60', '#229954', '#2ecc71', '#28a745', '#20c997'];
    const lightColors = ['#3ddc84', '#48c774', '#52c77a', '#5dd39e', '#6fdc8c'];
    const highlightColors = ['#7ee8a0', '#90ee90', '#98fb98', '#8fbc8f'];

    // CAPA 1: Sombras base (zonas oscuras)
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 200; i++) {
        const x = seededRandom() * 512;
        const y = seededRandom() * 512;
        const radius = seededRandom() * 30 + 15;
        const color = darkColors[Math.floor(seededRandom() * darkColors.length)];

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // CAPA 2: Briznas de césped densas (capa base)
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 8000; i++) {
        const x = seededRandom() * 512;
        const y = seededRandom() * 512;
        const color = midColors[Math.floor(seededRandom() * midColors.length)];
        const width = seededRandom() * 1.5 + 0.5;
        const height = seededRandom() * 4 + 2;
        const angle = seededRandom() * 0.4 - 0.2; // Ligera inclinación

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.fillRect(-width / 2, 0, width, height);
        ctx.restore();
    }

    // CAPA 3: Briznas más largas y visibles
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 3000; i++) {
        const x = seededRandom() * 512;
        const y = seededRandom() * 512;
        const color = lightColors[Math.floor(seededRandom() * lightColors.length)];
        const width = seededRandom() * 1.2 + 0.8;
        const height = seededRandom() * 6 + 3;
        const angle = seededRandom() * 0.6 - 0.3;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Gradiente en la brizna para más realismo
        const bladeGradient = ctx.createLinearGradient(0, 0, 0, height);
        bladeGradient.addColorStop(0, color);
        bladeGradient.addColorStop(1, darkColors[Math.floor(seededRandom() * darkColors.length)]);
        ctx.fillStyle = bladeGradient;
        ctx.fillRect(-width / 2, 0, width, height);
        ctx.restore();
    }

    // CAPA 4: Detalles finos (briznas muy pequeñas)
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 5000; i++) {
        const x = seededRandom() * 512;
        const y = seededRandom() * 512;
        const color = midColors[Math.floor(seededRandom() * midColors.length)];
        const size = seededRandom() * 2 + 0.5;

        ctx.fillStyle = color;
        ctx.fillRect(x, y, size * 0.4, size);
    }

    // CAPA 5: Highlights (puntos brillantes)
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 800; i++) {
        const x = seededRandom() * 512;
        const y = seededRandom() * 512;
        const color = highlightColors[Math.floor(seededRandom() * highlightColors.length)];
        const width = seededRandom() * 1 + 0.3;
        const height = seededRandom() * 3 + 1;

        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
    }

    // CAPA 6: Textura de profundidad (puntos oscuros muy pequeños)
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 2000; i++) {
        const x = seededRandom() * 512;
        const y = seededRandom() * 512;
        const size = seededRandom() * 1.5;

        ctx.fillStyle = darkColors[0];
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;

    return texture;
}

const grassTexA = createGrassTexture('#2ecc71', 0.123); // Verde claro
const grassTexB = createGrassTexture('#27ae60', 0.456); // Verde oscuro

const texA = new THREE.MeshBasicMaterial({ map: grassTexA, side: THREE.FrontSide });
const texB = new THREE.MeshBasicMaterial({ map: grassTexB, side: THREE.FrontSide });



// 2. GENERAR 30 BLOQUES INDEPENDIENTES (5x6)
// Escala 0.998 para que los huecos sean líneas de un solo píxel (casi pegados)
const visualTileW = CONFIG.laneWidth * 0.998;
const visualTileH = CONFIG.rowHeight * 0.998;
const tileGeometry = new THREE.PlaneGeometry(visualTileW, visualTileH);

for (let r = 0; r < CONFIG.rows; r++) {
    for (let c = 0; c < CONFIG.lanes; c++) {
        const isTypeA = (r + c) % 2 === 0;
        const tileMat = isTypeA ? texA : texB;


        const tileMesh = new THREE.Mesh(tileGeometry, tileMat);
        tileMesh.rotation.x = -Math.PI / 2;

        const posX = (c * CONFIG.laneWidth) - (CONFIG.totalWidth / 2) + (CONFIG.laneWidth / 2);
        const posZ = (r * CONFIG.rowHeight) - (CONFIG.totalHeight / 2) + (CONFIG.rowHeight / 2);

        tileMesh.position.set(posX, 0, posZ);
        tileMesh.userData = { col: c, row: r };

        grassGroup.add(tileMesh);
    }
}
scene.add(grassGroup);

// LÍNEA DIVISORIA EN EL MEDIO DEL CAMPO (entre fila 2 y 3)
// El campo tiene 6 filas (0-5), la línea va entre la fila 2 y 3
const dividerZ = (3 * CONFIG.rowHeight) - (CONFIG.totalHeight / 2);
const dividerGeometry = new THREE.PlaneGeometry(CONFIG.totalWidth, 0.15);
const dividerMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide
});
const dividerLine = new THREE.Mesh(dividerGeometry, dividerMaterial);
dividerLine.rotation.x = -Math.PI / 2;
dividerLine.position.set(0, 0.02, dividerZ); // Ligeramente por encima del césped
scene.add(dividerLine);


const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTexture }));
coreSprite.position.set(0, 3.8, (CONFIG.totalHeight / 2) + 4.5);
coreSprite.scale.set(7.5, 7.5, 1);
scene.add(coreSprite);

function updateHealthBar() {
    const pct = Math.max(0, health / maxHealth);
    const bar = document.getElementById('health-bar');
    if (bar) {
        bar.style.width = (pct * 100) + '%';

        // Dynamic Color Logic: Green -> Yellow -> Orange -> Red
        if (pct > 0.6) {
            bar.style.backgroundColor = "#2ecc71"; // Green
        } else if (pct > 0.35) {
            bar.style.backgroundColor = "#f1c40f"; // Yellow
        } else if (pct > 0.15) {
            bar.style.backgroundColor = "#e67e22"; // Orange
        } else {
            bar.style.backgroundColor = "#e74c3c"; // Red
        }
    }
}
// BOSS HEALTH BAR (Serán añadidas al grupo del Boss en el spawn)
let bossHealthBarBg, bossHealthBarFill;

function updateBossHealthBar(current, max) {
    if (!bossHealthBarFill) return;
    const pct = Math.max(0, current / max);
    bossHealthBarFill.scale.x = pct;
    bossHealthBarFill.position.x = -(5.8 * (1 - pct)) / 2;
}

/** * 6. BUCLE DE ANIMACIÓN */
function animate() {
    requestAnimationFrame(animate);
    if (!gameActive) { renderer.render(scene, camera); return; }

    const now = performance.now();
    const time = now * 0.005;

    // Spawn enemigos
    const elapsedSeconds = (now - startTime) / 1000;

    if (elapsedSeconds < 80 && !bossWarningShown) {
        if (now - lastSpawn > CONFIG.spawnRate) {
            const lane = Math.floor(Math.random() * CONFIG.lanes);

            // 15% Chance for Bat
            const isBat = Math.random() < 0.15;
            let tex, spr, hp, speed;

            if (isBat) {
                tex = batTexture;
                hp = 60; // Less HP
                // Bats might fly higher? Let's keep them at ground level for simplicity or slightly Floating
                spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
                spr.scale.set(3.0, 3.0, 1);
                spr.position.y = 2.5; // Flying slightly higher
            } else {
                tex = enemyTextures[Math.floor(Math.random() * enemyTextures.length)];
                hp = ENEMY_STATS.maxHealth;
                spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
                spr.scale.set(3.5, 3.5, 1);
                spr.position.y = 1.75;
            }

            const group = new THREE.Group();
            group.add(spr);
            group.position.set((lane * CONFIG.laneWidth) - (CONFIG.totalWidth / 2) + (CONFIG.laneWidth / 2), 0, -(CONFIG.totalHeight / 2) - 2);
            scene.add(group);
            enemies.push({ mesh: group, hp: hp, lane, sprite: spr, isBat: isBat });
            lastSpawn = now;
        }
    } else if (!bossSpawned) {
        if (!bossWarningShown) {
            // MOSTRAR AVISO
            const warning = document.createElement('div');
            warning.id = 'boss-warning';
            warning.className = 'boss-warning-overlay';
            warning.innerHTML = `
                <div class="boss-warning-banner">
                    <div class="boss-warning-text">Boss is Coming</div>
                </div>
            `;
            document.getElementById('game-container').appendChild(warning);

            // LIMPIAR ENEMIGOS
            enemies.forEach(en => scene.remove(en.mesh));
            enemies = [];

            bossWarningShown = true;
            bossWarningActive = true;
            bossWarningStartTime = now;
        }

        if (bossWarningActive && now - bossWarningStartTime > 4000) {
            // QUITAR AVISO
            const warning = document.getElementById('boss-warning');
            if (warning) warning.remove();
            bossWarningActive = false;

            // SPAWN BOSS REAL
            const group = new THREE.Group();
            const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: bossTexture, transparent: true, depthWrite: false }));
            spr.scale.set(12, 12, 1); spr.position.y = 4;
            group.add(spr);

            // Barra de vida SOBRE el boss
            bossHealthBarBg = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.6), new THREE.MeshBasicMaterial({ color: 0x000000 }));
            bossHealthBarBg.position.set(0, 10.5, 0); // Posición relativa al grupo
            group.add(bossHealthBarBg);

            bossHealthBarFill = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 0.4), new THREE.MeshBasicMaterial({ color: 0xe74c3c }));
            bossHealthBarFill.position.set(0, 10.5, 0.01); // Un poco por delante
            group.add(bossHealthBarFill);

            // Center lane
            group.position.set(0, 0, -(CONFIG.totalHeight / 2) - 5);
            scene.add(group);
            enemies.push({ mesh: group, hp: 3000, maxHp: 3000, lane: 2, sprite: spr, isBoss: true });
            bossSpawned = true;
            bossActive = true;
            updateBossHealthBar(3000, 3000);

            // RESET PLAYER 3 (Type 2) ON BOSS SPAWN
            connections.forEach(c => {
                if (c.type === 2) {
                    c.ammo = 8;
                    c.reloading = false;
                    c.mesh.children[0].material.color.set(0xffffff);
                }
            });
            // Floating text for boss
            createFloatingText(0, -10, "BOSS INCOMING");
        }
    }

    // Balas
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];

        // BOSS BULLET LOGIC
        if (b.isBossBullet) {
            const target = b.target;
            // Check if target still exists
            if (!connections.includes(target)) {
                scene.remove(b.mesh); bullets.splice(i, 1);
                continue;
            }

            const dir = new THREE.Vector3().subVectors(target.mesh.position, b.mesh.position).normalize();
            b.mesh.position.add(dir.multiplyScalar(0.4)); // Boss bullets slower?

            if (b.mesh.position.distanceTo(target.mesh.position) < 1.0) {
                // Hit tower
                target.hp -= 1;
                // Flash tower red
                target.mesh.children[0].material.color.set(0xff0000);
                setTimeout(() => { if (connections.includes(target)) target.mesh.children[0].material.color.set(0xffffff); }, 200);

                createFloatingText(target.mesh.position.x, target.mesh.position.z, "-1 HP");
                scene.remove(b.mesh); bullets.splice(i, 1);

                if (target.hp <= 0) {
                    removeTower(connections.indexOf(target));
                }
                continue;
            }
            continue;
        }

        // Sword Logic (Player 2)
        if (b.isSword) {
            const elapsed = now - b.startTime;
            const progress = Math.min(elapsed / b.duration, 1.0);

            // Move forward and fade out
            b.mesh.position.z = b.startZ + (b.targetZ - b.startZ) * progress;
            b.mesh.material.opacity = 1.0 - progress;

            // Damage and Knockback enemies in area
            enemies.filter(en => en.lane === b.lane && Math.abs(en.mesh.position.z - b.mesh.position.z) < 1.5).forEach(en => {
                if (!b.hitEnemies) b.hitEnemies = new Set();
                if (!b.hitEnemies.has(en)) {
                    en.hp -= ENEMY_STATS.bulletDamage;
                    en.sprite.material.color.set(0xff0000);
                    setTimeout(() => en.sprite.material.color.set(0xffffff), 100);

                    // KNOCKBACK - Push back 0.5 squares
                    en.mesh.position.z -= CONFIG.rowHeight * 0.5;
                    const minZ = -(CONFIG.totalHeight / 2) - 5;
                    if (en.mesh.position.z < minZ) en.mesh.position.z = minZ;

                    b.hitEnemies.add(en);
                    if (en.hp <= 0) {
                        spawnCoin(en.mesh.position.x, en.mesh.position.z);
                        scene.remove(en.mesh); enemies.splice(enemies.indexOf(en), 1);
                    }
                }
            });

            if (progress >= 1.0) { scene.remove(b.mesh); bullets.splice(i, 1); }
            continue;
        }

        // BOOMERANG LOGIC (Player 4)
        if (b.isBoomerang) {
            const elapsed = now - b.startTime;

            // Rotación constante del boomerang
            b.mesh.material.rotation += 0.3;

            if (!b.returning) {
                // FASE 1: Ir hacia el enemigo
                const target = enemies.find(en => en === b.target);

                if (target && target.mesh) {
                    const dir = new THREE.Vector3().subVectors(target.mesh.position, b.mesh.position).normalize();
                    b.mesh.position.add(dir.multiplyScalar(0.6));

                    // Verificar si llegó al enemigo
                    if (b.mesh.position.distanceTo(target.mesh.position) < 1.5) {
                        if (!b.hasHit) {
                            // Hacer daño
                            const damage = ENEMY_STATS.bulletDamage;
                            target.hp -= damage;
                            target.sprite.material.color.set(0xff0000);
                            setTimeout(() => target.sprite.material.color.set(0xffffff), 100);

                            b.hasHit = true;
                            b.returning = true;

                            // Si el enemigo muere
                            if (target.hp <= 0) {
                                spawnCoin(target.mesh.position.x, target.mesh.position.z);
                                scene.remove(target.mesh);
                                enemies.splice(enemies.indexOf(target), 1);
                            }
                        }
                    }
                } else {
                    // El enemigo murió antes de que llegara, regresar
                    b.returning = true;
                }
            } else {
                // FASE 2: Regresar a la torre
                const tower = b.sourceTower;

                if (tower && connections.includes(tower)) {
                    const dir = new THREE.Vector3().subVectors(tower.mesh.position, b.mesh.position).normalize();
                    b.mesh.position.add(dir.multiplyScalar(0.6));

                    // Verificar si regresó a la torre
                    if (b.mesh.position.distanceTo(tower.mesh.position) < 1.0) {
                        // Liberar la torre para que pueda disparar de nuevo
                        tower.boomerangReturned = true;
                        scene.remove(b.mesh);
                        bullets.splice(i, 1);
                    }
                } else {
                    // La torre fue destruida, eliminar el boomerang
                    scene.remove(b.mesh);
                    bullets.splice(i, 1);
                }
            }
            continue;
        }

        // Move bullet logic (Player)
        if (b.targetBoss) {
            const boss = enemies.find(e => e.isBoss);
            if (boss) {
                const dir = new THREE.Vector3().subVectors(boss.mesh.position, b.mesh.position).normalize();
                b.mesh.position.add(dir.multiplyScalar(0.8));

                if (b.mesh.position.distanceTo(boss.mesh.position) < 2.0) {
                    const damage = (b.sourceType === 2) ? 15 : ENEMY_STATS.bulletDamage;
                    boss.hp -= damage;
                    updateBossHealthBar(boss.hp, boss.maxHp);
                    boss.sprite.material.color.set(0xff0000);
                    setTimeout(() => boss.sprite.material.color.set(0xffffff), 100);
                    scene.remove(b.mesh); bullets.splice(i, 1);
                    if (boss.hp <= 0) {
                        createFloatingText(boss.mesh.position.x, boss.mesh.position.z, "BOSS DEFEATED");
                        scene.remove(boss.mesh); enemies.splice(enemies.indexOf(boss), 1);
                        bossActive = false;

                        // WIN CONDITION TRIGGER
                        gameActive = false;
                        const elapsed = (performance.now() - startTime) / 1000;
                        if (typeof window.showGameOver === 'function') {
                            window.showGameOver(true, gold, elapsed);
                        }
                    }
                    continue;
                }
            } else {
                // Boss died while bullet was flying
                scene.remove(b.mesh); bullets.splice(i, 1);
                continue;
            }
        } else {
            b.mesh.position.z -= 0.8;
            // MODIFIED: Bullet-to-Enemy Collision with Piercing
            const hit = enemies.find(en => {
                if (en.lane !== b.lane || en.isBoss) return false;
                if (Math.abs(en.mesh.position.z - b.mesh.position.z) >= 1.2) return false;

                // PIERCING LOGIC: If it's a Bat, only Player-1 (0) and Player-3 (2) bullets hit it.
                // Others pass through.
                if (en.isBat && b.sourceType !== 0 && b.sourceType !== 2) return false;

                return true;
            });

            if (hit) {
                const damage = (b.sourceType === 2) ? 15 : ENEMY_STATS.bulletDamage;
                hit.hp -= damage;
                hit.sprite.material.color.set(0xff0000);
                setTimeout(() => hit.sprite.material.color.set(0xffffff), 100);
                scene.remove(b.mesh); bullets.splice(i, 1);
                if (hit.hp <= 0) {
                    spawnCoin(hit.mesh.position.x, hit.mesh.position.z);
                    scene.remove(hit.mesh); enemies.splice(enemies.indexOf(hit), 1);
                }
            } else if (b.mesh.position.z < -25) { scene.remove(b.mesh); bullets.splice(i, 1); }
        }
    }

    // Animación torres
    connections.forEach(conn => {
        if (conn.isLanding) {
            conn.velY -= 0.02; conn.mesh.position.y += conn.velY;
            if (conn.mesh.position.y <= 0) { conn.mesh.position.y = 0; conn.isLanding = false; conn.cable = createCable(conn); }
        } else {
            const breath = Math.sin(time * 0.5 + conn.animOffset) * 0.05;
            conn.mesh.children[0].scale.set(3 + breath, 3 - breath, 1);
            conn.mesh.children[0].rotation.z = Math.sin(time + conn.animOffset) * 0.04;

            // Visual feedback for Player 2 (Type 1) during Boss fight
            if (conn.type === 1) {
                if (bossActive) {
                    conn.mesh.children[0].material.color.set(0x888888);
                } else {
                    conn.mesh.children[0].material.color.set(0xffffff);
                }
            }

            // RECHARGE LOGIC FOR PLAYER 3 (Type 2)
            if (conn.type === 2) {
                if (conn.reloading && !bossActive) { // Don't reload/gray out if boss is active
                    conn.mesh.children[0].material.color.set(0x888888);
                    if (now - conn.reloadStart > 3500) {
                        conn.reloading = false;
                        conn.ammo = 8;
                        conn.mesh.children[0].material.color.set(0xffffff);
                    }
                } else if (bossActive) {
                    // Force white color and active state during boss fight
                    conn.reloading = false;
                    conn.ammo = 8;
                    conn.mesh.children[0].material.color.set(0xffffff);
                }
            }

            const currentFireRate = (conn.type === 2) ? CONFIG.fireRate / 2 : CONFIG.fireRate;

            if (now - conn.lastFired > currentFireRate && !conn.reloading) {
                let fired = false;
                // Target Boss if Active (Player 2 does NOT target boss)
                if (bossActive && conn.type !== 1) {
                    const boss = enemies.find(e => e.isBoss);
                    if (boss) {
                        // Check range? or global? Let's say global for now but maybe verify distance
                        if (boss.mesh.position.z < conn.mesh.position.z) {
                            if (conn.type === 3) {
                                // BOOMERANG ATTACK ON BOSS (Player 4)
                                if (conn.boomerangReturned !== false) {
                                    const tex = Math.random() < 0.5 ? bulletTexture3 : bulletTexture3_1;
                                    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
                                    b.scale.set(1.5, 1.5, 1);
                                    b.position.copy(conn.mesh.position).y += 1.5;
                                    scene.add(b);

                                    bullets.push({
                                        mesh: b,
                                        lane: conn.col,
                                        isBoomerang: true,
                                        target: boss,
                                        sourceTower: conn,
                                        returning: false,
                                        hasHit: false,
                                        startTime: now,
                                        targetingBoss: true
                                    });

                                    conn.boomerangReturned = false;
                                    fired = true;
                                }
                            } else {
                                // NORMAL BULLETS FOR OTHER PLAYERS
                                let tex = bulletTexture;
                                if (conn.type === 0) tex = bulletTexture2;

                                const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
                                b.scale.set(1.2, 1.2, 1);
                                b.position.copy(conn.mesh.position).y += 1.5;
                                scene.add(b);
                                bullets.push({ mesh: b, lane: conn.col, targetBoss: true, sourceType: conn.type });

                                // PLAYER 3 AMMO MGMT (BOSS FIGHT)
                                if (conn.type === 2 && !bossActive) {
                                    conn.ammo--;
                                    if (conn.ammo <= 0) {
                                        conn.reloading = true;
                                        conn.reloadStart = now;
                                    }
                                }
                                fired = true;
                            }
                        }
                    }
                }

                // FIND TARGET LOGIC (MODIFIED)
                if (!fired) {
                    // Filter potential targets in this lane
                    const laneTargets = enemies.filter(en =>
                        en.lane === conn.col &&
                        en.mesh.position.z < conn.mesh.position.z &&
                        !en.isBoss
                    );

                    // Sort by proximity (closest to tower first - usually highest Z)
                    laneTargets.sort((a, b) => b.mesh.position.z - a.mesh.position.z);

                    // RESET AMMO FOR PLAYER 3 IF LANE IS CLEAR
                    if (conn.type === 2 && laneTargets.length === 0) {
                        conn.ammo = 8;
                    }

                    const validTarget = laneTargets.find(en => {
                        // MODIFIED: Targeting logic
                        // Only Type 0 (Player-1), Type 2 (Player-3), and Type 3 (Player-4) can target Bats.
                        // Type 1 (Player-2) ignores Bats because it's melee and Bats fly.
                        if (en.isBat && (conn.type !== 0 && conn.type !== 2 && conn.type !== 3)) return false;

                        // Rango limitado para Player 2 (Tipo 1)
                        if (conn.type === 1) {
                            const dist = Math.abs(en.mesh.position.z - conn.mesh.position.z);
                            if (dist > CONFIG.rowHeight * 1.5) return false;
                        }

                        return true;
                    });

                    if (validTarget) {
                        if (conn.type === 1) {
                            // SWORD ATTACK
                            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: swordTexture, transparent: true, depthWrite: false }));
                            s.scale.set(4, 2, 1);
                            s.position.copy(conn.mesh.position).y += 1.5;
                            s.position.z -= 0.5; // Start just in front
                            scene.add(s);
                            bullets.push({
                                mesh: s, lane: conn.col, isSword: true,
                                startZ: s.position.z, targetZ: validTarget.mesh.position.z,
                                startTime: now, duration: 300
                            });
                        } else if (conn.type === 3) {
                            // BOOMERANG ATTACK (Player 4)
                            // Solo disparar si el boomerang anterior ha regresado
                            if (conn.boomerangReturned !== false) {
                                const tex = Math.random() < 0.5 ? bulletTexture3 : bulletTexture3_1;
                                const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
                                b.scale.set(1.5, 1.5, 1);
                                b.position.copy(conn.mesh.position).y += 1.5;
                                scene.add(b);

                                bullets.push({
                                    mesh: b,
                                    lane: conn.col,
                                    isBoomerang: true,
                                    target: validTarget,
                                    sourceTower: conn,
                                    returning: false,
                                    hasHit: false,
                                    startTime: now
                                });

                                // Marcar que el boomerang está en el aire
                                conn.boomerangReturned = false;
                            }
                        } else {
                            // NORMAL BULLET (Player 1, 2)
                            let tex = bulletTexture;
                            if (conn.type === 0) {
                                // Player 1 logic: normal enemy -> proyectil-2, bat -> proyectil-1
                                tex = validTarget.isBat ? bulletTexture : bulletTexture2;
                            }
                            const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
                            b.scale.set(1.2, 1.2, 1);
                            b.position.copy(conn.mesh.position).y += 1.5;
                            scene.add(b); bullets.push({ mesh: b, lane: conn.col, targetBoss: false, sourceType: conn.type });

                            // PLAYER 3 AMMO MGMT
                            if (conn.type === 2) {
                                conn.ammo--;
                                if (conn.ammo <= 0) {
                                    conn.reloading = true;
                                    conn.reloadStart = now;
                                }
                            }
                        }
                        fired = true;
                    }
                }

                if (fired) conn.lastFired = now;
            }
        }
    });

    // Monedas
    worldCoins.forEach((c, idx) => {
        const pulse = 1.5 + Math.sin(now * 0.005) * 0.1;
        c.mesh.scale.set(pulse, pulse, 1);

        // Physics with hard floor
        c.vy -= 0.015;
        c.yPos += c.vy;

        if (c.yPos < 1.0) {
            c.yPos = 1.0;
            c.vy *= -0.3; // Small bounce
            if (Math.abs(c.vy) < 0.05) c.vy = 0;
        }

        c.mesh.position.y = c.yPos;

        if (now - c.born > 5000) { scene.remove(c.mesh); worldCoins.splice(idx, 1); }
    });

    // Enemigos
    enemies.forEach((en, i) => {
        // MODIFICADO: Boss camina mucho más lento
        const speed = en.isBoss ? 0.015 : 0.03;
        en.mesh.position.z += speed;
        if (en.mesh.position.z > (CONFIG.totalHeight / 2)) {
            // BOSS INSTANT KILL LOGIC
            if (en.isBoss) {
                health = 0; // Instant defeat
            } else {
                health -= 25;
            }
            updateHealthBar();
            // MODIFICADO: Eliminado shakeIntensity
            scene.remove(en.mesh); enemies.splice(i, 1);
            if (health <= 0) {
                gameActive = false;
                const elapsed = (performance.now() - startTime) / 1000;
                if (typeof window.showGameOver === 'function') {
                    window.showGameOver(false, gold, elapsed);
                }
            }
        }
    });

    // BOSS ATTACK LOGIC
    if (bossActive && gameActive) {
        if (now - lastBossAttack > 2000) { // Every 2 seconds
            // Pick random target
            const targets = connections.filter(c => !c.isLanding); // Only active towers
            if (targets.length > 0) {
                const target = targets[Math.floor(Math.random() * targets.length)];
                const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: bulletTexture, color: 0xff00ff })); // Purple bullet
                b.material.rotation = Math.PI; // Rotate 180 degrees to point at player
                b.scale.set(1.5, 1.5, 1);
                // Start from boss pos
                const boss = enemies.find(e => e.isBoss);
                if (boss) {
                    b.position.copy(boss.mesh.position).y = 2;
                    scene.add(b);
                    bullets.push({ mesh: b, isBossBullet: true, target: target });
                    lastBossAttack = now;
                }
            }
        }
    }

    // MODIFICADO: Eliminado bloque de shakeIntensity

    const gDisp = document.getElementById('gold-display');
    if (gDisp) gDisp.innerText = gold;

    // UPDATE TIMER
    if (gameActive) {
        const elapsed = Math.floor((now - startTime) / 1000);
        const tDisp = document.getElementById('time-val');
        if (tDisp) tDisp.innerText = elapsed;
    }

    renderer.render(scene, camera);
}

/** * 7. EVENTOS DE CLIC */
canvas.addEventListener('pointerdown', (e) => {
    if (!gameActive) return;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const coinHits = raycaster.intersectObjects(worldCoins.map(c => c.mesh));
    if (coinHits.length > 0) {
        const coinObj = worldCoins.find(c => c.mesh === coinHits[0].object);
        gold += 20; scene.remove(coinObj.mesh); worldCoins.splice(worldCoins.indexOf(coinObj), 1);
        return;
    }

    const hits = raycaster.intersectObjects(grassGroup.children);
    if (hits.length > 0) {
        const tile = hits[0].object;
        const { col, row } = tile.userData;
        const existingIdx = connections.findIndex(c => c.col === col && c.row === row);

        if (existingIdx !== -1) {
            removeTower(existingIdx);
        } else if (row >= 3 && gold >= COSTS.tower) {
            gold -= COSTS.tower;
            createFloatingText(tile.position.x, tile.position.z, `-${COSTS.tower}`);
            const group = new THREE.Group();

            // Use PREVIEW index
            const texIndex = nextTowerIndex;
            const randomTex = towerTextures[texIndex];

            // Reroll next (ensure different)
            nextTowerIndex = getNewRandomTower(nextTowerIndex);
            updatePreviewUI();

            const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: randomTex, transparent: true, depthWrite: false }));
            spr.scale.set(3, 3, 1); spr.position.y = 1.5;
            group.add(spr);
            group.position.set(tile.position.x, 10, tile.position.z);
            scene.add(group);
            connections.push({
                col, row, mesh: group, lastFired: 0, isLanding: true, velY: 0,
                cable: null, animOffset: Math.random() * 10, hp: 3, type: texIndex,
                ammo: 8, reloading: false, reloadStart: 0
            });
        }
    }
});

canvas.addEventListener('pointermove', (e) => {
    if (!gameActive) {
        placementGhost.visible = false;
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(grassGroup.children);
    if (hits.length > 0) {
        const tile = hits[0].object;
        const { col, row } = tile.userData;
        const existingIdx = connections.findIndex(c => c.col === col && c.row === row);

        // Valid if: no tower there AND row >= 3 AND we have gold
        if (existingIdx === -1 && row >= 3 && gold >= COSTS.tower) {
            placementGhost.material.map = towerTextures[nextTowerIndex];
            placementGhost.position.set(tile.position.x, 1.5, tile.position.z);
            placementGhost.visible = true;
        } else {
            placementGhost.visible = false;
        }
    } else {
        placementGhost.visible = false;
    }
});


animate();
