const road = document.getElementById('road');
const playerCar = document.getElementById('player');
const scoreValue = document.getElementById('score-value');
const finalScore = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const difficultySelect = document.getElementById('difficulty');
const tiltBtn = document.getElementById('tilt-btn');
const touchControls = document.getElementById('touch-controls');
const touchLeft = document.getElementById('touch-left');
const touchRight = document.getElementById('touch-right');

// Game State
let animationId;
let score = 0;
let lastTime = 0;
let gameActive = false;
let obstacles = [];
let keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    w: false, s: false, a: false, d: false, W: false, S: false, A: false, D: false
};
let tiltEnabled = false;
let currentBeta = 0; // Tilt value

// Configuration
const CONFIG = {
    carSpeed: 5,
    roadWidth: 400,
    carWidth: 50,
    carHeight: 90,
    spawnInterval: 1500, // Reduced over time
    obstacleSpeed: 3, // Increased over time
    tiltSensitivity: 2
};

// Difficulty Settings
const DIFFICULTIES = {
    easy: { speed: 3, spawnParams: 2000 },
    medium: { speed: 5, spawnParams: 1500 },
    hard: { speed: 8, spawnParams: 1000 }
};

let lastSpawnTime = 0;
let currentSpeed = CONFIG.obstacleSpeed;
let currentSpawnInterval = CONFIG.spawnInterval;

// -- Detect Mobile/Touch --
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
    touchControls.classList.remove('hidden');
    // Check if DeviceOrientation requires permission (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        tiltBtn.classList.remove('hidden');
    } else if (window.DeviceOrientationEvent) {
        // Non-iOS devices usually don't need explicit permission, but we enable the feature logic
        tiltEnabled = true;
    }
}

// Event Listeners
document.addEventListener('keydown', (e) => {
    if (gameActive && keys.hasOwnProperty(e.key)) {
        e.preventDefault();
        keys[e.key] = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (gameActive && keys.hasOwnProperty(e.key)) {
        e.preventDefault();
        keys[e.key] = false;
    }
});

// Touch Events
touchLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowLeft = true; });
touchLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.ArrowLeft = false; });
touchRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowRight = true; });
touchRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.ArrowRight = false; });

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

// Tilt Permission Handler
tiltBtn.addEventListener('click', () => {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    tiltEnabled = true;
                    tiltBtn.innerText = "TILT ENABLED";
                    tiltBtn.disabled = true;
                    // Add listener
                    window.addEventListener('deviceorientation', handleTilt);
                } else {
                    alert('Permission denied');
                }
            })
            .catch(console.error);
    } else {
        // Should not be reachable if button is hidden, but just in case
        tiltEnabled = true;
    }
});

// For non-iOS devices that support it without permission
if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', handleTilt);
}

function handleTilt(event) {
    if (!tiltEnabled) return;
    // gamma is left-to-right tilt in degrees [-90, 90]
    currentBeta = event.gamma;
}


function startGame() {
    const difficulty = difficultySelect.value;
    const settings = DIFFICULTIES[difficulty];

    currentSpeed = settings.speed;
    currentSpawnInterval = settings.spawnParams;

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    gameActive = true;
    score = 0;
    scoreValue.innerText = score;
    obstacles = [];

    // Reset player position
    playerCar.style.left = (CONFIG.roadWidth / 2 - CONFIG.carWidth / 2) + 'px';

    // Clear road
    const existingObstacles = document.querySelectorAll('.obstacle');
    existingObstacles.forEach(obs => obs.remove());

    requestAnimationFrame(gameLoop);
}

function resetGame() {
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

function gameOver() {
    gameActive = false;
    cancelAnimationFrame(animationId); // Stop the loop
    gameOverScreen.classList.remove('hidden');
    finalScore.innerText = Math.floor(score);
}

function gameLoop(timestamp) {
    if (!gameActive) return;

    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    updatePlayer();
    updateObstacles(timestamp, deltaTime);
    updateScore(deltaTime);
    increaseDifficulty(deltaTime);

    animationId = requestAnimationFrame(gameLoop);
}

function updatePlayer() {
    let currentLeft = parseInt(window.getComputedStyle(playerCar).getPropertyValue('left'));

    // Keyboard / Touch Logic
    if ((keys.ArrowLeft || keys.a || keys.A) && currentLeft > 0) {
        currentLeft -= CONFIG.carSpeed;
    }
    if ((keys.ArrowRight || keys.d || keys.D) && currentLeft < (CONFIG.roadWidth - CONFIG.carWidth)) {
        currentLeft += CONFIG.carSpeed;
    }

    // Tilt Logic
    if (tiltEnabled && currentBeta) {
        // Deadzone of 2 degrees
        if (currentBeta < -2 && currentLeft > 0) {
            currentLeft -= CONFIG.carSpeed * (Math.abs(currentBeta) / 10);
        } else if (currentBeta > 2 && currentLeft < (CONFIG.roadWidth - CONFIG.carWidth)) {
            currentLeft += CONFIG.carSpeed * (Math.abs(currentBeta) / 10);
        }
    }

    // Clamp
    if (currentLeft < 0) currentLeft = 0;
    if (currentLeft > (CONFIG.roadWidth - CONFIG.carWidth)) currentLeft = CONFIG.roadWidth - CONFIG.carWidth;

    playerCar.style.left = currentLeft + 'px';
}

function updateObstacles(timestamp, deltaTime) {
    // Spawning
    if (timestamp - lastSpawnTime > currentSpawnInterval) {
        spawnObstacle();
        lastSpawnTime = timestamp;
    }

    // Moving & Removing
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        let obsTop = obs.y;

        obsTop += currentSpeed * (deltaTime / 16); // Normalize speed for frame rate
        obs.y = obsTop;
        obs.element.style.top = obsTop + 'px';

        // Collision Detection
        if (isColliding(playerCar, obs.element)) {
            gameOver();
            return;
        }

        // Cleanup
        if (obsTop > 600) { // Off screen
            obs.element.remove();
            obstacles.splice(i, 1);
            i--;
        }
    }
}

function spawnObstacle() {
    const obstacle = document.createElement('div');
    obstacle.classList.add('car', 'obstacle');

    // Random position
    const maxLeft = CONFIG.roadWidth - CONFIG.carWidth;
    const randomLeft = Math.floor(Math.random() * maxLeft);

    obstacle.style.left = randomLeft + 'px';
    obstacle.style.top = '-100px';

    road.appendChild(obstacle);

    obstacles.push({
        element: obstacle,
        y: -100
    });
}

function isColliding(a, b) {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();

    return !(
        aRect.top > bRect.bottom ||
        aRect.right < bRect.left ||
        aRect.bottom < bRect.top ||
        aRect.left > bRect.right
    );
}

function updateScore(deltaTime) {
    // Score based on survival time or distance
    score += (currentSpeed * 0.05); // Faster speed = faster score
    scoreValue.innerText = Math.floor(score);
}

function increaseDifficulty(deltaTime) {
    // Gradually increase speed and spawn rate every few seconds worth of frames
    // This is a continuous increase
    currentSpeed += 0.001;
    if (currentSpawnInterval > 500) {
        currentSpawnInterval -= 0.1;
    }
}
