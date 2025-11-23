# Ink

Ink is a React renderer for building command-line interfaces. It brings the familiar React component model to terminal applications, allowing developers to create interactive CLIs using JSX, hooks, and the same declarative patterns used in web development. Ink leverages Yoga for Flexbox-based layouts, making it possible to build sophisticated terminal UIs with CSS-like properties.

The library provides a complete set of components and hooks for rendering text, handling user input, managing focus, and controlling application lifecycle. Whether building a simple progress indicator or a complex interactive CLI tool, Ink offers the same component-based architecture that React developers already know, adapted specifically for terminal environments.

## Core Rendering

### render() - Mount and display a React component in the terminal

The main entry point for Ink applications. Renders a React component tree to stdout and returns an instance handle with methods to control the application lifecycle. Supports configuration for streams, console patching, screen readers, and rendering performance.

```javascript
import React, {useState, useEffect} from 'react';
import {render, Text, Box} from 'ink';

function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green">Counter: {count}</Text>
      <Text dimColor>Press Ctrl+C to exit</Text>
    </Box>
  );
}

// Basic rendering
const instance = render(<App />);

// Custom configuration
const customInstance = render(<App />, {
  stdout: process.stdout,
  stdin: process.stdin,
  stderr: process.stderr,
  exitOnCtrlC: true,
  patchConsole: true,
  debug: false,
  maxFps: 30,
  isScreenReaderEnabled: false
});

// Control lifecycle
await customInstance.waitUntilExit();
customInstance.unmount();
customInstance.clear();
```

## Components

### Text - Display styled text in the terminal

The fundamental component for rendering text with colors, formatting, and text wrapping behavior. All text output must be wrapped in a Text component. Supports chalk color names, hex codes, and RGB values for both foreground and background colors.

```javascript
import {render, Text} from 'ink';

function StyledText() {
  return (
    <>
      <Text color="green">Success message</Text>
      <Text color="#FF5733">Custom hex color</Text>
      <Text color="rgb(255, 87, 51)">RGB color</Text>
      <Text backgroundColor="blue" color="white">With background</Text>
      <Text bold>Bold text</Text>
      <Text italic>Italic text</Text>
      <Text underline>Underlined text</Text>
      <Text strikethrough>Strikethrough text</Text>
      <Text dimColor>Dimmed text</Text>
      <Text inverse>Inverted colors</Text>
      <Text wrap="truncate">This text will be truncated if too long...</Text>
      <Text wrap="truncate-middle">This will truncate in the middle</Text>
      <Text aria-label="Loading indicator">...</Text>
    </>
  );
}

render(<StyledText />);
```

### Box - Layout container with Flexbox support

The essential layout component providing Flexbox properties, dimensions, padding, margin, borders, and backgrounds. All layout in Ink is Flexbox-based, similar to CSS in browsers. Supports percentage-based widths and heights relative to parent containers.

```javascript
import {render, Box, Text} from 'ink';

function Layout() {
  return (
    <Box flexDirection="column" width="100%" height={20}>
      {/* Header with border */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        padding={1}
        marginBottom={1}
      >
        <Text bold>Application Header</Text>
      </Box>

      {/* Main content area */}
      <Box flexGrow={1} flexDirection="row" gap={2}>
        <Box
          width="30%"
          borderStyle="single"
          padding={1}
          backgroundColor="blue"
        >
          <Text>Sidebar</Text>
        </Box>

        <Box
          flexGrow={1}
          borderStyle="single"
          padding={1}
          justifyContent="center"
          alignItems="center"
        >
          <Text>Main Content</Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        marginTop={1}
        paddingX={2}
        paddingY={1}
        backgroundColor="#333333"
      >
        <Text color="white">Footer</Text>
      </Box>
    </Box>
  );
}

render(<Layout />);
```

### Static - Render permanent output above dynamic content

Permanently renders items above all other output. Ideal for displaying completed tasks, logs, or historical data that shouldn't change. Only new items trigger re-renders; modifications to existing items are ignored.

```javascript
import React, {useState, useEffect} from 'react';
import {render, Static, Box, Text} from 'ink';

function TaskRunner() {
  const [completedTasks, setCompletedTasks] = useState([]);
  const [runningTask, setRunningTask] = useState(0);

  useEffect(() => {
    if (runningTask >= 10) return;

    const timer = setTimeout(() => {
      setCompletedTasks(prev => [
        ...prev,
        {
          id: prev.length,
          name: `Task #${prev.length + 1}`,
          duration: Math.floor(Math.random() * 1000)
        }
      ]);
      setRunningTask(prev => prev + 1);
    }, 500);

    return () => clearTimeout(timer);
  }, [runningTask]);

  return (
    <>
      <Static items={completedTasks} style={{marginBottom: 1}}>
        {(task, index) => (
          <Box key={task.id}>
            <Text color="green">✓ </Text>
            <Text>{task.name}</Text>
            <Text dimColor> ({task.duration}ms)</Text>
          </Box>
        )}
      </Static>

      <Box>
        <Text>
          {runningTask < 10 ? (
            <Text color="blue">⠋ Running task {runningTask + 1}...</Text>
          ) : (
            <Text color="green" bold>All tasks completed!</Text>
          )}
        </Text>
      </Box>
    </>
  );
}

render(<TaskRunner />);
```

### Spacer - Flexible space between elements

A flex-grow component that fills available space along the main axis, pushing elements apart. Essential for creating responsive layouts where elements need to be positioned at opposite ends.

```javascript
import {render, Box, Text, Spacer} from 'ink';

function Dashboard() {
  return (
    <Box flexDirection="column" padding={1}>
      {/* Horizontal spacing */}
      <Box>
        <Text>Left content</Text>
        <Spacer />
        <Text>Right content</Text>
      </Box>

      {/* Vertical spacing */}
      <Box flexDirection="column" height={10}>
        <Text>Top</Text>
        <Spacer />
        <Text>Bottom</Text>
      </Box>
    </Box>
  );
}

render(<Dashboard />);
```

### Newline - Insert line breaks in text

Adds newline characters within Text components. Accepts a count prop for multiple newlines.

```javascript
import {render, Text, Newline} from 'ink';

function MultilineText() {
  return (
    <Text>
      <Text color="green">Line 1</Text>
      <Newline />
      <Text color="blue">Line 2</Text>
      <Newline count={2} />
      <Text color="red">Line 4 (after double newline)</Text>
    </Text>
  );
}

render(<MultilineText />);
```

### Transform - Modify rendered text output

Intercepts the string representation of Text components before output, enabling custom transformations like gradients, effects, or formatting. The transform function receives each line and its index.

```javascript
import {render, Transform, Text, Box} from 'ink';

function HangingIndent({children, indent = 4}) {
  return (
    <Transform
      transform={(line, index) =>
        index === 0 ? line : ' '.repeat(indent) + line
      }
    >
      {children}
    </Transform>
  );
}

function TransformDemo() {
  const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, ' +
    'sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

  return (
    <Box flexDirection="column" width={40}>
      <Transform transform={output => output.toUpperCase()}>
        <Text>This will be uppercase</Text>
      </Transform>

      <HangingIndent indent={4}>
        <Text>{longText}</Text>
      </HangingIndent>

      <Transform transform={(line, index) => `${index + 1}. ${line}`}>
        <Text>First line{'\n'}Second line{'\n'}Third line</Text>
      </Transform>
    </Box>
  );
}

render(<TransformDemo />);
```

## Input Handling

### useInput() - Handle keyboard input

Hook for capturing user input with detailed key information. Called once per character or once for pasted text. Provides structured key event data including modifiers and special keys.

```javascript
import React, {useState} from 'react';
import {render, useInput, useApp, Box, Text} from 'ink';

function InteractiveApp() {
  const {exit} = useApp();
  const [position, setPosition] = useState({x: 0, y: 0});
  const [log, setLog] = useState([]);

  useInput((input, key) => {
    // Exit on 'q' or Ctrl+C
    if (input === 'q' || (input === 'c' && key.ctrl)) {
      exit();
    }

    // Arrow keys
    if (key.leftArrow) setPosition(p => ({...p, x: Math.max(0, p.x - 1)}));
    if (key.rightArrow) setPosition(p => ({...p, x: Math.min(20, p.x + 1)}));
    if (key.upArrow) setPosition(p => ({...p, y: Math.max(0, p.y - 1)}));
    if (key.downArrow) setPosition(p => ({...p, y: Math.min(10, p.y + 1)}));

    // Special keys
    if (key.return) {
      setLog(prev => [...prev, `Position: (${position.x}, ${position.y})`]);
    }

    // Character input
    if (input && !key.ctrl && !key.meta && input.length === 1) {
      setLog(prev => [...prev, `Typed: ${input}`]);
    }

    // Log all key events
    const keyInfo = Object.entries(key)
      .filter(([_, v]) => v === true)
      .map(([k]) => k)
      .join(', ');

    if (keyInfo) {
      console.log(`Keys: ${keyInfo}, Input: "${input}"`);
    }
  });

  return (
    <Box flexDirection="column">
      <Text>Use arrow keys to move. Press Enter to log position. Press 'q' to quit.</Text>
      <Box height={12} paddingLeft={position.x} paddingTop={position.y}>
        <Text color="cyan">●</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {log.slice(-5).map((entry, i) => (
          <Text key={i} dimColor>{entry}</Text>
        ))}
      </Box>
    </Box>
  );
}

render(<InteractiveApp />);
```

## Focus Management

### useFocus() - Make component focusable

Enables focus management for components. Returns isFocused boolean and focus function. Tab/Shift+Tab cycles through focusable components in render order.

```javascript
import React, {useState} from 'react';
import {render, useFocus, useInput, Box, Text} from 'ink';

function FocusableInput({label, autoFocus = false}) {
  const {isFocused} = useFocus({autoFocus});
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.backspace) {
      setValue(v => v.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setValue(v => v + input);
    }
  });

  return (
    <Box>
      <Text color={isFocused ? 'cyan' : 'white'}>
        {isFocused ? '> ' : '  '}
        {label}: {value}
        {isFocused ? '█' : ''}
      </Text>
    </Box>
  );
}

function Form() {
  return (
    <Box flexDirection="column">
      <Text bold>Fill out the form (Tab to switch fields):</Text>
      <FocusableInput label="Name" autoFocus />
      <FocusableInput label="Email" />
      <FocusableInput label="Phone" />
    </Box>
  );
}

render(<Form />);
```

### useFocusManager() - Control focus programmatically

Exposes methods to enable/disable focus system and navigate between focusable components. Useful for custom focus behavior and complex focus flows.

```javascript
import React, {useState} from 'react';
import {render, useFocus, useFocusManager, useInput, Box, Text} from 'ink';

function MenuItem({id, label}) {
  const {isFocused} = useFocus({id});
  return (
    <Text color={isFocused ? 'green' : 'white'}>
      {isFocused ? '→ ' : '  '}{label}
    </Text>
  );
}

function Menu() {
  const {focusNext, focusPrevious, focus, enableFocus, disableFocus} = useFocusManager();
  const [menuActive, setMenuActive] = useState(true);

  useInput((input, key) => {
    if (key.upArrow) focusPrevious();
    if (key.downArrow) focusNext();

    // Jump to specific item
    if (input === '1') focus('home');
    if (input === '2') focus('settings');
    if (input === '3') focus('exit');

    // Toggle focus system
    if (input === 'd') {
      setMenuActive(false);
      disableFocus();
    }
    if (input === 'e') {
      setMenuActive(true);
      enableFocus();
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Menu {menuActive ? '(Active)' : '(Disabled)'}</Text>
      <MenuItem id="home" label="Home" />
      <MenuItem id="settings" label="Settings" />
      <MenuItem id="exit" label="Exit" />
      <Text dimColor marginTop={1}>
        ↑↓: Navigate | 1-3: Jump | d: Disable | e: Enable
      </Text>
    </Box>
  );
}

render(<Menu />);
```

## Application Control

### useApp() - Access application lifecycle methods

Provides exit function to unmount the app programmatically. The error parameter in exit() will cause waitUntilExit() promise to reject.

```javascript
import React, {useState, useEffect} from 'react';
import {render, useApp, Box, Text} from 'ink';

function TimedApp() {
  const {exit} = useApp();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      exit();
      return;
    }

    const timer = setInterval(() => {
      setCountdown(c => c - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, exit]);

  return (
    <Box>
      <Text>Exiting in {countdown} seconds...</Text>
    </Box>
  );
}

async function main() {
  const instance = render(<TimedApp />);

  try {
    await instance.waitUntilExit();
    console.log('App exited normally');
  } catch (error) {
    console.error('App exited with error:', error);
  }
}

main();
```

## Stream Access

### useStdin() - Access stdin stream and raw mode

Exposes stdin stream and setRawMode function. Raw mode is necessary for capturing Ctrl+C and other special key combinations.

```javascript
import React, {useEffect} from 'react';
import {render, useStdin, Box, Text} from 'ink';

function StdinExample() {
  const {stdin, setRawMode, isRawModeSupported} = useStdin();

  useEffect(() => {
    if (!isRawModeSupported) return;

    setRawMode(true);

    const handler = (data) => {
      console.log('Raw data:', Buffer.from(data).toString('hex'));
    };

    stdin.on('data', handler);

    return () => {
      stdin.removeListener('data', handler);
      setRawMode(false);
    };
  }, []);

  return (
    <Box>
      <Text>
        Raw mode: {isRawModeSupported ? 'Supported' : 'Not supported'}
      </Text>
    </Box>
  );
}

render(<StdinExample />);
```

### useStdout() - Write to stdout while preserving Ink output

Provides stdout stream and write function. The write function outputs text without interfering with Ink's rendering, similar to Static but for raw strings.

```javascript
import React, {useEffect} from 'react';
import {render, useStdout, Box, Text} from 'ink';

function LoggingApp() {
  const {stdout, write} = useStdout();

  useEffect(() => {
    // Write external logs above Ink output
    write('Application starting...\n');
    write('Loading configuration...\n');

    const timer = setInterval(() => {
      write(`[${new Date().toISOString()}] Heartbeat\n`);
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Box borderStyle="round" padding={1}>
      <Text>Main application UI (logs appear above)</Text>
    </Box>
  );
}

render(<LoggingApp />);
```

### useStderr() - Write to stderr while preserving Ink output

Provides stderr stream and write function for error output. Works identically to useStdout but writes to stderr.

```javascript
import React, {useEffect} from 'react';
import {render, useStderr, Box, Text} from 'ink';

function ErrorReporter() {
  const {stderr, write} = useStderr();

  useEffect(() => {
    // Log errors to stderr
    const errors = [
      'Warning: Configuration incomplete',
      'Error: Failed to connect to database',
      'Critical: Disk space low'
    ];

    errors.forEach((error, i) => {
      setTimeout(() => {
        write(`${error}\n`);
      }, i * 1000);
    });
  }, []);

  return (
    <Box>
      <Text>Check stderr for errors</Text>
    </Box>
  );
}

render(<ErrorReporter />);
```

## Utilities

### measureElement() - Get computed dimensions of a Box

Returns width and height of a rendered Box element. Must be called after initial render in useEffect when layout has been calculated. Uses React refs to access DOM elements.

```javascript
import React, {useRef, useState, useEffect} from 'react';
import {render, measureElement, Box, Text} from 'ink';

function ResponsiveComponent() {
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({width: 0, height: 0});

  useEffect(() => {
    if (containerRef.current) {
      const {width, height} = measureElement(containerRef.current);
      setDimensions({width, height});
    }
  }, []);

  return (
    <Box flexDirection="column">
      <Box ref={containerRef} width="80%" padding={2} borderStyle="single">
        <Text>Measure me!</Text>
      </Box>

      <Box marginTop={1}>
        <Text>
          Measured dimensions: {dimensions.width}x{dimensions.height}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {dimensions.width > 50 ? 'Wide layout' : 'Narrow layout'}
        </Text>
      </Box>
    </Box>
  );
}

render(<ResponsiveComponent />);
```

## Accessibility

### useIsScreenReaderEnabled() - Detect screen reader support

Returns boolean indicating if screen reader mode is active. Use to render alternative, more descriptive output for screen reader users.

```javascript
import React from 'react';
import {render, useIsScreenReaderEnabled, Box, Text} from 'ink';

function ProgressBar({value, max}) {
  const isScreenReaderEnabled = useIsScreenReaderEnabled();

  if (isScreenReaderEnabled) {
    return <Text aria-label={`Progress: ${value} of ${max}`}>{value}/{max}</Text>;
  }

  const percentage = Math.round((value / max) * 100);
  const filled = Math.floor((value / max) * 20);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);

  return (
    <Box>
      <Text>{bar} {percentage}%</Text>
    </Box>
  );
}

function AccessibleApp() {
  const isScreenReaderEnabled = useIsScreenReaderEnabled();

  return (
    <Box flexDirection="column">
      <Text>Screen reader: {isScreenReaderEnabled ? 'Enabled' : 'Disabled'}</Text>

      <ProgressBar value={7} max={10} />

      <Box
        aria-role="checkbox"
        aria-state={{checked: true}}
        marginTop={1}
      >
        <Text>Accept terms and conditions</Text>
      </Box>
    </Box>
  );
}

// Enable screen reader support
render(<AccessibleApp />, {
  isScreenReaderEnabled: true
});
```

### ARIA Support in Box Component

The Box component supports comprehensive ARIA attributes for accessibility. Supported `aria-role` values include: `button`, `checkbox`, `combobox`, `list`, `listbox`, `listitem`, `menu`, `menuitem`, `option`, `progressbar`, `radio`, `radiogroup`, `tab`, `tablist`, `table`, `textbox`, `timer`, and `toolbar`.

The `aria-state` object supports the following boolean properties: `busy`, `checked`, `disabled`, `expanded`, `multiline`, `multiselectable`, `readonly`, `required`, and `selected`. These states help convey the current status of interactive elements to screen readers.

```javascript
import {render, Box, Text} from 'ink';

function AccessibleForm() {
  return (
    <Box flexDirection="column">
      <Box aria-role="textbox" aria-state={{required: true, multiline: false}}>
        <Text>Username: </Text>
      </Box>

      <Box aria-role="checkbox" aria-state={{checked: false, disabled: false}}>
        <Text>☐ Remember me</Text>
      </Box>

      <Box aria-role="button" aria-label="Submit form">
        <Text>Submit</Text>
      </Box>
    </Box>
  );
}

render(<AccessibleForm />);
```

## Summary

Ink provides a comprehensive framework for building terminal applications using React's component model. The core workflow involves rendering React components with the render() function, using Box for layout and Text for output, and managing user interaction through hooks like useInput and useFocus. The library handles terminal rendering complexity while exposing full control over layout, styling, and behavior.

Advanced features include Static for permanent output, Transform for string manipulation, stream access hooks for raw I/O, measureElement for responsive layouts, and comprehensive accessibility support for screen readers. These primitives enable building everything from simple CLIs to complex interactive applications like test runners, build tools, and monitoring dashboards. The familiar React patterns—hooks, state management, effects—translate directly to terminal environments, making Ink accessible to web developers while providing terminal-specific optimizations.
