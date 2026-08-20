// Global Game State
const gameState = {
  phase: "ANIME_SELECT", // ANIME_SELECT, STARTER_SELECT, MAIN_GAME, ENCOUNTER_SELECT, TRAINING_SELECT, WANDER_OFF_WHEEL, BOSS_BATTLE, EVOLUTION_WHEEL
  isChooseMode: false,
  selectedAnime: null,
  party: [],
  inventory: { senzuBean: 0 },
  stage: 1,
  evoChance: 0.25, // Evolution pity chance starting at 25%
  isSpinning: false,
  currentRotation: 0,
  availableAnimes: [],
  activeCharacters: [],
  activeBosses: [],
  currentBoss: null,
  encounterSlices: [],
  trainSlices: [],
  bossSlices: []
};

// Main Event Wheel Slices (Updated to include Wander Off)
const mainSlices = [
  { label: "Random Encounter", weight: 45, color: "#2ed573" },
  { label: "Training Arc", weight: 30, color: "#ffa502" },
  { label: "Item Drop", weight: 10, color: "#1e90ff" },
  { label: "Wander Off", weight: 15, color: "#9b59b6" }
];

let currentWheelSlices = [];

// DOM Elements
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const spinBtn = document.getElementById("spinBtn");
const wheelTitle = document.getElementById("wheelTitle");

const toggleModeBtn = document.getElementById("toggleModeBtn");
const spinModeView = document.getElementById("spinModeView");
const chooseModeView = document.getElementById("chooseModeView");
const animeSelectDropdown = document.getElementById("animeSelectDropdown");
const confirmSelectBtn = document.getElementById("confirmSelectBtn");
const restartBtn = document.getElementById("restartBtn");

// Game Engine Logic
const GameEngine = {
  init: async function() {
    try {
      const response = await fetch('./animes.json');
      if (!response.ok) throw new Error("Failed to load JSON file");
      const animeData = await response.json();

      gameState.availableAnimes = animeData.animes.filter(a => a.enabled);
      
      this.populateDropdown();
      this.resetToAnimeSelect();

      // Event Listeners
      if (spinBtn) spinBtn.onclick = this.handleMainSpinClick.bind(this);
      if (toggleModeBtn) toggleModeBtn.onclick = this.toggleSelectionMode.bind(this);
      if (confirmSelectBtn) confirmSelectBtn.onclick = this.confirmManualChoice.bind(this);
      if (restartBtn) restartBtn.onclick = this.resetToAnimeSelect.bind(this);

      // Game Log Sidebar Toggle Listeners
      const toggleLogBtn = document.getElementById("toggleLogBtn");
      const closeLogBtn = document.getElementById("closeLogBtn");
      const logSidebar = document.getElementById("logSidebar");

      if (toggleLogBtn && logSidebar) {
        toggleLogBtn.onclick = () => {
          logSidebar.classList.toggle("hidden");
        };
      }

      if (closeLogBtn && logSidebar) {
        closeLogBtn.onclick = () => {
          logSidebar.classList.add("hidden");
        };
      }

    } catch (error) {
      console.error("Error loading anime data:", error);
      this.logEvent("[ERROR] Could not load animes.json. Ensure Live Server is running.");
    }
  },

  populateDropdown: function() {
    if (!animeSelectDropdown) return;
    animeSelectDropdown.innerHTML = `<option value="" disabled selected>-- Choose an Anime --</option>`;
    gameState.availableAnimes.forEach(anime => {
      const option = document.createElement("option");
      option.value = anime.id;
      option.textContent = anime.title;
      animeSelectDropdown.appendChild(option);
    });
  },

  resetToAnimeSelect: function() {
    gameState.phase = "ANIME_SELECT";
    gameState.stage = 1;
    gameState.evoChance = 0.25; // Reset evolution chance
    gameState.party = [];
    gameState.inventory = { senzuBean: 0 };
    gameState.selectedAnime = null;
    gameState.isSpinning = false;

    const sliceColors = ["#9b59b6", "#e67e22", "#1abc9c", "#e74c3c", "#3498db"];
    currentWheelSlices = gameState.availableAnimes.map((anime, index) => ({
      label: anime.title,
      data: anime,
      weight: 1,
      color: sliceColors[index % sliceColors.length]
    }));

    if (wheelTitle) wheelTitle.textContent = "Select Anime Universe";
    if (spinBtn) {
      spinBtn.textContent = "SPIN FOR UNIVERSE";
      spinBtn.disabled = false;
      spinBtn.classList.remove("hidden");
    }
    if (restartBtn) restartBtn.classList.add("hidden");
    if (toggleModeBtn) toggleModeBtn.classList.remove("hidden");

    if (gameState.isChooseMode) {
      spinModeView.classList.add("hidden");
      chooseModeView.classList.remove("hidden");
    } else {
      chooseModeView.classList.add("hidden");
      spinModeView.classList.remove("hidden");
    }

    this.resetCanvasRotation();
    this.drawCurrentWheel();
    this.updateUI();
    this.logEvent("[RESTART] Game reset. Select or spin for a new Anime Universe!");
  },

  toggleSelectionMode: function() {
    if (gameState.phase !== "ANIME_SELECT") return;

    gameState.isChooseMode = !gameState.isChooseMode;

    if (gameState.isChooseMode) {
      spinModeView.classList.add("hidden");
      chooseModeView.classList.remove("hidden");
      toggleModeBtn.textContent = "🔀 Switch to: Spin Wheel";
    } else {
      chooseModeView.classList.add("hidden");
      spinModeView.classList.remove("hidden");
      toggleModeBtn.textContent = "🔀 Switch to: Choose an Anime";
    }
  },

  confirmManualChoice: function() {
    const selectedId = animeSelectDropdown.value;
    if (!selectedId) {
      alert("Please select an anime universe first!");
      return;
    }

    const chosenAnime = gameState.availableAnimes.find(a => a.id === selectedId);
    if (chosenAnime) {
      chooseModeView.classList.add("hidden");
      spinModeView.classList.remove("hidden");
      if (toggleModeBtn) toggleModeBtn.classList.add("hidden");

      this.selectAnimeWorld(chosenAnime);
    }
  },

  selectAnimeWorld: function(animeObject) {
    gameState.selectedAnime = animeObject;
    gameState.activeCharacters = [...animeObject.characters];
    gameState.activeBosses = [...animeObject.bosses];

    this.logEvent(`[WORLD SELECTED] Locked in: ${gameState.selectedAnime.title}!`);

    const nextFormNames = new Set(
      gameState.activeCharacters
        .map(c => c.nextForm)
        .filter(nf => nf !== null && nf !== undefined)
    );

    const baseEvolvableCharacters = gameState.activeCharacters.filter(
      c => !nextFormNames.has(c.name) && c.nextForm !== null && c.nextForm !== undefined
    );

    const starterPool = baseEvolvableCharacters.length > 0 
      ? baseEvolvableCharacters 
      : gameState.activeCharacters.filter(c => !nextFormNames.has(c.name));

    gameState.phase = "STARTER_SELECT";
    const colors = ["#2ecc71", "#3498db", "#9b59b6", "#f1c40f", "#e67e22", "#e74c3c"];
    
    currentWheelSlices = starterPool.map((char, index) => ({
      label: char.name,
      data: char,
      weight: 1,
      color: colors[index % colors.length]
    }));

    if (wheelTitle) wheelTitle.textContent = "Spin for Starter Character";
    if (spinBtn) {
      spinBtn.textContent = "SPIN FOR STARTER";
      spinBtn.disabled = false;
    }

    this.resetCanvasRotation();
    this.drawCurrentWheel();
  },

  resetCanvasRotation: function() {
    if (!canvas) return;
    canvas.style.transition = "none";
    gameState.currentRotation = 0;
    canvas.style.transform = `rotate(0deg)`;
    void canvas.offsetHeight;
  },

  drawCurrentWheel: function() {
    if (!canvas || !ctx) return;
    this.drawStandardWheel(canvas, ctx, currentWheelSlices);
  },

  drawStandardWheel: function(c, context, slices) {
    if (!c || !context) return;
    const centerX = c.width / 2;
    const centerY = c.height / 2;
    const radius = c.width / 2 - 15;

    const totalWeight = slices.reduce((sum, s) => sum + s.weight, 0);
    let currentAngle = 0;

    context.clearRect(0, 0, c.width, c.height);

    const numSlices = slices.length;
    let fontSize = 12;
    if (numSlices > 15) fontSize = 8;
    else if (numSlices > 10) fontSize = 9;

    slices.forEach((slice) => {
      const sliceAngle = (slice.weight / totalWeight) * (2 * Math.PI);

      context.beginPath();
      context.moveTo(centerX, centerY);
      context.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      context.closePath();
      context.fillStyle = slice.color;
      context.fill();
      context.strokeStyle = "#121214";
      context.lineWidth = 2;
      context.stroke();

      const midAngle = currentAngle + sliceAngle / 2;

      context.save();
      context.translate(centerX, centerY);
      context.rotate(midAngle);
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillStyle = "#ffffff";
      context.font = `bold ${fontSize}px sans-serif`;
      context.shadowColor = "rgba(0, 0, 0, 0.7)";
      context.shadowBlur = 3;

      let text = slice.label;
      const maxLength = numSlices > 10 ? 14 : 22;
      if (text.length > maxLength) {
        text = text.substring(0, maxLength - 3) + "...";
      }

      context.fillText(text, radius - 10, 0);
      context.restore();

      currentAngle += sliceAngle;
    });
  },

  handleMainSpinClick: function() {
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
    switch (gameState.phase) {
      case "ANIME_SELECT":
        if (toggleModeBtn) toggleModeBtn.classList.add("hidden");
        this.selectAnimeWorld(selectedSlice.data);
        break;

      case "STARTER_SELECT":
        const starterChar = selectedSlice.data;
        gameState.party.push({ ...starterChar });
        this.logEvent(`[STARTER] You recruited ${starterChar.name} as your starter character!`);
        this.updateUI();
        this.transitionToMainGame();
        break;

      case "MAIN_GAME":
        this.handleEventOutcome(selectedSlice.label);
        break;

      case "ENCOUNTER_SELECT":
        const char = selectedSlice.data;
        if (gameState.party.length < 6) {
          gameState.party.push({ ...char });
          this.logEvent(`[ENCOUNTER] You met and recruited ${char.name}!`);
        } else {
          this.logEvent(`[ENCOUNTER] Met ${char.name}, but your roster is full!`);
        }
        this.updateUI();
        this.triggerBossBattle();
        break;

      case "TRAINING_SELECT":
        const oldChar = selectedSlice.data;
        const partyIndex = selectedSlice.partyIndex;
        const nextFormObj = gameState.activeCharacters.find(c => c.name === oldChar.nextForm);

        if (nextFormObj) {
          gameState.party[partyIndex] = { ...nextFormObj };
          this.logEvent(`[EVOLUTION] ${oldChar.name} EVOLVED into ${nextFormObj.name}!`);
        } else {
          this.logEvent(`[TRAINING] ${oldChar.name} trained hard!`);
        }
        this.updateUI();
        this.triggerBossBattle();
        break;

      case "WANDER_OFF_WHEEL":
        this.resolveWanderOffWheel(selectedSlice);
        break;

      case "BOSS_BATTLE":
        this.resolveBossBattle(selectedSlice);
        break;

      case "EVOLUTION_WHEEL":
        this.resolveEvolutionWheel(selectedSlice);
        break;
    }
  },

  transitionToMainGame: function() {
    gameState.phase = "MAIN_GAME";
    currentWheelSlices = mainSlices;

    if (wheelTitle) wheelTitle.textContent = "Spin Main Event Wheel";
    if (spinBtn) {
      spinBtn.textContent = "SPIN EVENT WHEEL";
      spinBtn.disabled = false;
    }

    this.resetCanvasRotation();
    this.drawCurrentWheel();
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
      case "Wander Off":
        this.setupWanderOffWheel();
        break;
    }
  },

  setupEncounterWheel: function() {
    const characters = gameState.activeCharacters;
    if (!characters || characters.length === 0) {
      this.logEvent(`[ERROR] No characters available! Skipping to boss.`);
      this.triggerBossBattle();
      return;
    }

    gameState.phase = "ENCOUNTER_SELECT";
    const colors = ["#2ecc71", "#27ae60", "#1abc9c", "#16a085", "#3498db", "#2980b9"];
    
    currentWheelSlices = characters.map((char, index) => ({
      label: char.name,
      data: char,
      weight: 1,
      color: colors[index % colors.length]
    }));

    if (wheelTitle) wheelTitle.textContent = "Random Encounter: Spin to Recruit";
    if (spinBtn) {
      spinBtn.textContent = "RECRUIT CHARACTER";
      spinBtn.disabled = false;
    }

    this.resetCanvasRotation();
    this.drawCurrentWheel();
  },

  setupTrainingArcWheel: function() {
    const eligibleMembers = gameState.party
      .map((char, index) => ({ char, partyIndex: index }))
      .filter(item => item.char.nextForm !== null && item.char.nextForm !== undefined);

    if (eligibleMembers.length === 0) {
      gameState.inventory.senzuBean++;
      this.logEvent(`[TRAINING ARC] No evolvable characters! Rewarded 1 Senzu Bean instead.`);
      this.updateUI();
      this.triggerBossBattle();
      return;
    }

    gameState.phase = "TRAINING_SELECT";
    const colors = ["#ffa502", "#e67e22", "#f39c12", "#d35400", "#16a085", "#2980b9"];

    currentWheelSlices = eligibleMembers.map((item, i) => ({
      label: item.char.name,
      data: item.char,
      partyIndex: item.partyIndex,
      weight: 1,
      color: colors[i % colors.length]
    }));

    if (wheelTitle) wheelTitle.textContent = "Training Arc: Spin to Evolve";
    if (spinBtn) {
      spinBtn.textContent = "EVOLVE CHARACTER";
      spinBtn.disabled = false;
    }

    this.resetCanvasRotation();
    this.drawCurrentWheel();
  },

  setupWanderOffWheel: function() {
    gameState.phase = "WANDER_OFF_WHEEL";

    currentWheelSlices = [
      { label: "Bag of Senzu Beans (x3)", type: "senzu_bag", weight: 25, color: "#1e90ff" },
      { label: "Duo Training", type: "duo_training", weight: 25, color: "#ffa502" },
      { label: "Ultimate Discovery", type: "ultimate_discovery", weight: 15, color: "#9b59b6" },
      { label: "Wander Back (Boss)", type: "wander_back", weight: 35, color: "#ff4757" }
    ];

    if (wheelTitle) wheelTitle.textContent = "Wander Off: Spin for a Mystery Event!";
    if (spinBtn) {
      spinBtn.textContent = "SPIN WANDER OFF";
      spinBtn.disabled = false;
    }

    this.resetCanvasRotation();
    this.drawCurrentWheel();
  },

  resolveWanderOffWheel: function(selectedSlice) {
    switch (selectedSlice.type) {
      case "senzu_bag":
        gameState.inventory.senzuBean += 3;
        this.logEvent(`[WANDER OFF] Found a bag of Senzu Beans! +3 Senzu Beans added.`);
        this.updateUI();
        this.triggerBossBattle();
        break;

      case "duo_training":
        const eligibleMembers = gameState.party
          .map((char, index) => ({ char, partyIndex: index }))
          .filter(item => item.char.nextForm !== null && item.char.nextForm !== undefined);

        if (eligibleMembers.length === 0) {
          gameState.inventory.senzuBean++;
          this.logEvent(`[DUO TRAINING] No evolvable characters in party! Rewarded 1 Senzu Bean instead.`);
        } else {
          const shuffled = [...eligibleMembers].sort(() => 0.5 - Math.random());
          const toEvolve = shuffled.slice(0, 2);

          toEvolve.forEach(item => {
            const nextFormObj = gameState.activeCharacters.find(c => c.name === item.char.nextForm);
            if (nextFormObj) {
              gameState.party[item.partyIndex] = { ...nextFormObj };
              this.logEvent(`[DUO TRAINING] ${item.char.name} evolved into ${nextFormObj.name}!`);
            }
          });

          if (eligibleMembers.length === 1) {
            gameState.inventory.senzuBean++;
            this.logEvent(`[DUO TRAINING] Only 1 party member could evolve, so you found 1 bonus Senzu Bean!`);
          }
        }
        this.updateUI();
        this.triggerBossBattle();
        break;

      case "ultimate_discovery":
        let evolvedAny = false;
        gameState.party.forEach((char, index) => {
          let current = char;
          let chainCount = 1;
          while (current && current.nextForm) {
            chainCount++;
            current = gameState.activeCharacters.find(c => c.name === current.nextForm);
          }

          if (chainCount >= 3) {
            let finalForm = char;
            while (finalForm && finalForm.nextForm) {
              let nextObj = gameState.activeCharacters.find(c => c.name === finalForm.nextForm);
              if (nextObj) finalForm = nextObj;
              else break;
            }

            if (finalForm.name !== gameState.party[index].name) {
              gameState.party[index] = { ...finalForm };
              this.logEvent(`[ULTIMATE DISCOVERY] ${char.name}'s lineage unlocked their final form: ${finalForm.name}!`);
              evolvedAny = true;
            }
          }
        });

        if (!evolvedAny) {
          this.logEvent(`[ULTIMATE DISCOVERY] No characters in your party have deep enough evolution lines (3+ forms). You found a Senzu Bean instead!`);
          gameState.inventory.senzuBean++;
        }

        this.updateUI();
        this.triggerBossBattle();
        break;

      case "wander_back":
      default:
        this.logEvent(`[WANDER BACK] You wandered back safely, starting the boss battle!`);
        this.updateUI();
        this.triggerBossBattle();
        break;
    }
  },

  triggerBossBattle: function() {
    if (!gameState.activeBosses || gameState.activeBosses.length === 0) {
      this.logEvent(`[VICTORY] You conquered all bosses in this world!`);
      return;
    }

    gameState.phase = "BOSS_BATTLE";
    const bossIndex = Math.min(gameState.stage - 1, gameState.activeBosses.length - 1);
    gameState.currentBoss = gameState.activeBosses[bossIndex];

    const startingBaseWinRate = 0.60;
    const stagePenalty = (gameState.stage - 1) * 0.15;
    let calculatedWinRate = startingBaseWinRate - stagePenalty;

    const extraMembers = Math.max(0, gameState.party.length - 1);
    const partyBonus = extraMembers * 0.05;

    const allNextForms = new Set(
      gameState.activeCharacters
        .map(c => c.nextForm)
        .filter(nf => nf !== null && nf !== undefined)
    );
    const evolvedCount = gameState.party.filter(member => allNextForms.has(member.name)).length;
    const evolutionBonus = evolvedCount * 0.10;

    calculatedWinRate += partyBonus + evolutionBonus;

    const winChanceFraction = Math.min(0.90, Math.max(0.10, calculatedWinRate));
    const winPercentage = Math.round(winChanceFraction * 100);

    function getSimplifiedRatio(numerator, denominator) {
      function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
      const divisor = gcd(numerator, denominator);
      return { green: numerator / divisor, total: denominator / divisor };
    }

    let { green: greenCount, total: totalSlices } = getSimplifiedRatio(winPercentage, 100);

    if (totalSlices < 4) {
      greenCount *= Math.ceil(4 / totalSlices);
      totalSlices = Math.ceil(4 / totalSlices) * totalSlices;
    } else if (totalSlices > 20) {
      totalSlices = 20;
      greenCount = Math.round(winChanceFraction * 20);
    }

    const slicesArr = new Array(totalSlices).fill("defeat");
    if (greenCount > 0) {
      const step = totalSlices / greenCount;
      for (let i = 0; i < greenCount; i++) {
        const indexToPlace = Math.floor(i * step);
        slicesArr[indexToPlace] = "victory";
      }
    }

    currentWheelSlices = slicesArr.map((type) => ({
      label: type === "victory" ? "Victory" : "Defeat",
      type: type,
      weight: 1,
      color: type === "victory" ? "#2ed573" : "#ff4757"
    }));

    if (wheelTitle) wheelTitle.textContent = `Boss: ${gameState.currentBoss.name} (${winPercentage}% Win Rate)`;
    if (spinBtn) {
      spinBtn.textContent = "FIGHT BOSS";
      spinBtn.disabled = false;
    }

    this.resetCanvasRotation();
    this.drawCurrentWheel();
  },

  resolveBossBattle: function(selectedSlice) {
    const isVictory = selectedSlice.type === "victory";

    if (isVictory) {
      this.logEvent(`[BOSS VICTORY] Defeated ${gameState.currentBoss.name}!`);
      
      if (gameState.stage >= gameState.activeBosses.length) {
        if (wheelTitle) wheelTitle.textContent = "🏆 YOU BEAT THE FINAL BOSS! YOU WIN!";
        this.logEvent(`[VICTORY] You conquered the world!`);
        if (spinBtn) spinBtn.classList.add("hidden");
        if (restartBtn) restartBtn.classList.remove("hidden");
      } else {
        this.setupEvolutionWheel();
      }
    } else {
      if (gameState.inventory.senzuBean > 0) {
        gameState.inventory.senzuBean--;
        if (wheelTitle) wheelTitle.textContent = `Defeated! Used 1 Senzu Bean! Re-spinning...`;
        this.logEvent(`[BOSS DEFEAT] Used 1 Senzu Bean to survive against ${gameState.currentBoss.name}! Re-rolling battle...`);
        this.updateUI();

        setTimeout(() => {
          this.triggerBossBattle();
        }, 1500);
      } else {
        if (wheelTitle) wheelTitle.textContent = "💀 GAME OVER! You ran out of Senzu Beans.";
        this.logEvent(`[GAME OVER] Defeated by ${gameState.currentBoss.name} with no Senzu Beans remaining.`);
        if (spinBtn) spinBtn.classList.add("hidden");
        if (restartBtn) restartBtn.classList.remove("hidden");
      }
    }
  },

  setupEvolutionWheel: function() {
    const eligibleMembers = gameState.party.filter(
      char => char.nextForm !== null && char.nextForm !== undefined
    );

    if (eligibleMembers.length === 0) {
      this.logEvent(`[EVOLUTION REWARD] No evolvable characters in party. Advancing to Stage ${gameState.stage + 1}...`);
      gameState.stage++;
      this.updateUI();
      this.transitionToMainGame();
      return;
    }

    gameState.phase = "EVOLUTION_WHEEL";

    const successPercentage = Math.round(gameState.evoChance * 100);
    const failPercentage = 100 - successPercentage;

    currentWheelSlices = [];
    if (successPercentage > 0) {
      currentWheelSlices.push({
        label: `Evolution (${successPercentage}%)`,
        type: "success",
        weight: successPercentage,
        color: "#2ed573"
      });
    }
    if (failPercentage > 0) {
      currentWheelSlices.push({
        label: `No Evolution (${failPercentage}%)`,
        type: "fail",
        weight: failPercentage,
        color: "#ff4757"
      });
    }

    if (wheelTitle) wheelTitle.textContent = `Post-Boss Reward: Evolution Chance (${successPercentage}%)`;
    if (spinBtn) {
      spinBtn.textContent = "SPIN FOR EVOLUTION";
      spinBtn.disabled = false;
    }

    this.resetCanvasRotation();
    this.drawCurrentWheel();
  },

  resolveEvolutionWheel: function(selectedSlice) {
    if (selectedSlice.type === "success") {
      gameState.evoChance = 0.25;

      const eligibleIndices = [];
      gameState.party.forEach((char, index) => {
        if (char.nextForm !== null && char.nextForm !== undefined) {
          eligibleIndices.push(index);
        }
      });

      const randomIndex = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
      const oldChar = gameState.party[randomIndex];
      const nextFormObj = gameState.activeCharacters.find(c => c.name === oldChar.nextForm);

      if (nextFormObj) {
        gameState.party[randomIndex] = { ...nextFormObj };
        this.logEvent(`[EVOLUTION SUCCESS] ${oldChar.name} EVOLVED into ${nextFormObj.name}! Chance reset to 25%.`);
      }
    } else {
      gameState.evoChance = Math.min(1.0, gameState.evoChance + 0.25);
      this.logEvent(`[EVOLUTION FAILED] No evolution triggered. Next post-boss chance boosted to ${Math.round(gameState.evoChance * 100)}%!`);
    }

    gameState.stage++;
    this.updateUI();
    this.transitionToMainGame();
  },

  updateUI: function() {
    const stageCounter = document.getElementById("stageCounter");
    if (stageCounter) stageCounter.textContent = gameState.stage;

    const partyCount = document.getElementById("partyCount");
    if (partyCount) partyCount.textContent = gameState.party.length;

    const partyListEl = document.getElementById("partyList");
    if (partyListEl) {
      partyListEl.innerHTML = "";
      if (gameState.party.length === 0) {
        partyListEl.innerHTML = "<p class='empty-msg'>No characters recruited yet.</p>";
      } else {
        const fallbackImg = "https://via.placeholder.com/150?text=No+Image";
        gameState.party.forEach((char) => {
          const item = document.createElement("div");
          item.className = "party-picture-slot";
          item.title = char.name;
          const imgSrc = char.image || fallbackImg;
          item.innerHTML = `<img src="${imgSrc}" alt="${char.name}" class="roster-img" onerror="this.onerror=null; this.src='${fallbackImg}';" />`;
          partyListEl.appendChild(item);
        });
      }
    }

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
    entry.textContent = message;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  }
};

window.onload = function() {
  GameEngine.init();
};