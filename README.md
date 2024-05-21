# Number Guessing Game

This is a simple number guessing game where the player has to guess a random number within a specified range.

## How to Play

1. Open the `guessGame.html` file in a web browser.
2. Select a difficulty level (Easy, Medium, Hard) to define the range within which the random number will be generated.
3. Guess a number within the specified range and click the "Guess" button.
4. Receive feedback on whether your guess is too low, too high, or correct.
5. Continue guessing until you guess the correct number.
6. The game progresses to the next level, doubling the range and increasing the difficulty.

## Features

- Difficulty levels: Easy (1-10), Medium (1-100), Hard (1-1000)
- Score and level tracking
- Timer that starts on the first guess
- Hint system after a certain number of attempts
- Progressive difficulty with increasing levels

## Files

- `guessGame.html`: HTML file containing the user interface for the game.
- `styles.css`: CSS file for styling the game interface.
- `guessGame.js`: JavaScript file containing the game logic.
- `server.js`: Node.js server file to serve the game.

## How to Run

1. Ensure you have Node.js installed.
2. Navigate to the project directory and run:
    ```bash
    npm install
    node server.js
    ```
3. Open your web browser and go to `http://localhost:3000` to start playing the game.
<br><br>
