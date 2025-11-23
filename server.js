const WebSocket = require('ws');
const blessed = require('blessed');
const os = require('os');
const http = require('http');
const fs = require('fs');
const path = require('path');

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
const wss = new WebSocket.Server({ server });

let client = null;

// Create blessed screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'WebSocket Chat',
  fullUnicode: false,
  fastCSR: true,
  dockBorders: false
});

// Header box
const header = blessed.box({
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: `Server: ${localIP}:${PORT} | Status: Waiting...`,
  style: {
    fg: 'white',
    bg: 'blue',
    bold: true
  }
});

// Messages log
const messages = blessed.log({
  top: 3,
  left: 0,
  width: '100%',
  height: '100%-7',
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: ' ',
    inverse: true
  },
  style: {
    fg: 'white',
    bg: 'black'
  },
  keys: false,
  mouse: true
});

// Input label
const inputLabel = blessed.box({
  bottom: 3,
  left: 0,
  width: '100%',
  height: 1,
  content: 'Send message | Press Enter to Send',
  style: {
    fg: 'yellow',
    bg: 'black',
    bold: true
  }
});

// Input box
const input = blessed.textbox({
  bottom: 0,
  left: 0,
  width: '100%',
  height: 3,
  inputOnFocus: true,
  style: {
    fg: 'black',
    bg: 'white',
    focus: {
      fg: 'black',
      bg: 'white'
    }
  },
  keys: true,
  mouse: true
});

// Append boxes to screen
screen.append(header);
screen.append(messages);
screen.append(inputLabel);
screen.append(input);

// Function to add message to display
function addMessage(text, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  let prefix = '';
  
  if (type === 'mobile') {
    prefix = 'Mobile';
  } else if (type === 'you') {
    prefix = 'You';
  } else if (type === 'system') {
    prefix = 'System';
  }
  
  const message = `[${timestamp}] ${prefix}: ${text}`;
  messages.log(message);
  input.focus();
  screen.render();
}

// Update header status
function updateStatus(status) {
  header.setContent(`Server: ${localIP}:${PORT} | Status: ${status}`);
  screen.render();
}

// Input handler
input.on('submit', (value) => {
  const message = value ? value.trim() : '';
  if (message) {
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(message);
      addMessage(message, 'you');
      input.clearValue();
      input.focus();
    } else {
      addMessage('No client connected', 'system');
      input.clearValue();
      input.focus();
    }
  } else {
    input.clearValue();
    input.focus();
  }
});

// Quit on Escape, q, or Control-C
screen.key(['escape', 'q', 'C-c'], () => {
  if (client) {
    client.close();
  }
  wss.close();
  server.close();
  return process.exit(0);
});

// Start HTTP server
server.listen(PORT, () => {
  updateStatus('Waiting for connection...');
  addMessage(`Connect from mobile: http://${localIP}:${PORT}/client.html`, 'system');
});

wss.on('connection', (ws) => {
  client = ws;
  updateStatus('Connected');
  addMessage('Client connected', 'system');
  
  ws.on('message', (message) => {
    const text = message.toString();
    addMessage(text, 'mobile');
  });
  
  ws.on('close', () => {
    updateStatus('Disconnected');
    addMessage('Client disconnected', 'system');
    client = null;
  });
  
  ws.on('error', (error) => {
    addMessage(`Error: ${error.message}`, 'system');
  });
});

// Focus input initially
input.focus();

// Render screen
screen.render();

