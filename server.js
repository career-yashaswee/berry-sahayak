import { WebSocketServer, WebSocket } from 'ws';
import React from 'react';
import { render, Box, Text } from 'ink';
import readline from 'readline';
import os from 'os';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { OLLAMA_MODELS, FALLBACK_MODEL } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const PORT = 8080;
const localIP = getLocalIP();

// Create HTTP server to serve HTML file
const server = http.createServer((req, res) => {
  if (req.url === '/client.html' || req.url === '/') {
    const filePath = path.join(__dirname, 'client.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading client.html');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

let client = null;
let messageList = [];
let status = 'Waiting for connection...';
let isGeneratingQuiz = false;
let addMessageCallback = null;
let updateStatusCallback = null;
let updateLoadingCallback = null;

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

// Update header status
function updateStatus(newStatus) {
  status = newStatus;
  if (updateStatusCallback) {
    updateStatusCallback();
  }
}

// Update loading state
function setGeneratingQuiz(generating) {
  isGeneratingQuiz = generating;
  if (updateLoadingCallback) {
    updateLoadingCallback();
  }
}

// Function to call Ollama API
function generateQuiz(topic) {
  return new Promise((resolve, reject) => {
    const prompt = `Create a quiz question about "${topic}". Format your response as JSON with this exact structure:
{
  "question": "Your question here",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0
}
Where "correct" is the index (0-3) of the correct answer. Return ONLY the JSON, no other text.`;

    // Try API first (port 11434 is default Ollama API port)
    const postData = JSON.stringify({
      model: OLLAMA_MODELS.EDUCATOR_MODEL,
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
          const responseText = response.response || '';
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const quiz = JSON.parse(jsonMatch[0]);
            // Ensure options are strings
            if (quiz.options && Array.isArray(quiz.options)) {
              quiz.options = quiz.options.map(opt => String(opt));
            }
            resolve(quiz);
          } else {
            resolve(createFallbackQuiz(topic));
          }
        } catch (error) {
          tryCommandLine(prompt, topic, resolve, reject);
        }
      });
    });

    req.on('error', () => {
      tryCommandLine(prompt, topic, resolve, reject);
    });

    req.write(postData);
    req.end();
  });
}

// Fallback to command line
function tryCommandLine(prompt, topic, resolve, reject) {
  exec(`ollama run ${FALLBACK_MODEL} "${prompt.replace(/"/g, '\\"')}"`, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      resolve(createFallbackQuiz(topic));
      return;
    }
    
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const quiz = JSON.parse(jsonMatch[0]);
        // Ensure options are strings
        if (quiz.options && Array.isArray(quiz.options)) {
          quiz.options = quiz.options.map(opt => String(opt));
        }
        resolve(quiz);
      } else {
        resolve(createFallbackQuiz(topic));
      }
    } catch (parseError) {
      resolve(createFallbackQuiz(topic));
    }
  });
}

// Create fallback quiz
function createFallbackQuiz(topic) {
  return {
    question: `Quiz: ${topic}`,
    options: [
      `Option A about ${topic}`,
      `Option B about ${topic}`,
      `Option C about ${topic}`,
      `Option D about ${topic}`
    ],
    correct: 0
  };
}

// React App Component
function App() {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => {
    addMessageCallback = () => forceUpdate();
    updateStatusCallback = () => forceUpdate();
    updateLoadingCallback = () => forceUpdate();
    return () => {
      addMessageCallback = null;
      updateStatusCallback = null;
      updateLoadingCallback = null;
    };
  }, []);

  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [spinnerIndex, setSpinnerIndex] = React.useState(0);

  React.useEffect(() => {
    if (isGeneratingQuiz) {
      const interval = setInterval(() => {
        setSpinnerIndex(prev => (prev + 1) % spinnerFrames.length);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isGeneratingQuiz]);

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Box, { backgroundColor: 'blue', paddingX: 1, paddingY: 0 },
      React.createElement(Text, { color: 'white', bold: true },
        `Sahayak - Educator Mode | Server: ${localIP}:${PORT} | Status: ${status}`
      )
    ),
    React.createElement(Box, { flexDirection: 'column', height: 20, borderStyle: 'single', paddingX: 1 },
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
        const isRight = msg.type === 'you'; // Educator messages on right
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
            backgroundColor: isRight ? 'blue' : 'green',
            width: '70%',
            alignSelf: isRight ? 'flex-end' : 'flex-start'
          },
            React.createElement(Text, { color: 'white' },
              isRight ? msg.text : `Learner: ${msg.text}`
            )
          )
        );
      }),
      isGeneratingQuiz ? React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { color: 'cyan' },
          `${spinnerFrames[spinnerIndex]} Generating quiz...`
        )
      ) : null
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'yellow' },
        'Send message | Press Enter to Send | Type /quiz [topic] for quiz'
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

// Handle input submission
rl.on('line', async (line) => {
  const message = line.trim();
  
  if (message) {
    // Check if it's a /quiz command
    if (message.startsWith('/quiz')) {
      const topic = message.substring(5).trim();
      if (!topic) {
        addMessage('Usage: /quiz [topic] - e.g., /quiz Photosynthesis', 'system');
        rl.prompt();
        return;
      }
      
      if (!client || client.readyState !== WebSocket.OPEN) {
        addMessage('No learner connected', 'system');
        rl.prompt();
        return;
      }
      
      setGeneratingQuiz(true);
      addMessage(`Generating quiz: ${topic}...`, 'system');
      
      try {
        const quiz = await generateQuiz(topic);
        setGeneratingQuiz(false);
        client.send(JSON.stringify({ type: 'quiz', data: quiz }));
        addMessage(`Quiz sent: ${quiz.question}`, 'system');
      } catch (error) {
        setGeneratingQuiz(false);
        addMessage(`Error generating quiz: ${error.message}`, 'system');
      }
    } else {
      // Regular message
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'message', data: message }));
        addMessage(message, 'you');
      } else {
        addMessage('No learner connected', 'system');
      }
    }
  }
  
  rl.prompt();
});

// Quit on Control-C
rl.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (client) {
    client.close();
  }
  wss.close();
  server.close();
  rl.close();
  process.exit(0);
});

// Start HTTP server
server.listen(PORT, () => {
  updateStatus('Waiting for connection...');
  addMessage(`Sahayak - Educator Mode | Waiting for learner connection...`, 'system');
});

wss.on('connection', (ws) => {
  client = ws;
  updateStatus('Connected');
  addMessage('Learner connected', 'system');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'message') {
        addMessage(data.data, 'learner');
      } else if (data.type === 'quiz_answer') {
        const answer = data.data;
        addMessage(`Quiz Answer: ${answer.answer}. ${answer.selectedOption}`, 'learner');
      }
    } catch (e) {
      const text = message.toString();
      addMessage(text, 'learner');
    }
  });
  
  ws.on('close', () => {
    updateStatus('Disconnected');
    addMessage('Learner disconnected', 'system');
    client = null;
  });
  
  ws.on('error', (error) => {
    addMessage(`Error: ${error.message}`, 'system');
  });
});

// Render Ink app with proper configuration
render(React.createElement(App), {
  stdout: process.stdout,
  stdin: process.stdin,
  exitOnCtrlC: false,
  patchConsole: false
});

// Start readline prompt
setTimeout(() => {
  rl.prompt();
}, 100);
