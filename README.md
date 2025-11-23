# Sahayak

Sahayak is a terminal-based educational communication platform that enables real-time interaction between educators and learners on the same local network.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the educator server:
```bash
npm start
```

The server will display your local IP address and port.

## Usage

## Usage

1. **Start the educator server:**
   ```bash
   npm start
   ```
   The server will display your local IP address (e.g., `192.168.1.100`).

2. **Connect as learner:**
   ```bash
   node client.js [EDUCATOR_IP]
   # Example: node client.js 192.168.1.100
   ```
   Or use the npm script:
   ```bash
   npm run client [EDUCATOR_IP]
   ```

3. **Start messaging:**
   - Educator: Type messages in terminal and press Enter
   - Learner: Type messages in terminal and press Enter
   - Use `/quiz [topic]` command on educator side to generate quizzes

## Files

- `server.js` - WebSocket server with terminal interface (Educator)
- `client.js` - Terminal client interface (Learner)
- `package.json` - Project dependencies
