// --- SISTEMA DE PROGRESIÓN, PASE Y MISIONES ---
const progression = {
    // Datos persistentes
    xp: parseInt(localStorage.getItem('cw_xp')) || 0,
    level: parseInt(localStorage.getItem('cw_level')) || 1,
    scrap: parseInt(localStorage.getItem('cw_scrap')) || 0,
    xpPerLevel: 1000,

    // Configuración del Pase de Batalla (Libro de Logística)
    battlePass: {
        1: { name: "Raciones Básicas", desc: "Kit de inicio de campaña", icon: "📦" },
        2: { name: "Cables Reforzados", desc: "+5% Resistencia estructural", icon: "🛡️" },
        3: { name: "Válvulas de Cobre", desc: "Enfriamiento mejorado (-1s)", icon: "🌡️" },
        4: { name: "Munición de Hierro", desc: "+1 Daño por impacto", icon: "🚀" },
        5: { name: "Skin Dorada", desc: "Torreta de Almirante", icon: "✨" }
    },

    // Configuración de Misiones (Tablón de Encargos)
    missions: [
        { id: 1, text: "Sobrevive 60 segundos", goal: 60, current: 0, reward: 200, completed: false },
        { id: 2, text: "Recolecta 500 de Oro", goal: 500, current: 0, reward: 350, completed: false },
        { id: 3, text: "Derrota al Gran Jefe", goal: 1, current: 0, reward: 1000, completed: false }
    ],

    // --- MÉTODOS ---

    addXp(amount) {
        this.xp += amount;
        while (this.xp >= this.xpPerLevel) {
            this.level++;
            this.xp -= this.xpPerLevel;
            // Podríamos añadir un sonido de subida de nivel aquí
        }
        this.save();
    },

    addScrap(amount) {
        this.scrap += amount;
        this.save();
    },

    // Guarda todo en el navegador
    save() {
        localStorage.setItem('cw_xp', this.xp);
        localStorage.setItem('cw_level', this.level);
        localStorage.setItem('cw_scrap', this.scrap);
        // Guardar misiones (opcional, para persistencia de objetivos)
        localStorage.setItem('cw_missions', JSON.stringify(this.missions));
    },

    // Verifica misiones al final de la partida
    checkMissions(stats) {
        let news = [];
        this.missions.forEach(m => {
            if (!m.completed) {
                if (m.id === 1 && stats.time >= m.goal) { m.completed = true; news.push(m); }
                if (m.id === 2 && stats.gold >= m.goal) { m.completed = true; news.push(m); }
                if (m.id === 3 && stats.bossKilled) { m.completed = true; news.push(m); }

                if (m.completed) this.addScrap(m.reward);
            }
        });
        return news;
    }
};

/**
 * Muestra la pantalla de Game Over / Victoria
 * @param {boolean} won - Si ha ganado la partida
 * @param {number} goldEarned - Oro total en la partida
 * @param {number} timeSurvived - Tiempo en segundos
 */
function showGameOver(won, goldEarned, timeSurvived) {
    // Cálculos de recompensas
    const xpEarned = Math.floor(goldEarned / 2) + (won ? 500 : 100);
    const scrapEarned = Math.floor(goldEarned / 10);

    // Comprobar misiones cumplidas
    const completedMissions = progression.checkMissions({
        time: timeSurvived,
        gold: goldEarned,
        bossKilled: won
    });

    // Aplicar a la persistencia
    progression.addScrap(scrapEarned);
    progression.addXp(xpEarned);

    // Crear Interfaz de resultados
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';

    // Add theme based on result
    overlay.classList.add(won ? 'victory-theme' : 'defeat-theme');

    // Build the stats rows
    const statsHtml = `
        <div class="stat-row">
            <span class="stat-label">TIEMPO</span>
            <span class="stat-value">${Math.floor(timeSurvived)}s</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">ORO</span>
            <span class="stat-value">${goldEarned}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">XP</span>
            <span class="stat-value text-gold">+${xpEarned}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">CHATARRA</span>
            <span class="stat-value text-bronze">+${scrapEarned}</span>
        </div>
    `;

    // missions check (Cleaner implementation)
    let missionsHtml = "";
    if (completedMissions.length > 0) {
        missionsHtml = `
            <div class="reward-section">
                <div style="font-size: 11px; color: #5d4037; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">MISIONES COMPLETADAS</div>
                ${completedMissions.map(m => `<div style="color: #2e7d32; font-size: 14px; font-weight: bold; margin: 4px 0;">✨ ${m.text}</div>`).join('')}
            </div>
        `;
    }

    const levelProgress = (progression.xp / progression.xpPerLevel) * 100;

    overlay.innerHTML = `
        <div class="game-over-panel">
            <div class="panel-title">${won ? '¡VICTORIA!' : '¡DERROTA!'}</div>
            
            <div class="stats-container">
                ${statsHtml}
            </div>

            ${missionsHtml}

            <div class="reward-section">
                <div style="display:flex; justify-content:space-between; font-size: 11px; color: #5d4037; font-weight: bold; margin-bottom: 5px;">
                    <span>NIVEL ${progression.level}</span>
                    <span>${progression.xp} / ${progression.xpPerLevel} XP</span>
                </div>
                <div class="level-bar-container">
                    <div class="level-bar-fill" style="width: ${levelProgress}%"></div>
                </div>
            </div>

            <button class="btn-action" onclick="location.reload()">
                VOLVER AL CUARTEL
            </button>
        </div>
    `;

    document.getElementById('game-container').appendChild(overlay);
}