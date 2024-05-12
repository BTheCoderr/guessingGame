const board = document.querySelector('.board');
const cells = [];
let currentPlayer = 'X';
let gameActive = true;

// Create the cells
for (let i = 0; i < 9; i++) {
  const cell = document.createElement('div');
  cell.classList.add('cell');
  cell.dataset.index = i;
  cell.addEventListener('click', handleCellClick);
  cells.push(cell);
  board.appendChild(cell);
}

// Function to handle cell click
function handleCellClick() {
  const cellIndex = parseInt(this.dataset.index);
  if (!gameActive || cells[cellIndex].textContent !== '') return;
  cells[cellIndex].textContent = currentPlayer;
  if (checkWin() || checkDraw()) {
    gameActive = false;
    return;
  }
  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
}

// Function to check if there's a winner
function checkWin() {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
  ];
  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (cells[a].textContent && cells[a].textContent === cells[b].textContent && cells[a].textContent === cells[c].textContent) {
      highlightWin(pattern);
      alert(`${currentPlayer} wins!`);
      return true;
    }
  }
  return false;
}

// Function to check if it's a draw
function checkDraw() {
  if (cells.every(cell => cell.textContent !== '')) {
    alert('It\'s a draw!');
    return true;
  }
  return false;
}

// Function to highlight the winning cells
function highlightWin(pattern) {
  for (const index of pattern) {
    cells[index].style.backgroundColor = 'lightgreen';
  }
}
