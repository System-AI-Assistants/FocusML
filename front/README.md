# FocusML Frontend

React application for the FocusML platform. Provides a dashboard, assistant management, benchmarking interface, user administration, and chat functionality.

## Prerequisites

- Node.js 18+
- npm or yarn

## Setup

### Install Dependencies

```bash
npm install
```

### Configure Environment

The application connects to the backend API. Configure the API URL in `src/services/api.js` if needed.

For Keycloak authentication, configure settings in `src/keycloak.js`.

## Development

Start the development server:

```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Production Build

Create an optimized production build:

```bash
npm run build
```

Output is placed in the `build/` directory.

## Project Structure

```
front/
├── public/           # Static assets
├── src/
│   ├── components/   # Reusable UI components
│   ├── pages/        # Page components
│   ├── services/     # API client
│   ├── styles/       # Global styles and themes
│   ├── App.js        # Main application component
│   └── index.js      # Entry point
└── package.json
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with statistics |
| `/assistants` | AI assistant management |
| `/assistants/add` | Create new assistant |
| `/data-collections` | Data collection management |
| `/benchmarks` | Benchmark execution and results |
| `/models` | Model registry |
| `/users` | User and group administration |
| `/widgets` | Embeddable chat widget configuration |
| `/integrations` | API keys and integrations |

## Testing

```bash
npm test
```

## Docker

Build and run with Docker:

```bash
docker build -t focusml-frontend .
docker run -p 3000:80 focusml-frontend
```
