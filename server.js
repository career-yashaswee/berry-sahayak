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
let currentQuiz = null;
let quizStatistics = null;
let showStatistics = false;
let addMessageCallback = null;
let updateStatusCallback = null;
let updateLoadingCallback = null;
let updateStatisticsCallback = null;
let isDoubtActive = false;
let doubtCollection = [];
let topDoubts = null;
let showTopDoubts = false;
let isProcessingDoubts = false;
let doubtCollectionTimeout = null;
let updateDoubtsCallback = null;

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

// Update statistics display
function updateStatisticsDisplay() {
  if (updateStatisticsCallback) {
    updateStatisticsCallback();
  }
}

// Close statistics
function closeStatistics() {
  showStatistics = false;
  updateStatisticsDisplay();
}

// Close top doubts display
function closeTopDoubts() {
  showTopDoubts = false;
  topDoubts = null;
  if (updateDoubtsCallback) {
    updateDoubtsCallback();
  }
}

// Update doubts display
function updateDoubtsDisplay() {
  if (updateDoubtsCallback) {
    updateDoubtsCallback();
  }
}

// Calculate statistics
function calculateStatistics() {
  if (!quizStatistics || !currentQuiz) {
    return {
      totalAnswered: 0,
      averageScore: 0,
      avgResponseTime: 0,
      hintsUsed: 0
    };
  }

  const answers = quizStatistics.answers;
  if (answers.length === 0) {
    return {
      totalAnswered: 0,
      averageScore: 0,
      avgResponseTime: 0,
      hintsUsed: quizStatistics.hintsUsed || 0
    };
  }

  const totalAnswered = answers.length;
  const correctCount = answers.filter(a => a.isCorrect).length;
  const averageScore = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;
  
  const responseTimes = answers.map(a => a.responseTime).filter(t => t > 0);
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
    : 0;

  return {
    totalAnswered,
    averageScore: Math.round(averageScore * 10) / 10,
    avgResponseTime: Math.round(avgResponseTime / 1000 * 10) / 10, // Convert to seconds, round to 1 decimal
    hintsUsed: quizStatistics.hintsUsed || 0
  };
}

// Function to call Ollama API
function generateQuiz(topic) {
  return new Promise((resolve, reject) => {
    const prompt = `Create a quiz question about "${topic}". Format your response as JSON with this exact structure:
{
  "question": "Your question here",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0,1,2,3
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

// Process and summarize doubts using AI
function processDoubts(doubts) {
  return new Promise((resolve, reject) => {
    if (doubts.length === 0) {
      resolve([]);
      return;
    }

    const doubtsList = doubts.map((d, i) => `${i + 1}. ${d.text}`).join('\n');
    const prompt = `You are analyzing student doubts from a classroom. Below are the doubts submitted by students:

${doubtsList}

Your task:
1. Analyze and understand each doubt
2. Identify the most critical/common concerns
3. Summarize and group similar doubts
4. Return the top 3 most critical doubts that need immediate attention

Format your response as JSON with this exact structure:
{
  "topDoubts": [
    {
      "summary": "Brief summary of the critical doubt",
      "count": number of students with similar concern,
      "details": "More detailed explanation"
    },
    {
      "summary": "Second critical doubt",
      "count": number,
      "details": "Details"
    },
    {
      "summary": "Third critical doubt",
      "count": number,
      "details": "Details"
    }
  ]
}

Return ONLY the JSON, no other text. If there are fewer than 3 unique critical doubts, return fewer items.`;

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
            const result = JSON.parse(jsonMatch[0]);
            resolve(result.topDoubts || []);
          } else {
            // Fallback: create simple summaries
            resolve(createFallbackDoubts(doubts));
          }
        } catch (error) {
          tryCommandLineDoubts(prompt, doubts, resolve, reject);
        }
      });
    });

    req.on('error', () => {
      tryCommandLineDoubts(prompt, doubts, resolve, reject);
    });

    req.write(postData);
    req.end();
  });
}

// Fallback to command line for doubt processing
function tryCommandLineDoubts(prompt, doubts, resolve, reject) {
  exec(`ollama run ${FALLBACK_MODEL} "${prompt.replace(/"/g, '\\"')}"`, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      resolve(createFallbackDoubts(doubts));
      return;
    }
    
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        resolve(result.topDoubts || []);
      } else {
        resolve(createFallbackDoubts(doubts));
      }
    } catch (parseError) {
      resolve(createFallbackDoubts(doubts));
    }
  });
}

// Create fallback doubts summary
function createFallbackDoubts(doubts) {
  if (doubts.length === 0) return [];
  
  // Simple grouping by first few words
  const grouped = {};
  doubts.forEach(d => {
    const key = d.text.substring(0, 30).toLowerCase();
    if (!grouped[key]) {
      grouped[key] = { text: d.text, count: 0 };
    }
    grouped[key].count++;
  });

  const sorted = Object.values(grouped)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return sorted.map((item, i) => ({
    summary: item.text.substring(0, 50) + (item.text.length > 50 ? '...' : ''),
    count: item.count,
    details: item.text
  }));
}

// React App Component
// Statistics Component
function StatisticsComponent({ stats, onClose }) {
  return React.createElement(Box, {
    marginY: 1,
    borderStyle: 'round',
    borderColor: 'green',
    paddingX: 1,
    paddingY: 1,
    backgroundColor: 'black'
  },
    React.createElement(Box, {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 1
    },
      React.createElement(Text, { color: 'green', bold: true },
        'CLASS STATISTICS'
      ),
      React.createElement(Text, { color: 'yellow' },
        'Type "close stats" to close'
      )
    ),
    React.createElement(Box, { marginY: 1 },
      React.createElement(Text, { color: 'cyan', bold: true },
        `Total Students Answered: ${stats.totalAnswered}`
      )
    ),
    React.createElement(Box, { marginY: 1 },
      React.createElement(Text, { color: 'cyan', bold: true },
        `Class Average: ${stats.averageScore}%`
      )
    ),
    React.createElement(Box, { marginY: 1 },
      React.createElement(Text, { color: 'cyan', bold: true },
        `Average Response Time: ${stats.avgResponseTime}s`
      )
    ),
    React.createElement(Box, { marginY: 1 },
      React.createElement(Text, { color: 'cyan', bold: true },
        `Hints Used: ${stats.hintsUsed}`
      )
    )
  );
}

// Top Doubts Component
function TopDoubtsComponent({ doubts, onClose, isProcessing, spinnerIndex }) {
  if (isProcessing) {
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    return React.createElement(Box, {
      marginY: 1,
      borderStyle: 'round',
      borderColor: 'magenta',
      paddingX: 1,
      paddingY: 1,
      backgroundColor: 'black'
    },
      React.createElement(Box, {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 1
      },
        React.createElement(Text, { color: 'magenta', bold: true },
          'PROCESSING DOUBTS'
        )
      ),
      React.createElement(Box, { marginY: 1 },
        React.createElement(Text, { color: 'cyan' },
          `${spinnerFrames[spinnerIndex || 0]} Filtering and summarizing doubts...`
        )
      ),
      React.createElement(Box, { marginY: 0.5 },
        React.createElement(Text, { color: 'white' },
          'AI is analyzing and identifying the top 3 critical doubts'
        )
      )
    );
  }

  if (!doubts || doubts.length === 0) {
    return null;
  }

  return React.createElement(Box, {
    marginY: 1,
    borderStyle: 'round',
    borderColor: 'magenta',
    paddingX: 1,
    paddingY: 1,
    backgroundColor: 'black'
  },
    React.createElement(Box, {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 1
    },
      React.createElement(Text, { color: 'magenta', bold: true },
        'TOP 3 CRITICAL DOUBTS'
      ),
      React.createElement(Text, { color: 'yellow' },
        'Type "close doubts" to close'
      )
    ),
    doubts.map((doubt, i) => {
      return React.createElement(Box, {
        key: i,
        marginY: 1,
        paddingX: 1,
        paddingY: 0.5,
        borderStyle: 'single',
        borderColor: 'magenta'
      },
        React.createElement(Box, { marginBottom: 0.5 },
          React.createElement(Text, { color: 'yellow', bold: true },
            `${i + 1}. ${doubt.summary} (${doubt.count} student${doubt.count !== 1 ? 's' : ''})`
          )
        ),
        React.createElement(Box,
          React.createElement(Text, { color: 'white' },
            doubt.details
          )
        )
      );
    })
  );
}

function App() {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => {
    addMessageCallback = () => forceUpdate();
    updateStatusCallback = () => forceUpdate();
    updateLoadingCallback = () => forceUpdate();
    updateStatisticsCallback = () => forceUpdate();
    updateDoubtsCallback = () => forceUpdate();
    return () => {
      addMessageCallback = null;
      updateStatusCallback = null;
      updateLoadingCallback = null;
      updateStatisticsCallback = null;
      updateDoubtsCallback = null;
    };
  }, []);

  const stats = showStatistics ? calculateStatistics() : null;
  
  // Force re-render when statistics change
  React.useEffect(() => {
    if (showStatistics && updateStatisticsCallback) {
      const interval = setInterval(() => {
        if (updateStatisticsCallback) {
          updateStatisticsCallback();
        }
      }, 1000); // Update every second
      return () => clearInterval(interval);
    }
  }, [showStatistics]);

  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [spinnerIndex, setSpinnerIndex] = React.useState(0);
  const [doubtSpinnerIndex, setDoubtSpinnerIndex] = React.useState(0);

  React.useEffect(() => {
    if (isGeneratingQuiz) {
      const interval = setInterval(() => {
        setSpinnerIndex(prev => (prev + 1) % spinnerFrames.length);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isGeneratingQuiz]);

  React.useEffect(() => {
    if (isProcessingDoubts) {
      const interval = setInterval(() => {
        setDoubtSpinnerIndex(prev => (prev + 1) % spinnerFrames.length);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isProcessingDoubts]);

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
    showStatistics ? React.createElement(StatisticsComponent, {
      stats: stats,
      onClose: closeStatistics
    }) : null,
    showTopDoubts ? React.createElement(TopDoubtsComponent, {
      doubts: topDoubts,
      onClose: closeTopDoubts,
      isProcessing: isProcessingDoubts,
      spinnerIndex: doubtSpinnerIndex
    }) : null,
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'yellow' },
        'Send message | Press Enter to Send | Type /quiz [topic] for quiz | Type /doubt to collect doubts | Type "close stats" to close statistics | Type "close doubts" to close doubts'
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
    // Check if it's a close stats command
    if (message.toLowerCase() === 'close stats' || message.toLowerCase() === '/close stats') {
      closeStatistics();
      rl.prompt();
      return;
    }
    
    // Check if it's a close doubts command
    if (message.toLowerCase() === 'close doubts' || message.toLowerCase() === '/close doubts') {
      closeTopDoubts();
      rl.prompt();
      return;
    }
    
    // Check if it's a /doubt command
    if (message.startsWith('/doubt')) {
      if (!client || client.readyState !== WebSocket.OPEN) {
        addMessage('No learner connected', 'system');
        rl.prompt();
        return;
      }
      
      // Initialize doubt collection
      isDoubtActive = true;
      doubtCollection = [];
      topDoubts = null;
      showTopDoubts = false;
      
      // Send doubt request to learner
      client.send(JSON.stringify({ type: 'doubt', data: { active: true } }));
      addMessage('Doubt collection started. Waiting for learner submissions...', 'system');
      
      // Set timeout to process doubts after 2 minutes
      if (doubtCollectionTimeout) {
        clearTimeout(doubtCollectionTimeout);
      }
      doubtCollectionTimeout = setTimeout(async () => {
        if (doubtCollection.length > 0) {
          await processAndDisplayDoubts();
        } else {
          addMessage('No doubts received from learners', 'system');
          isDoubtActive = false;
        }
      }, 120000); // 2 minutes timeout
      
      rl.prompt();
      return;
    }
    
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
        // Initialize quiz statistics
        currentQuiz = quiz;
        quizStatistics = {
          answers: [],
          hintsUsed: 0,
          startTime: Date.now()
        };
        showStatistics = true;
        updateStatisticsDisplay();
        // Add start time to quiz for response time calculation
        quiz.startTime = quizStatistics.startTime;
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
      } else if (data.type === 'doubt_submission') {
        const doubt = data.data;
        
        if (!isDoubtActive) {
          addMessage('Doubt collection not active. Teacher must send /doubt command first.', 'system');
          return;
        }
        
        // Add doubt to collection
        doubtCollection.push({
          text: doubt.text,
          timestamp: doubt.timestamp || Date.now()
        });
        
        addMessage(`Doubt received: ${doubt.text.substring(0, 50)}${doubt.text.length > 50 ? '...' : ''}`, 'system');
        
        // Reset timeout to 2 minutes after last submission
        if (doubtCollectionTimeout) {
          clearTimeout(doubtCollectionTimeout);
        }
        doubtCollectionTimeout = setTimeout(async () => {
          if (doubtCollection.length > 0) {
            await processAndDisplayDoubts();
          }
        }, 120000); // 2 minutes after last submission
      } else if (data.type === 'quiz_answer') {
        const answer = data.data;
        
        // Check if there's an active quiz
        if (!currentQuiz || !quizStatistics) {
          addMessage('No active quiz', 'system');
          return;
        }
        
        // Check if answer is correct
        const isCorrect = answer.answerIndex === currentQuiz.correct;
        
        // Calculate response time
        const responseTime = answer.timestamp - (answer.quizStartTime || quizStatistics.startTime);
        
        // Update statistics
        quizStatistics.answers.push({
          answer: answer.answer,
          answerIndex: answer.answerIndex,
          isCorrect: isCorrect,
          responseTime: responseTime,
          timestamp: answer.timestamp,
          hintsUsed: answer.hintsUsed || 0
        });
        
        // Update statistics display
        updateStatisticsDisplay();
      } else if (data.type === 'hint_request') {
        // Track hint usage
        if (quizStatistics && currentQuiz) {
          quizStatistics.hintsUsed = (quizStatistics.hintsUsed || 0) + 1;
          updateStatisticsDisplay();
        }
        
        // Send feedback to learner
        const correctOption = String.fromCharCode(65 + currentQuiz.correct); // A, B, C, or D
        const correctText = currentQuiz.options[currentQuiz.correct];
        const isCorrect = answer.answerIndex === currentQuiz.correct;
        
        ws.send(JSON.stringify({
          type: 'quiz_feedback',
          data: {
            correct: isCorrect,
            message: isCorrect 
              ? 'Correct answer!' 
              : `Wrong answer. The correct answer is ${correctOption}. ${correctText}`
          }
        }));
        
        // Show message on educator side
        addMessage(`Quiz Answer: ${answer.answer}. ${answer.selectedOption} - ${isCorrect ? 'CORRECT' : 'WRONG'}`, 'learner');
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

// Process and display doubts
async function processAndDisplayDoubts() {
  if (doubtCollection.length === 0) {
    isDoubtActive = false;
    return;
  }
  
  isDoubtActive = false;
  isProcessingDoubts = true;
  showTopDoubts = true; // Show component immediately with loading state
  topDoubts = null; // Clear previous results
  updateDoubtsDisplay();
  
  addMessage(`Processing ${doubtCollection.length} doubt(s)...`, 'system');
  
  try {
    const processed = await processDoubts(doubtCollection);
    topDoubts = processed;
    showTopDoubts = true;
    isProcessingDoubts = false;
    updateDoubtsDisplay();
    addMessage(`Top ${Math.min(3, processed.length)} critical doubts identified`, 'system');
  } catch (error) {
    isProcessingDoubts = false;
    addMessage(`Error processing doubts: ${error.message}`, 'system');
    updateDoubtsDisplay();
  }
  
  // Clear timeout
  if (doubtCollectionTimeout) {
    clearTimeout(doubtCollectionTimeout);
    doubtCollectionTimeout = null;
  }
}

// Start readline prompt
setTimeout(() => {
  rl.prompt();
}, 100);
