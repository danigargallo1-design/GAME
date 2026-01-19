/**
 * Gestión del Menú Principal: Clockwork Wall
 * Ajustes: Botón bajo, color ámbar y transición suave de inicio.
 */

let menuAnimationId = null;

function createMainMenu() {
    const uiTop = document.getElementById('ui');
    const uiBottom = document.getElementById('bottom-ui');
    const container = document.getElementById('game-container');

    if (uiTop) uiTop.style.display = 'none';
    if (uiBottom) uiBottom.style.display = 'none';

    const menuOverlay = document.createElement('div');
    menuOverlay.classList.add('menu-overlay');

    // --- CONFIGURACIÓN DEL FONDO ---
    Object.assign(menuOverlay.style, {
        backgroundColor: "#000",
        backgroundImage: "url('assets/background.png')",
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        zIndex: "1000",
        display: "flex",
        justifyContent: "center",
        transition: "opacity 0.6s ease-in-out" // Transición suave de desvanecimiento
    });

    const xpPercent = Math.floor((progression.xp / progression.xpPerLevel) * 100);

    menuOverlay.innerHTML = `
        <div id="mobile-wrapper" style="
            position: relative;
            width: 100%;
            max-width: 66.6vh; 
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: flex-end; /* Empuja todo hacia abajo */
            padding: 40px 20px 60px 20px;
            box-sizing: border-box;
            z-index: 1001;
        ">
            <div style="position: absolute; top: 40px; left: 20px; right: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div id="btn-pass" style="background: rgba(0, 0, 0, 0.7); padding: 10px; border-radius: 10px; border: 1px solid #f1c40f; backdrop-filter: blur(5px); cursor: pointer;">
                    <div style="font-size: 9px; font-weight: 800; color: #f1c40f; letter-spacing: 1px; margin-bottom: 4px; text-transform: uppercase;">Logística LVL ${progression.level}</div>
                    <div style="width: 90px; height: 4px; background: #222; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${xpPercent}%; height: 100%; background: #f1c40f;"></div>
                    </div>
                </div>
                
                <div id="btn-missions" style="width: 44px; height: 44px; background: rgba(0, 0, 0, 0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1.5px solid #f1c40f; cursor: pointer;">
                    📜
                </div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; gap: 30px; width: 100%;">
                <button id="btn-play" style="
                    background: linear-gradient(180deg, #f39c12 0%, #d35400 100%);
                    padding: 16px 45px;
                    border-radius: 14px;
                    border: none;
                    border-top: 2px solid #f1c40f;
                    border-bottom: 3px solid rgba(0,0,0,0.4);
                    color: white;
                    font-family: 'Verdana', sans-serif;
                    font-size: 16px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    cursor: pointer;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.6);
                    transition: transform 0.1s ease;
                ">
                    INICIAR PARTIDA
                </button>

                <div style="text-align: center; color: rgba(255,255,255,0.4); font-family: monospace; font-size: 9px; letter-spacing: 3px; font-weight: bold;">
                    V0.0.0 - Main World
                </div>
            </div>
        </div>
        
        <div style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:100%; height:40%; max-width:66.6vh; background:linear-gradient(to top, rgba(0,0,0,0.6), transparent); z-index:999; pointer-events:none;"></div>
    `;

    container.appendChild(menuOverlay);

    // --- ACCIÓN DE INICIO ---

    document.getElementById('btn-play').onclick = () => {
        const btn = document.getElementById('btn-play');

        // Efecto de pulsación
        btn.style.transform = "scale(0.95)";

        // Desvanecimiento suave de todo el menú
        menuOverlay.style.opacity = "0";

        setTimeout(() => {
            menuOverlay.remove();
            if (uiTop) uiTop.style.display = 'block';
            if (uiBottom) uiBottom.style.display = 'flex';
            if (typeof initGame === 'function') initGame();
        }, 600);
    };

    document.getElementById('btn-missions').onclick = () => {
        let info = "MISIONES:\n" + progression.missions.map(m => (m.completed ? "✅ " : "⚔️ ") + m.text).join("\n");
        alert(info);
    };

    document.getElementById('btn-pass').onclick = () => {
        openTrophyRoad();
    };
}

function openTrophyRoad() {
    // 1. Crear Overlay
    const overlay = document.createElement('div');
    overlay.className = 'trophy-road-overlay';

    // 2. Header
    const header = document.createElement('div');
    header.className = 'trophy-header';
    header.innerHTML = `
        <div class="trophy-title">LOGISTICS PATH</div>
        <button class="btn-close" id="close-trophy">✕</button>
    `;
    overlay.appendChild(header);

    // 3. Container
    const container = document.createElement('div');
    container.className = 'trophy-road-container';

    // 4. Generar Niveles (1 a 100)
    // El nivel 1 es el Start (Top? No, usuario pidió 0 arriba y 100 abajo, 
    // pero normalmente "subes" niveles.
    // REVISIÓN USUARIO: "va desde 0(arriba del todo) a 100 (abajo del todo)"
    // OK, haremos un loop de 0 a 100.

    // Para que el scroll empiece en el nivel actual del usuario vamos a tener que hacer scrollIntoView
    const maxLevel = 100;
    const currentLevel = progression.level || 1;

    for (let i = 0; i <= maxLevel; i++) {
        const node = document.createElement('div');
        node.className = `road-node ${i % 2 === 0 ? 'left' : 'right'}`;

        const isCompleted = i < currentLevel;
        const isCurrent = i === currentLevel;

        if (isCompleted) node.classList.add('completed');
        if (isCurrent) {
            node.classList.add('current');
            node.id = 'current-level-node'; // Marcador para scroll
        }

        // Definir recompensa visual
        // Usamos progression.battlePass[i] si existe, sino genérico
        let rewardText = "SUMINISTROS";
        let rewardIcon = "📦";

        // Check progression.js battlePass config (assuming it's global)
        if (typeof progression !== 'undefined' && progression.battlePass && progression.battlePass[i]) {
            rewardText = progression.battlePass[i].name;
            rewardIcon = progression.battlePass[i].icon;
        } else {
            if (i % 5 === 0) { rewardText = "CAJA DE ORO"; rewardIcon = "💰"; }
            if (i % 10 === 0) { rewardText = "SUPER CAJA"; rewardIcon = "💎"; }
            if (i === 0) { rewardText = "INICIO"; rewardIcon = "🚩"; }
            if (i === 100) { rewardText = "LEYENDA"; rewardIcon = "🏆"; }
        }

        node.innerHTML = `
            <div class="node-content">
                <div style="font-size: 24px; margin-bottom: 4px;">${rewardIcon}</div>
                <div class="node-reward">${rewardText}</div>
            </div>
            
            <div class="node-center">
                <div class="level-circle"></div>
                <div class="node-level">${i}</div>
            </div>
        `;

        container.appendChild(node);
    }

    overlay.appendChild(container);

    // Añadir al DOM
    // Añadir al DOM
    document.getElementById('game-container').appendChild(overlay);

    // Eventos
    document.getElementById('close-trophy').onclick = () => {
        overlay.classList.add('fadeOut'); // Asumiendo que definimos fadeOut o remove directo
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    };

    // Auto-scroll al nivel actual
    setTimeout(() => {
        const target = document.getElementById('current-level-node');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function startMenuAnimation(canvas) {
    const ctx = canvas.getContext('2d');
    function draw() {
        if (!canvas.parentElement) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        menuAnimationId = requestAnimationFrame(draw);
    }
    draw();
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(createMainMenu, 100);
});