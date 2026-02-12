# Hardware Monitor App

A real-time hardware telemetry monitoring and analysis application built with React Native, Expo, and AI-powered analytics.

## Key Features

- **Real-time Monitoring**: Live GPU/CPU temperature, fan RPM, and power consumption tracking
- **AI Analytics**: Custom MCP servers for intelligent anomaly detection and performance insights
- **Cross-Platform**: Native iOS/Android support with React Native and Expo
- **Modern UI**: Professional dark theme with consistent design system
- **Authentication**: Secure user management with Clerk

## Tech Stack

- **Frontend**: React Native, Expo SDK 54, TypeScript
- **Backend**: SQLite database, MCP server architecture
- **AI**: OpenAI GPT-4o integration with custom tools
- **Auth**: Clerk authentication and secure API key management

## Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator or Android Emulator

### Installation
```bash
# Clone and install
git clone (https://github.com/OchubaEkene/hardware-telemetry-monitoring-application-.git)
cd hardware-monitor-app
npm install

# Environment setup
cp .env.example .env
# Add your API keys to .env file

# Start development
npm start
```

### Required API Keys
```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
OPENAI_API_KEY=your_openai_key
```
