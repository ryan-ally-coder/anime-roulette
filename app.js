// Global Game State
let gameState = {
  phase: "ANIME_SELECT", // "ANIME_SELECT" or "MAIN_GAME"
  selectedAnime: null,
  party: [],
  isSpinning: false,
  currentRotation: 0,
  activeCharacters: [],
  activeBosses: []
};

// Main Game Slices (Loaded after anime selection)
const mainSlices = [
  { label: "Recruit Hero", weight: 50, color: "#2ed573" },
  { label: "Arc Boss", weight: 25, color: "#ff4757" },
  { label: "Training Arc", weight: 15, color: "#ffa502" },
  { label: "Item Drop", weight: 10, color: "#1e90ff" }
];

// Dynamic Slices Array (Will hold either Anime list or Main Slices)
let currentWheelSlices = [];

const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");

// 1. Fetch JSON & Setup Anime Selection Wheel
async function initGame() {
  try {
    const response = await fetch('./animes.json');
    const animeData = await response.json();

    // Filter available animes from JSON
    const availableAnimes = animeData.animes.filter(a => a.enabled);

    // Build the initial wheel slices out of available Animes
    const sliceColors = ["#9b59b6", "#e67e22", "#1abc9c", "#e74c3c", "#3498db"];
    currentWheelSlices = availableAnimes.map((anime, index) => ({
      label: anime.title,
      data: anime, // Store full anime object
      weight: 1,  // Equal probability for each anime
      color: sliceColors[index % sliceColors.length]
    }));

    drawWheel();
    updateUI();
    logEvent("[STARTUP] Spin the wheel to choose your starting Anime!");
    
    spinBtn.addEventListener("click", spinWheel);
  } catch (error) {
    console.error("Error loading anime data:", error);
    logEvent("[ERROR] Could not load animes.json. Ensure Live Server is running.");
  }
}

// 2. Proportional Canvas Drawing Engine
function drawWheel() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 160;

  const totalWeight = currentWheelSlices.reduce((sum, s) => sum + s.weight, 0);
  let currentAngle = 0;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  currentWheelSlices.forEach((slice) => {
    const sliceAngle = (slice.weight / totalWeight) * (2 * Math.PI);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    ctx.strokeStyle = "#121212";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(currentAngle + sliceAngle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(slice.label, radius - 15, 5);
    ctx.restore();

    currentAngle += sliceAngle;
  });
}

// 3. Weighted Spin Animation Logic
function spinWheel() {
  if (gameState.isSpinning) return;
  gameState.isSpinning = true;
  spinBtn.disabled = true;

  const totalWeight = currentWheelSlices.reduce((sum, s) => sum + s.weight, 0);

  // Pick random weighted outcome
  let randomVal = Math.random() * totalWeight;
  let selectedIndex = 0;

  for (let i = 0; i < currentWheelSlices.length; i++) {
    if (randomVal < currentWheelSlices[i].weight) {
      selectedIndex = i;
      break;
    }
    randomVal -= currentWheelSlices[i].weight;
  }

  // Calculate slice angles
  let startWeight = 0;
  for (let i = 0; i < selectedIndex; i++) {
    startWeight += currentWheelSlices[i].weight;
  }
  const endWeight = startWeight + currentWheelSlices[selectedIndex].weight;

  const startDeg = (startWeight / totalWeight) * 360;
  const endDeg = (endWeight / totalWeight) * 360;
  const sliceCenterDeg = (startDeg + endDeg) / 2;

  // Rotation positioning
  const extraSpins = 360 * 5;
  const targetDegree = extraSpins + (360 - sliceCenterDeg) - 90;

  const currentMod = gameState.currentRotation % 360;
  gameState.currentRotation += (targetDegree - currentMod);

  canvas.style.transition = "transform 4s cubic-bezier(0.15, 0.9, 0.25, 1)";
  canvas.style.transform = `rotate(${gameState.currentRotation}deg)`;

  setTimeout(() => {
    handleSpinResult(currentWheelSlices[selectedIndex]);
    gameState.isSpinning = false;
    spinBtn.disabled = false;
  }, 4000);
}

// 4. Handle Selection vs. Gameplay Phases
function handleSpinResult(selectedSlice) {
  if (gameState.phase === "ANIME_SELECT") {
    // Lock in chosen anime
    gameState.selectedAnime = selectedSlice.data;
    gameState.activeCharacters = [...selectedSlice.data.characters];
    gameState.activeBosses = [...selectedSlice.data.bosses];
    
    logEvent(`[WORLD SELECTED] You locked in: ${gameState.selectedAnime.title}! All other worlds shut down.`);

    // Switch game phase to Main Game
    gameState.phase = "MAIN_GAME";
    currentWheelSlices = mainSlices;

    // Reset wheel canvas visual transition
    canvas.style.transition = "none";
    gameState.currentRotation = 0;
    canvas.style.transform = `rotate(0deg)`;

    // Redraw wheel with main gameplay slices
    drawWheel();
  } 
  else if (gameState.phase === "MAIN_GAME") {
    handleEventOutcome(selectedSlice.label);
  }
}

// 5. Main Game Event Outcomes
function handleEventOutcome(sliceLabel) {
  if (sliceLabel === "Recruit Hero") {
    const randomChar = gameState.activeCharacters[Math.floor(Math.random() * gameState.activeCharacters.length)];
    if (gameState.party.length < 6) {
      gameState.party.push({ ...randomChar });
      logEvent(`[RECRUIT] You recruited ${randomChar.name} (${randomChar.type} Type, +${randomChar.power} Power)!`);
    } else {
      logEvent(`[PARTY FULL] Met ${randomChar.name}, but your roster is full!`);
    }
  } 
  else if (sliceLabel === "Arc Boss") {
    const boss = gameState.activeBosses[Math.floor(Math.random() * gameState.activeBosses.length)];
    const totalPower = gameState.party.reduce((sum, c) => sum + c.power, 0);

    if (gameState.party.length === 0) {
      logEvent(`[BOSS] Encountered Boss ${boss.name}! You had no characters and retreated!`);
    } else if (totalPower >= boss.requiredPower) {
      logEvent(`[VICTORY] Boss Battle against ${boss.name}! Your power (${totalPower}) beat Boss Power (${boss.requiredPower}). YOU WON!`);
    } else {
      logEvent(`[DEFEAT] Boss Battle against ${boss.name}! Your power (${totalPower}) fell short of Boss Power (${boss.requiredPower}). Retreating!`);
    }
  } 
  else if (sliceLabel === "Training Arc") {
    if (gameState.party.length > 0) {
      gameState.party.forEach(char => char.power += 10);
      logEvent(`[TRAINING ARC] Team trained hard! +10 Power to all party members!`);
    } else {
      logEvent(`[TRAINING ARC] You trained alone, but have no team members to boost!`);
    }
  } 
  else if (sliceLabel === "Item Drop") {
    logEvent(`[ITEM] Found a Senzu Bean! Party fully restored.`);
  }

  updateUI();
}

// 6. UI Updates
function updateUI() {
  document.getElementById("partyCount").innerText = gameState.party.length;
  const totalPower = gameState.party.reduce((sum, c) => sum + c.power, 0);
  document.getElementById("totalPower").innerText = totalPower;

  const partyListEl = document.getElementById("partyList");
  partyListEl.innerHTML = "";

  if (gameState.party.length === 0) {
    partyListEl.innerHTML = "<p style='color:#777;'>No characters recruited yet.</p>";
  } else {
    gameState.party.forEach((char) => {
      const item = document.createElement("div");
      item.className = `party-slot type-${char.type}`;
      item.innerHTML = `
        <div>
          <strong>${char.name}</strong><br>
          <small style="color:#aaa;">Type: ${char.type}</small>
        </div>
        <div><strong>${char.power} PWR</strong></div>
      `;
      partyListEl.appendChild(item);
    });
  }
}

function logEvent(message) {
  const logBox = document.getElementById("gameLog");
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerText = message;
  logBox.appendChild(entry);
  logBox.scrollTop = logBox.scrollHeight;
}

// Start Game Engine
initGame();