// Global Game State
const gameState = {
  phase: "ANIME_SELECT",
  selectedAnime: null,
  party: [],
  inventory: { senzuBean: 0 },
  stage: 1,
  isSpinning: false,
  currentRotation: 0,
  bossRotation: 0,
  trainRotation: 0,
  encounterRotation: 0,
  activeCharacters: [],
  activeBosses: [],
  currentBoss: null,
  bossSlices: [],
  trainSlices: [],
  encounterSlices: []
};

// Main Slices
const mainSlices = [
  { label: "Random Encounter", weight: 50, color: "#2ed573" },
  { label: "Training Arc", weight: 40, color: "#ffa502" },
  { label: "Item Drop", weight: 10, color: "#1e90ff" }
];

let currentWheelSlices = [];

// DOM Elements
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const spinBtn = document.getElementById("spinBtn");

const bossCanvas = document.getElementById("bossCanvas");
const bossCtx = bossCanvas ? bossCanvas.getContext("2d") : null;
const bossModal = document.getElementById("bossModal");
const bossSpinBtn = document.getElementById("bossSpinBtn");
const battleStatusMsg = document.getElementById("battleStatusMsg");

const trainCanvas = document.getElementById("trainCanvas");
const trainCtx = trainCanvas ? trainCanvas.getContext("2d") : null;
const trainModal = document.getElementById("trainModal");
const trainSpinBtn = document.getElementById("trainSpinBtn");

const encounterCanvas = document.getElementById("encounterCanvas");
const encounterCtx = encounterCanvas ? encounterCanvas.getContext("2d") : null;
const encounterModal = document.getElementById("encounterModal");
const encounterSpinBtn = document.getElementById("encounterSpinBtn");

// Game Engine Logic
const GameEngine = {
  init: async function() {
    try {
      const response = await fetch('./animes.json');
      if (!response.ok) throw new Error("Failed to load JSON file");
      const animeData = await response.json();

      const availableAnimes = animeData.animes.filter(a => a.enabled);
      const sliceColors = ["#9b59b6", "#e67e22", "#1abc9c", "#e74c3c", "#3498db"];

      currentWheelSlices = availableAnimes.map((anime, index) => ({
        label: anime.title,
        data: anime,
        weight: 1,
        color: sliceColors[index % sliceColors.length]
      }));

      if (canvas && ctx) this.drawWheel(canvas, ctx, currentWheelSlices);
      this.updateUI();
      this.logEvent("[STARTUP] Spin the wheel to choose your starting Anime!");

      if (spinBtn) spinBtn.onclick = this.spinMainWheel.bind(this);
      if (bossSpinBtn) bossSpinBtn.onclick = this.spinBossWheel.bind(this);
      if (trainSpinBtn) trainSpinBtn.onclick = this.spinTrainingWheel.bind(this);
      if (encounterSpinBtn) encounterSpinBtn.onclick = this.spinEncounterWheel.bind(this);

    } catch (error) {
      console.error("Error loading anime data:", error);
      this.logEvent("[ERROR] Could not load animes.json. Ensure Live Server is running.");
    }
  },

  drawWheel: function(c, context, slices) {
    if (!c || !context) return;
    const centerX = c.width / 2;
    const centerY = c.height / 2;
    const radius = c.width / 2 - 15;

    const totalWeight = slices.reduce((sum, s) => sum + s.weight, 0);
    let currentAngle = 0;

    context.clearRect(0, 0, c.width, c.height);

    slices.forEach((slice) => {
      const sliceAngle = (slice.weight / totalWeight) * (2 * Math.PI);

      context.beginPath();
      context.moveTo(centerX, centerY);
      context.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      context.closePath();
      context.fillStyle = slice.color;
      context.fill();
      context.strokeStyle = "#121212";
      context.lineWidth = 2;
      context.stroke();

      context.save();
      context.translate(centerX, centerY);
      context.rotate(currentAngle + sliceAngle / 2);
      context.textAlign = "right";
      context.fillStyle = "#ffffff";
      context.font = "bold 11px sans-serif";
      context.fillText(slice.label, radius - 10, 4);
      context.restore();

      currentAngle += sliceAngle;
    });
  },

  spinMainWheel: function() {
    if (gameState.isSpinning) return;
    gameState.isSpinning = true;
    if (spinBtn) spinBtn.disabled = true;

    const totalWeight = currentWheelSlices.reduce((sum, s) => sum + s.weight, 0);

    let randomVal = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let i = 0; i < currentWheelSlices.length; i++) {
      if (randomVal < currentWheelSlices[i].weight) {
        selectedIndex = i;
        break;
      }
      randomVal -= currentWheelSlices[i].weight;
    }

    let startWeight = 0;
    for (let i = 0; i < selectedIndex; i++) startWeight += currentWheelSlices[i].weight;
    const endWeight = startWeight + currentWheelSlices[selectedIndex].weight;

    const startDeg = (startWeight / totalWeight) * 360;
    const endDeg = (endWeight / totalWeight) * 360;

    const sliceSize = endDeg - startDeg;
    const naturalOffset = startDeg + (sliceSize * 0.1) + (Math.random() * (sliceSize * 0.8));

    const extraSpins = 360 * 5;
    const targetDegree = extraSpins + (360 - naturalOffset) - 90;

    const currentMod = gameState.currentRotation % 360;
    gameState.currentRotation += (targetDegree - currentMod);

    canvas.style.transition = "transform 4s cubic-bezier(0.15, 0.9, 0.25, 1)";
    canvas.style.transform = `rotate(${gameState.currentRotation}deg)`;

    setTimeout(() => {
      this.handleSpinResult(currentWheelSlices[selectedIndex]);
      gameState.isSpinning = false;
    }, 4000);
  },

  handleSpinResult: function(selectedSlice) {
    if (gameState.phase === "ANIME_SELECT") {
      gameState.selectedAnime = selectedSlice.data;
      gameState.activeCharacters = [...selectedSlice.data.characters];
      gameState.activeBosses = [...selectedSlice.data.bosses];

      this.logEvent(`[WORLD SELECTED] Locked in: ${gameState.selectedAnime.title}!`);

      gameState.phase = "MAIN_GAME";
      currentWheelSlices = mainSlices;

      canvas.style.transition = "none";
      gameState.currentRotation = 0;
      canvas.style.transform = `rotate(0deg)`;
      void canvas.offsetHeight;

      this.drawWheel(canvas, ctx, currentWheelSlices);
      if (spinBtn) spinBtn.disabled = false;
    } else {
      this.handleEventOutcome(selectedSlice.label);
    }
  },

  handleEventOutcome: function(sliceLabel) {
    switch (sliceLabel) {
      case "Random Encounter":
        this.setupEncounterWheel();
        break;
      case "Training Arc":
        this.setupTrainingArcWheel();
        break;
      case "Item Drop":
        gameState.inventory.senzuBean++;
        this.logEvent(`[ITEM DROP] Found a Senzu Bean! Added to inventory.`);
        this.updateUI();
        this.triggerBossBattle();
        break;
    }
  },

  setupEncounterWheel: function() {
    const characters = gameState.activeCharacters;
    if (!characters || characters.length === 0) {
      this.logEvent(`[ERROR] No characters available for encounter! Skipping to boss.`);
      this.triggerBossBattle();
      return;
    }

    const colors = ["#2ecc71", "#27ae60", "#1abc9c", "#16a085", "#3498db", "#2980b9"];
    gameState.encounterSlices = characters.map((char, index) => ({
      label: char.name,
      char: char,
      weight: 1,
      color: colors[index % colors.length]
    }));

    if (encounterSpinBtn) encounterSpinBtn.disabled = false;
    if (encounterModal) encounterModal.classList.remove("hidden");

    if (encounterCanvas && encounterCtx) {
      encounterCanvas.style.transition = "none";
      gameState.encounterRotation = 0;
      encounterCanvas.style.transform = `rotate(0deg)`;
      void encounterCanvas.offsetHeight;
      this.drawWheel(encounterCanvas, encounterCtx, gameState.encounterSlices);
    }
  },

  spinEncounterWheel: function() {
    if (encounterSpinBtn) encounterSpinBtn.disabled = true;

    const slices = gameState.encounterSlices;
    const selectedIndex = Math.floor(Math.random() * slices.length);

    const sliceDeg = 360 / slices.length;
    const sliceCenterDeg = (selectedIndex * sliceDeg) + (sliceDeg / 2);

    const extraSpins = 360 * 5;
    const targetDegree = extraSpins + (360 - sliceCenterDeg) - 90;

    const currentMod = gameState.encounterRotation % 360;
    gameState.encounterRotation += (targetDegree - currentMod);

    if (encounterCanvas) {
      encounterCanvas.style.transition = "transform 4s cubic-bezier(0.15, 0.9, 0.25, 1)";
      encounterCanvas.style.transform = `rotate(${gameState.encounterRotation}deg)`;
    }

    setTimeout(() => {
      const selected = slices[selectedIndex];
      const char = selected.char;

      if (gameState.party.length < 6) {
        gameState.party.push({ ...char });
        this.logEvent(`[ENCOUNTER] You met and recruited ${char.name}!`);
      } else {
        this.logEvent(`[ENCOUNTER] Met ${char.name}, but your roster is full!`);
      }
      this.updateUI();

      if (encounterModal) encounterModal.classList.add("hidden");
      this.triggerBossBattle();
    }, 4000);
  },

  setupTrainingArcWheel: function() {
    const eligibleMembers = gameState.party.map((char, index) => ({ char, partyIndex: index }))
                                             .filter(item => item.char.nextForm !== null && item.char.nextForm !== undefined);

    if (eligibleMembers.length === 0) {
      gameState.inventory.senzuBean++;
      this.logEvent(`[TRAINING ARC] No evolvable characters in roster! Rewarded 1 Senzu Bean instead.`);
      this.updateUI();
      this.triggerBossBattle();
      return;
    }

    const colors = ["#ffa502", "#e67e22", "#f39c12", "#d35400", "#16a085", "#2980b9"];
    gameState.trainSlices = eligibleMembers.map((item, i) => ({
      label: item.char.name,
      partyIndex: item.partyIndex,
      char: item.char,
      weight: 1,
      color: colors[i % colors.length]
    }));

    if (trainSpinBtn) trainSpinBtn.disabled = false;
    if (trainModal) trainModal.classList.remove("hidden");

    if (trainCanvas && trainCtx) {
      trainCanvas.style.transition = "none";
      gameState.trainRotation = 0;
      trainCanvas.style.transform = `rotate(0deg)`;
      void trainCanvas.offsetHeight;
      this.drawWheel(trainCanvas, trainCtx, gameState.trainSlices);
    }
  },

  spinTrainingWheel: function() {
    if (trainSpinBtn) trainSpinBtn.disabled = true;

    const slices = gameState.trainSlices;
    const selectedIndex = Math.floor(Math.random() * slices.length);

    const sliceDeg = 360 / slices.length;
    const sliceCenterDeg = (selectedIndex * sliceDeg) + (sliceDeg / 2);

    const extraSpins = 360 * 5;
    const targetDegree = extraSpins + (360 - sliceCenterDeg) - 90;

    const currentMod = gameState.trainRotation % 360;
    gameState.trainRotation += (targetDegree - currentMod);

    if (trainCanvas) {
      trainCanvas.style.transition = "transform 4s cubic-bezier(0.15, 0.9, 0.25, 1)";
      trainCanvas.style.transform = `rotate(${gameState.trainRotation}deg)`;
    }

    setTimeout(() => {
      const selected = slices[selectedIndex];
      const oldChar = selected.char;
      const nextFormName = oldChar.nextForm;

      const evolvedData = gameState.activeCharacters.find(c => c.name === nextFormName);

      if (evolvedData) {
        gameState.party[selected.partyIndex] = { ...evolvedData };
      } else {
        gameState.party[selected.partyIndex].name = nextFormName;
        gameState.party[selected.partyIndex].nextForm = null;
      }

      this.logEvent(`[EVOLUTION!] ${oldChar.name} evolved into ${nextFormName}!`);
      this.updateUI();

      if (trainModal) trainModal.classList.add("hidden");
      this.triggerBossBattle();
    }, 4000);
  },

  triggerBossBattle: function() {
    if (!gameState.activeBosses || gameState.activeBosses.length === 0) return;

    let baseWinRate = Math.max(10, 85 - (gameState.stage - 1) * 10);
    let teamBonus = gameState.party.length * 5; 
    let winPercent = Math.min(95, baseWinRate + teamBonus);

    gameState.currentBoss = gameState.activeBosses[(gameState.stage - 1) % gameState.activeBosses.length];

    const totalSlices = 16;
    const winCount = Math.max(1, Math.round((winPercent / 100) * totalSlices));

    gameState.bossSlices = [];
    const step = totalSlices / winCount;

    for (let i = 0; i < totalSlices; i++) {
      const isWin = Math.floor(i % step) === 0 && winCount > 0;
      gameState.bossSlices.push({
        label: isWin ? "Yes" : "No",
        weight: 1,
        color: isWin ? "#2ed573" : "#ff4757"
      });
    }

    const titleEl = document.getElementById("bossModalTitle");
    const descEl = document.getElementById("bossModalDesc");
    if (titleEl) titleEl.innerText = `Stage ${gameState.stage} Boss: ${gameState.currentBoss.name}!`;
    if (descEl) descEl.innerText = `Win Odds: ${winPercent}% (Base ${baseWinRate}% + Team Bonus). Spin to fight!`;

    if (battleStatusMsg) battleStatusMsg.innerText = "";
    if (bossSpinBtn) {
      bossSpinBtn.classList.remove("hidden");
      bossSpinBtn.disabled = false;
    }

    if (bossModal) bossModal.classList.remove("hidden");
    if (bossCanvas) {
      bossCanvas.style.transition = "none";
      gameState.bossRotation = 0;
      bossCanvas.style.transform = `rotate(0deg)`;
      void bossCanvas.offsetHeight;
      this.drawWheel(bossCanvas, bossCtx, gameState.bossSlices);
    }
  },

  spinBossWheel: function() {
    if (bossSpinBtn) bossSpinBtn.disabled = true;

    const slices = gameState.bossSlices;
    const totalWeight = slices.length;
    const selectedIndex = Math.floor(Math.random() * totalWeight);

    const sliceDeg = 360 / totalWeight;
    const sliceCenterDeg = (selectedIndex * sliceDeg) + (sliceDeg / 2);

    const extraSpins = 360 * 5;
    const targetDegree = extraSpins + (360 - sliceCenterDeg) - 90;

    const currentMod = gameState.bossRotation % 360;
    gameState.bossRotation += (targetDegree - currentMod);

    if (bossCanvas) {
      bossCanvas.style.transition = "transform 4s cubic-bezier(0.15, 0.9, 0.25, 1)";
      bossCanvas.style.transform = `rotate(${gameState.bossRotation}deg)`;
    }

    setTimeout(() => {
      const outcome = slices[selectedIndex].label;

      if (outcome === "Yes") {
        this.logEvent(`[VICTORY] You defeated Stage ${gameState.stage} Boss: ${gameState.currentBoss.name}!`);
        gameState.stage++;
        this.updateUI();

        if (battleStatusMsg) {
          battleStatusMsg.style.color = "#2ed573";
          battleStatusMsg.innerText = "VICTORY! Advancing to next stage...";
        }

        setTimeout(() => {
          if (bossModal) bossModal.classList.add("hidden");
          if (spinBtn) spinBtn.disabled = false;
        }, 1500);

      } else {
        if (gameState.inventory.senzuBean > 0) {
          gameState.inventory.senzuBean--;
          this.logEvent(`[DEFEAT] Knocked out! Auto-used 1 Senzu Bean to stay in battle!`);
          this.updateUI();

          if (battleStatusMsg) {
            battleStatusMsg.style.color = "#ffa502";
            battleStatusMsg.innerText = "Defeated! Senzu Bean consumed — Spin again!";
          }
          if (bossSpinBtn) bossSpinBtn.disabled = false;
        } else {
          this.logEvent(`[GAME OVER] Defeated by ${gameState.currentBoss.name} with no Senzu Beans left! Resetting...`);
          if (battleStatusMsg) {
            battleStatusMsg.style.color = "#ff4757";
            battleStatusMsg.innerText = "GAME OVER! Restarting...";
          }
          
          setTimeout(() => {
            this.resetGame();
          }, 2000);
        }
      }
    }, 4000);
  },

  resetGame: function() {
    gameState.phase = "ANIME_SELECT";
    gameState.selectedAnime = null;
    gameState.party = [];
    gameState.inventory = { senzuBean: 0 };
    gameState.stage = 1;
    gameState.isSpinning = false;

    if (bossModal) bossModal.classList.add("hidden");
    if (spinBtn) spinBtn.disabled = false;

    this.init();
  },

  // Updates Stage, Roster (Pictures Only), and Inventory (Pictures + Badges)
  updateUI: function() {
    const stageEl = document.getElementById("stageCounter");
    if (stageEl) stageEl.innerText = gameState.stage;

    const partyCountEl = document.getElementById("partyCount");
    if (partyCountEl) partyCountEl.innerText = gameState.party.length;

    // Roster grid rendering
    const partyListEl = document.getElementById("partyList");
    if (partyListEl) {
      partyListEl.innerHTML = "";
      if (gameState.party.length === 0) {
        partyListEl.innerHTML = "<p class='empty-msg'>No characters recruited yet.</p>";
      } else {
        gameState.party.forEach((char) => {
          const item = document.createElement("div");
          item.className = "party-picture-slot";
          item.title = char.name;
          
          const imgSrc = char.image || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Naruto_logo.svg/500px-Naruto_logo.svg.png";
          item.innerHTML = `<img src="${imgSrc}" alt="${char.name}" class="roster-img" />`;
          partyListEl.appendChild(item);
        });
      }
    }

    // Inventory grid rendering
    const inventoryListEl = document.getElementById("inventoryList");
    if (inventoryListEl) {
      inventoryListEl.innerHTML = "";
      if (gameState.inventory.senzuBean > 0) {
        const itemSlot = document.createElement("div");
        itemSlot.className = "inventory-picture-slot";
        itemSlot.title = "Senzu Bean";
        itemSlot.innerHTML = `
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Symbol_of_Dragon_Ball.svg/500px-Symbol_of_Dragon_Ball.svg.png" alt="Senzu Bean" class="inventory-img" />
          <span class="item-badge">x${gameState.inventory.senzuBean}</span>
        `;
        inventoryListEl.appendChild(itemSlot);
      } else {
        inventoryListEl.innerHTML = "<p class='empty-msg'>Inventory empty.</p>";
      }
    }
  },

  logEvent: function(message) {
    const logBox = document.getElementById("gameLog");
    if (!logBox) return;
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerText = message;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  }
};

// Launch Game Engine
GameEngine.init();