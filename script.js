// Function to generate a random number within a specified range
function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to start the guessing game
function startGuessingGame() {
  const minNumber = parseInt(prompt("Enter the minimum number:"));
  const maxNumber = parseInt(prompt("Enter the maximum number:"));

  document.getElementById("min-number").textContent = minNumber;
  document.getElementById("max-number").textContent = maxNumber;

  const randomNumber = generateRandomNumber(minNumber, maxNumber);
  let attempts = 0;

  document.getElementById("guess-btn").addEventListener("click", function() {
    const userGuess = parseInt(document.getElementById("guess-input").value);
    attempts++;

    if (isNaN(userGuess) || userGuess < minNumber || userGuess > maxNumber) {
      document.getElementById("result").textContent = "Please enter a valid number within the specified range.";
    } else if (userGuess === randomNumber) {
      document.getElementById("result").textContent = `Congratulations! You guessed the number ${randomNumber} correctly in ${attempts} attempts.`;
    } else if (userGuess < randomNumber) {
      document.getElementById("result").textContent = "Too low! Try again.";
    } else {
      document.getElementById("result").textContent = "Too high! Try again.";
    }
  });
}

// Start the guessing game
startGuessingGame();
