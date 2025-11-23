# berry-sahayak

Simple WebSocket communication between devices on the same local network.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server on your MacBook:
```bash
npm start
```

The server will display your local IP address and port.

## Usage

### Terminal Client (Recommended)

1. **Start the server (Teacher):**
   ```bash
   npm start
   ```
   The server will display your local IP address (e.g., `192.168.1.100`).

2. **Connect as student:**
   ```bash
   node client.js [TEACHER_IP]
   # Example: node client.js 192.168.1.100
   ```
   Or use the npm script:
   ```bash
   npm run client [TEACHER_IP]
   ```

3. **Start messaging:**
   - Teacher: Type messages in terminal and press Enter
   - Student: Type messages in terminal and press Enter
   - Use `/quiz [topic]` command on teacher side to generate quizzes

### Web Browser Client (Alternative)

1. On your mobile device (connected to the same Wi-Fi network), open a browser and go to:
   ```
   http://[YOUR_MACBOOK_IP]:8080/client.html
   ```
   Replace `[YOUR_MACBOOK_IP]` with the IP shown in the terminal.

2. Enter the MacBook's IP address in the input field and click "Connect".

3. Start messaging:
   - On MacBook: Type messages in the terminal and press Enter
   - On Mobile: Type messages in the input field and press Send

## Files

- `server.js` - WebSocket server with terminal interface (Teacher)
- `client.js` - Terminal client interface (Student)
- `client.html` - Simple HTML client for mobile browser (Alternative)
- `package.json` - Project dependencies
