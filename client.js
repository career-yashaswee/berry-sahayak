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
let addMessageCallback = null;
let updateStatusCallback = null;

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

// React App Component
function App() {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => {
    addMessageCallback = () => forceUpdate();
    updateStatusCallback = () => forceUpdate();
    return () => {
      addMessageCallback = null;
      updateStatusCallback = null;
    };
  }, []);

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Box, { backgroundColor: 'green', paddingX: 1, paddingY: 0 },
      React.createElement(Text, { color: 'white', bold: true },
        `Sahayak - Learner Mode | Connected to: ${educatorIP}:${PORT} | Status: ${status}`
      )
    ),
    React.createElement(Box, { flexDirection: 'column', height: 20, borderStyle: 'single', paddingX: 1 },
      messageList.slice(-20).map((msg, i) =>
        React.createElement(Text, { key: i }, msg)
      )
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'yellow' },
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
          // For now, just show quiz as message - will implement quiz UI later
          addMessage(`Quiz: ${message.data.question}`, 'educator');
          message.data.options.forEach((opt, i) => {
            addMessage(`  ${String.fromCharCode(65 + i)}. ${opt}`, 'educator');
          });
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
  const message = line.trim();
  
  if (message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', data: message }));
      addMessage(message, 'you');
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

