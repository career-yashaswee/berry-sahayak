import { WebSocket } from 'ws';
import React from 'react';
import { render, Box, Text } from 'ink';
import readline from 'readline';
import http from 'http';
import { exec } from 'child_process';
import { OLLAMA_MODELS, FALLBACK_MODEL, EDUCATOR_IP } from './constants.js';

// Get educator IP from command line or constants
const educatorIP = process.argv[2] || EDUCATOR_IP;

if (!educatorIP) {
  console.error('Error: Educator IP not configured');
  console.error('');
  console.error('Option 1: Set EDUCATOR_IP in constants.js');
  console.error('Option 2: Pass IP as argument: node client.js <educator-ip>');
  console.error('Example: node client.js 192.168.1.100');
  process.exit(1);
}

const PORT = 8080;
const wsUrl = `ws://${educatorIP}:${PORT}`;

let ws = null;
let messageList = [];
let status = 'Connecting...';
let currentQuiz = null;
let quizHint = null;
let isGeneratingHint = false;
let hintExpanded = false;
let answerFeedback = null;
let addMessageCallback = null;
let updateStatusCallback = null;
let updateQuizCallback = null;
let updateHintCallback = null;

// Function to get relative time
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else {
    return new Date(timestamp).toLocaleTimeString();
  }
}

// Function to add message to display
function addMessage(text, type = 'info') {
  const timestamp = Date.now();
  messageList.push({
    text: text,
    type: type,
    timestamp: timestamp
  });
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
  quizHint = null;
  hintExpanded = false;
  answerFeedback = null;
  if (updateQuizCallback) {
    updateQuizCallback();
  }
  if (updateHintCallback) {
    updateHintCallback();
  }
}

// Toggle hint expansion
function toggleHint() {
  hintExpanded = !hintExpanded;
  if (updateHintCallback) {
    updateHintCallback();
  }
}

// Set answer feedback
function setAnswerFeedback(feedback) {
  answerFeedback = feedback;
  if (updateHintCallback) {
    updateHintCallback();
  }
}

// Set quiz hint
function setQuizHint(hint) {
  quizHint = hint;
  if (updateHintCallback) {
    updateHintCallback();
  }
}

// Set hint generating state
function setGeneratingHint(generating) {
  isGeneratingHint = generating;
  if (updateHintCallback) {
    updateHintCallback();
  }
}

// Generate hint using Ollama
function generateHint(question) {
  return new Promise((resolve, reject) => {
    const prompt = `Question: "${question}"

Provide a Socratic reasoning hint for this question. A Socratic hint should:
- Guide the learner to think through the problem
- Ask leading questions rather than giving direct answers
- Help them reason through the concepts
- Be concise (2-3 sentences)

Provide only the hint, no additional explanation.`;

    // Try API first
    const postData = JSON.stringify({
      model: OLLAMA_MODELS.LEARNER_MODEL,
      prompt: prompt,
      stream: false
    });

    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          const hint = response.response || 'Think about the key concepts in the question.';
          resolve(hint.trim());
        } catch (error) {
          tryCommandLineHint(prompt, resolve, reject);
        }
      });
    });

    req.on('error', () => {
      tryCommandLineHint(prompt, resolve, reject);
    });

    req.write(postData);
    req.end();
  });
}

// Fallback to command line for hint
function tryCommandLineHint(prompt, resolve, reject) {
  exec(`ollama run ${FALLBACK_MODEL} "${prompt.replace(/"/g, '\\"')}"`, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      resolve('Think about the key concepts in the question.');
      return;
    }
    resolve(stdout.trim() || 'Think about the key concepts in the question.');
  });
}

// Hint Component (Collapsible)
function HintComponent({ hint, isGenerating, expanded, onToggle }) {
  if (!hint && !isGenerating) return null;

  return React.createElement(Box, {
    marginY: 1,
    borderStyle: 'single',
    borderColor: 'blue'
  },
    React.createElement(Box, {
      flexDirection: 'row',
      paddingX: 1,
      paddingY: 0.5,
      backgroundColor: 'blue',
      onClick: onToggle
    },
      React.createElement(Text, { color: 'white', bold: true },
        `HINT ${expanded ? '[-]' : '[+]'}`
      )
    ),
    expanded && hint ? React.createElement(Box, {
      paddingX: 1,
      paddingY: 0.5,
      backgroundColor: 'black'
    },
      React.createElement(Text, { color: 'white' },
        hint
      )
    ) : null,
    isGenerating ? React.createElement(Box, {
      paddingX: 1,
      paddingY: 0.5,
      backgroundColor: 'black'
    },
      React.createElement(Text, { color: 'cyan' },
        'Generating hint...'
      )
    ) : null
  );
}

// Quiz Component
function QuizDisplay({ quiz, hint, isGenerating, hintExpanded, onToggleHint, feedback }) {
  if (!quiz) return null;

  return React.createElement(Box, {
    borderStyle: 'round',
    borderColor: 'cyan',
    paddingX: 1,
    paddingY: 1,
    marginY: 1,
    backgroundColor: 'black'
  },
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { color: 'yellow', bold: true },
        `QUIZ: ${quiz.question}`
      )
    ),
    React.createElement(HintComponent, {
      hint: hint,
      isGenerating: isGenerating,
      expanded: hintExpanded,
      onToggle: onToggleHint
    }),
    feedback ? React.createElement(Box, {
      marginY: 1,
      paddingX: 1,
      paddingY: 0.5,
      backgroundColor: feedback.correct ? 'green' : 'red',
      borderStyle: 'single',
      borderColor: feedback.correct ? 'green' : 'red'
    },
      React.createElement(Text, { color: 'white', bold: true },
        feedback.correct ? '✓ Correct!' : '✗ Incorrect'
      ),
      React.createElement(Box, { marginTop: 0.5 },
        React.createElement(Text, { color: 'white' },
          feedback.message
        )
      )
    ) : null,
    React.createElement(Box, { flexDirection: 'column' },
      quiz.options.map((option, i) => {
        const letter = String.fromCharCode(65 + i);
        const optionText = typeof option === 'string' ? option : String(option);
        return React.createElement(Box, { key: i, marginY: 0.5 },
          React.createElement(Text, { color: 'white' },
            `${letter}. ${optionText}`
          )
        );
      })
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'cyan' },
        feedback ? 'Quiz completed!' : hint ? 'Type A, B, C, or D to answer | Type "toggle" to expand/collapse hint' : 'Type A, B, C, or D to answer | Type /hint for a hint'
      )
    )
  );
}

// Reconnect Button Component
function ReconnectButton({ onReconnect }) {
  return React.createElement(Box, {
    marginTop: 1,
    paddingX: 1,
    paddingY: 1,
    backgroundColor: 'red',
    borderStyle: 'round',
    borderColor: 'red'
  },
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { color: 'white', bold: true },
        'Disconnected from Educator'
      )
    ),
    React.createElement(Box,
      React.createElement(Text, { color: 'yellow' },
        'Type "reconnect" and press Enter to reconnect'
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
    updateHintCallback = () => forceUpdate();
    return () => {
      addMessageCallback = null;
      updateStatusCallback = null;
      updateQuizCallback = null;
      updateHintCallback = null;
    };
  }, []);

  const isDisconnected = status === 'Disconnected' || status === 'Error';

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Box, { backgroundColor: isDisconnected ? 'red' : 'green', paddingX: 1, paddingY: 0 },
      React.createElement(Text, { color: 'white', bold: true },
        `Sahayak - Learner Mode | Connected to: ${educatorIP}:${PORT} | Status: ${status}`
      )
    ),
    React.createElement(Box, { flexDirection: 'column', height: currentQuiz ? 15 : 20, borderStyle: 'single', paddingX: 1 },
      messageList.slice(-20).map((msg, i) => {
        if (msg.type === 'system') {
          return React.createElement(Box, { key: i, justifyContent: 'center', marginY: 0.5 },
            React.createElement(Box, {
              paddingX: 1,
              paddingY: 0.5,
              backgroundColor: 'yellow',
              borderStyle: 'single',
              borderColor: 'yellow'
            },
              React.createElement(Text, { color: 'black', bold: true },
                `${msg.text} (${getRelativeTime(msg.timestamp)})`
              )
            )
          );
        }
        const isRight = msg.type === 'you'; // Learner messages on right
        return React.createElement(Box, {
          key: i,
          flexDirection: 'row',
          justifyContent: isRight ? 'flex-end' : 'flex-start',
          marginY: 0.5,
          width: '100%'
        },
          React.createElement(Box, {
            paddingX: 1,
            paddingY: 0.5,
            backgroundColor: isRight ? 'blue' : 'gray',
            width: '70%',
            alignSelf: isRight ? 'flex-end' : 'flex-start'
          },
            React.createElement(Text, { color: 'white' },
              isRight ? msg.text : `Educator: ${msg.text}`
            )
          )
        );
      })
    ),
    currentQuiz ? React.createElement(QuizDisplay, {
      quiz: currentQuiz,
      hint: quizHint,
      isGenerating: isGeneratingHint,
      hintExpanded: hintExpanded,
      onToggleHint: toggleHint,
      feedback: answerFeedback
    }) : null,
    isDisconnected ? React.createElement(ReconnectButton, { onReconnect: connect }) : null,
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: currentQuiz ? 'cyan' : isDisconnected ? 'red' : 'yellow' },
        currentQuiz ? 'Type A, B, C, or D to answer the quiz' : 
        isDisconnected ? 'Type "reconnect" to reconnect to educator' :
        'Type your message and press Enter to send'
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
  // Close existing connection if any
  if (ws) {
    ws.removeAllListeners();
    if (ws.readyState !== WebSocket.CLOSED) {
      ws.close();
    }
    ws = null;
  }

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
          quizHint = null; // Clear previous hint when new quiz arrives
          isGeneratingHint = false; // Clear generating state
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
  const input = line.trim();
  const inputUpper = input.toUpperCase();
  
  if (!input) {
    rl.prompt();
    return;
  }

  // Handle reconnect command
  if (inputUpper === 'RECONNECT' || inputUpper === 'R') {
    if (status === 'Disconnected' || status === 'Error') {
      connect();
      rl.prompt();
      return;
    } else {
      addMessage('Already connected', 'system');
      rl.prompt();
      return;
    }
  }

  // Handle hint command
  if (inputUpper === '/HINT' || inputUpper === 'HINT') {
    if (!currentQuiz) {
      addMessage('No active quiz', 'system');
      rl.prompt();
      return;
    }
    if (quizHint) {
      toggleHint();
      rl.prompt();
      return;
    }
    if (isGeneratingHint) {
      addMessage('Generating hint, please wait...', 'system');
      rl.prompt();
      return;
    }
    
    setGeneratingHint(true);
    generateHint(currentQuiz.question)
      .then(hint => {
        setGeneratingHint(false);
        setQuizHint(hint);
        hintExpanded = true; // Auto-expand when hint is first generated
        if (updateHintCallback) {
          updateHintCallback();
        }
        addMessage('Hint generated', 'system');
      })
      .catch(error => {
        setGeneratingHint(false);
        addMessage(`Error generating hint: ${error.message}`, 'system');
      });
    rl.prompt();
    return;
  }

  // Handle toggle hint command
  if (inputUpper === 'TOGGLE' && currentQuiz && quizHint) {
    toggleHint();
    rl.prompt();
    return;
  }

  // Check if there's an active quiz and user is answering
  if (currentQuiz && (inputUpper === 'A' || inputUpper === 'B' || inputUpper === 'C' || inputUpper === 'D')) {
    if (answerFeedback) {
      addMessage('You have already answered this quiz', 'system');
      rl.prompt();
      return;
    }
    
    const answerIndex = inputUpper.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
    const selectedOption = currentQuiz.options[answerIndex];
    const answerTime = Date.now();
    
    // Send answer to educator with timestamp
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'quiz_answer',
        data: {
          question: currentQuiz.question,
          answer: inputUpper,
          answerIndex: answerIndex,
          selectedOption: selectedOption,
          timestamp: answerTime,
          quizStartTime: currentQuiz.startTime || answerTime
        }
      }));
      
      addMessage(`Answered: ${inputUpper}. ${selectedOption}`, 'you');
      // Don't clear quiz yet - wait for feedback
    } else {
      addMessage('Not connected to educator', 'system');
    }
  } else if (currentQuiz && inputUpper !== 'A' && inputUpper !== 'B' && inputUpper !== 'C' && inputUpper !== 'D' && inputUpper !== '/HINT' && inputUpper !== 'HINT' && inputUpper !== 'TOGGLE') {
    // User typed something else while quiz is active
    addMessage('Please answer the quiz (A, B, C, or D) or type /hint for a hint', 'system');
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

// Render Ink app with proper configuration
render(React.createElement(App), {
  stdout: process.stdout,
  stdin: process.stdin,
  exitOnCtrlC: false,
  patchConsole: false
});

// Start connection
setTimeout(() => {
  connect();
  rl.prompt();
}, 100);

