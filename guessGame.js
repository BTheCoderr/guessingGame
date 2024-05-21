let randomNumber
let maxNumber
let attempts = 0
let score = 0
let level = 1
const maxHints = 3
let hintsUsed = 0
let timer
const timeLimit = 30
let timerStarted = false

const setDifficulty = () => {
  const difficulty = document.getElementById('difficulty').value
  switch (difficulty) {
    case 'easy':
      maxNumber = 10
      break
    case 'medium':
      maxNumber = 100
      break
    case 'hard':
      maxNumber = 1000
      break
  }
  startGame()
}

const startGame = () => {
  randomNumber = Math.floor(Math.random() * maxNumber) + 1
  document.getElementById('min-number').innerText = 1
  document.getElementById('max-number').innerText = maxNumber
  document.getElementById('result').innerText = ''
  document.getElementById('hint').innerText = ''
  document.getElementById('score').innerText = 'Score: ' + score
  document.getElementById('level').innerText = 'Level: ' + level
  document.getElementById('hints').innerText = 'Hints: ' + (maxHints - hintsUsed)
  document.getElementById('timer').innerText = 'Time: ' + timeLimit
  attempts = 0
  hintsUsed = 0
  timerStarted = false
}

const startTimer = () => {
  let timeRemaining = timeLimit
  document.getElementById('timer').innerText = 'Time: ' + timeRemaining
  timer = setInterval(() => {
    timeRemaining--
    document.getElementById('timer').innerText = 'Time: ' + timeRemaining
    if (timeRemaining <= 0) {
      clearInterval(timer)
      document.getElementById('result').innerText = 'Time\'s up! The number was ' + randomNumber
    }
  }, 1000)
}

document.getElementById('difficulty').addEventListener('change', setDifficulty)
document.getElementById('difficulty').dispatchEvent(new Event('change')) 

document.getElementById('guess-btn').addEventListener('click', () => {
  if (!timerStarted) {
    startTimer()
    timerStarted = true
  }

  const guess = parseInt(document.getElementById('guess-input').value)
  attempts++
  if (guess === randomNumber) {
    score += 100 - attempts
    document.getElementById('result').innerText = `Correct! The number was ${randomNumber}.`
    level++
    maxNumber *= 2
    clearInterval(timer)
    setTimeout(startGame, 2000)
  } else {
    document.getElementById('result').innerText = guess > randomNumber ? 'Too high!' : 'Too low!'
    if (attempts > maxHints && hintsUsed < maxHints) {
      provideHint(randomNumber, guess)
      hintsUsed++
      document.getElementById('hints').innerText = 'Hints: ' + (maxHints - hintsUsed)
    }
  }
})

const provideHint = (randomNumber, guess) => {
  const hintRange = 5
  const lowerBound = Math.max(randomNumber - hintRange, 1)
  const upperBound = Math.min(randomNumber + hintRange, maxNumber)
  document.getElementById('hint').innerText = `Hint: The number is between ${lowerBound} and ${upperBound}`
}
