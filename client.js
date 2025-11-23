import { WebSocket } from 'ws';
import React from 'react';
import { render, Box, Text } from 'ink';
import readline from 'readline';

// Get educator IP from command line
const educatorIP = process.argv[2];

if (!educatorIP) {
  console.error('Usage: node client.js <educator-ip>');
  console.error('Example: node client.js 192.168.1.100');
  process.exit(1);
}

const PORT = 8080;
const wsUrl = `ws://${educatorIP}:${PORT}`;

let ws = null;
let messageList = [];
let status = 'Connecting...';
let currentQuiz = null;
let addMessageCallback = null;
let updateStatusCallback = null;
let updateQuizCallback = null;

// Function to add message to display
function addMessage(text, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  let prefix = '';
  
  if (type === 'educator') {
    prefix = 'Educator';
  } else if (type === 'you') {
    prefix = 'Learner';
  } else if (type === 'system') {
    prefix = 'System';
  }
  
  const message = `[${timestamp}] ${prefix}: ${text}`;
  messageList.push(message);
  if (addMessageCallback) {
    addMessageCallback();
  }
}

// Update status
function updateStatus(newStatus) {
  status = newStatus;
  if (updateStatusCallback) {
    updateStatusCallback();
  }
}

// Set current quiz
function setQuiz(quiz) {
  currentQuiz = quiz;
  if (updateQuizCallback) {
    updateQuizCallback();
  }
}

// Clear quiz
function clearQuiz() {
  currentQuiz = null;
  if (updateQuizCallback) {
    updateQuizCallback();
  }
}

// Quiz Component
function QuizDisplay({ quiz }) {
  if (!quiz) return null;

  return React.createElement(Box, {
    borderStyle: 'round',
    borderColor: 'cyan',
    paddingX: 2,
    paddingY: 1,
    marginY: 1,
    backgroundColor: 'black'
  },
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { color: 'cyan', bold: true },
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
    ),
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { color: 'yellow', bold: true },
        `📝 QUIZ: ${quiz.question}`
      )
    ),
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { color: 'cyan', bold: true },
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
    ),
    quiz.options.map((option, i) => {
      const letter = String.fromCharCode(65 + i);
      const optionText = typeof option === 'string' ? option : String(option);
      return React.createElement(Box, { key: i, marginY: 0.5 },
        React.createElement(Text, { color: 'white' },
          `${letter}. ${optionText}`
        )
      );
    }),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'green', bold: true },
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'yellow' },
        'Type A, B, C, or D to answer'
      )
    )
  );
}

// React App Component
function App() {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => {
    addMessageCallback = () => forceUpdate();
    updateStatusCallback = () => forceUpdate();
    updateQuizCallback = () => forceUpdate();
    return () => {
      addMessageCallback = null;
      updateStatusCallback = null;
      updateQuizCallback = null;
    };
  }, []);

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Box, { backgroundColor: 'green', paddingX: 1, paddingY: 0 },
      React.createElement(Text, { color: 'white', bold: true },
        `Sahayak - Learner Mode | Connected to: ${educatorIP}:${PORT} | Status: ${status}`
      )
    ),
    React.createElement(Box, { flexDirection: 'column', height: currentQuiz ? 15 : 20, borderStyle: 'single', paddingX: 1 },
      messageList.slice(-20).map((msg, i) =>
        React.createElement(Text, { key: i }, msg)
      )
    ),
    currentQuiz ? React.createElement(QuizDisplay, { quiz: currentQuiz }) : null,
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: currentQuiz ? 'cyan' : 'yellow' },
        currentQuiz ? 'Type A, B, C, or D to answer the quiz' : 'Type your message and press Enter to send'
      )
    )
  );
}

// Setup readline for input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

// Connect to WebSocket server
function connect() {
  updateStatus('Connecting...');
  addMessage(`Connecting to educator at ${educatorIP}:${PORT}...`, 'system');

  try {
    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      updateStatus('Connected');
      addMessage('Connected to educator!', 'system');
      rl.prompt();
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'message') {
          addMessage(message.data, 'educator');
        } else if (message.type === 'quiz') {
          // Display quiz in special component
          setQuiz(message.data);
          addMessage('New quiz received!', 'system');
        }
      } catch (e) {
        // Legacy: plain text message
        addMessage(data.toString(), 'educator');
      }
    });

    ws.on('close', () => {
      updateStatus('Disconnected');
      addMessage('Disconnected from educator', 'system');
    });

    ws.on('error', (error) => {
      updateStatus('Error');
      addMessage(`Connection error: ${error.message}`, 'system');
    });
  } catch (error) {
    updateStatus('Error');
    addMessage(`Failed to connect: ${error.message}`, 'system');
  }
}

// Handle input submission
rl.on('line', (line) => {
  const input = line.trim().toUpperCase();
  
  if (!input) {
    rl.prompt();
    return;
  }

  // Check if there's an active quiz and user is answering
  if (currentQuiz && (input === 'A' || input === 'B' || input === 'C' || input === 'D')) {
    const answerIndex = input.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
    const selectedOption = currentQuiz.options[answerIndex];
    
    // Send answer to educator
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'quiz_answer',
        data: {
          question: currentQuiz.question,
          answer: input,
          answerIndex: answerIndex,
          selectedOption: selectedOption
        }
      }));
      
      addMessage(`Answered: ${input}. ${selectedOption}`, 'you');
      clearQuiz();
    } else {
      addMessage('Not connected to educator', 'system');
    }
  } else if (currentQuiz && input !== 'A' && input !== 'B' && input !== 'C' && input !== 'D') {
    // User typed something else while quiz is active
    addMessage('Please answer the quiz first (A, B, C, or D)', 'system');
  } else {
    // Regular message
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', data: input }));
      addMessage(input, 'you');
    } else {
      addMessage('Not connected to educator', 'system');
    }
  }
  
  rl.prompt();
});

// Quit on Control-C
rl.on('SIGINT', () => {
  console.log('\nDisconnecting...');
  if (ws) {
    ws.close();
  }
  rl.close();
  process.exit(0);
});

// Render Ink app
render(React.createElement(App));

// Start connection
setTimeout(() => {
  connect();
  rl.prompt();
}, 100);

