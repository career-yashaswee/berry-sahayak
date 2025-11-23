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

- `server.js` - WebSocket server with terminal interface
- `client.html` - Simple HTML client for mobile browser
- `package.json` - Project dependencies
