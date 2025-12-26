# The Membrane

**Context Engine for Accelerated Thinking**

A sophisticated web application that fuses document editing with semantic memory powered by real AI. Every insight you capture becomes part of an evolving context that grows smarter with each session.

## ✨ Features

- **Real-time AI Assistance** via OpenRouter (Claude, Grok, DeepSeek, GPT-4, Gemini)
- **Streaming Responses** for natural conversation flow
- **Vector Embeddings** for semantic memory and context retrieval
- **Ghost-writing Suggestions** that appear as you type
- **Surgical Editing** with non-destructive diffs
- **Training Data Upload** - Import CSVs, text files, chat histories
- **Multi-tenant Isolation** with project-based memory

## 🚀 Quick Start

### Frontend Setup

```bash
# Install frontend dependencies
npm install

# Start development server
npm run dev
```

### Backend Setup

```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt

# Start API server
python main.py
```

The frontend will be available at `http://localhost:5173` (or next available port)  
The backend API will run at `http://localhost:8000`

## 🤖 AI Integration

The Membrane uses **OpenRouter** to provide access to multiple AI models:

- **Claude 3.5 Sonnet** (Anthropic) - Default, 200K context, excellent reasoning
- **Grok 2** (xAI) - 131K context, fast and capable
- **DeepSeek Chat** - 64K context, efficient and cost-effective  
- **Gemini 2.0 Flash** (Google) - 1M context window, experimental free tier

### Model Selection

You can switch between models directly in the chat interface by clicking the 🤖 button in the header.

### API Configuration

The API key is stored in `backend/.env`:
```
OPENROUTER_API_KEY=sk-or-v1-xxxxx
DEFAULT_MODEL=anthropic/claude-3.5-sonnet
```

## 📊 Training Data

Upload files to enhance the AI's context for your specific use case:

- **CSV files** - Structured data, metrics, reports
- **Text files** - Documents, notes, research
- **JSON files** - Chat histories, structured data

Files are automatically processed and added to the vector database for semantic search during conversations.
- **Surgical Precision**: Highlight any text block for AI assistance. Non-destructive diffs let you audit suggestions before committing
- **Multi-Purpose Workspaces**: Optimized modes for Writing, Accounting, Research, and General use
- **AI Partner Modes**: Critical, Balanced, or Expansive thinking partners adapt to your needs

## 🛠️ Tech Stack

- **React 18** with TypeScript
- **React Router** for navigation
- **Vite** for fast development and building
- **localStorage** for client-side persistence (ready for Supabase integration)
- **Custom CSS** with dark theme design system

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🎯 Usage

1. **Start the app**: Run `npm run dev` and open http://localhost:3000
2. **Sign up**: Create an account (currently uses mock authentication)
3. **Create a project**: Choose your purpose (Writing, Research, etc.)
4. **Start writing**: The membrane learns your patterns and offers ghost suggestions
5. **Select text**: Highlight any passage for AI-powered surgical editing
6. **Build memory**: Save important insights to your semantic memory

## 🎨 Key Components

### Landing Page
- Hero section with animated membrane visualization
- Feature showcase
- Elegant dark theme design

### Dashboard
- Project overview and management
- Quick access to current focus
- Project type categorization

### Editor Workspace
- Rich text editor with ghost-writing suggestions
- Context-aware chat panel with AI assistant
- Semantic memory panel for saved insights
- Configurable purpose and partner modes

## 🧠 AI Features (Simulated)

The current version includes simulated AI responses for demonstration:
- `/improve` - Enhance selected text
- `/expand` - Add depth and context
- `/simplify` - Make text more accessible  
- `/challenge` - Play devil's advocate

## 🔐 Authentication

Currently uses mock authentication with localStorage. Ready for integration with:
- Supabase Auth
- OAuth providers (Google, GitHub)

## 📁 Project Structure

```
src/
├── features/
│   ├── landing/        # Landing page
│   ├── auth/           # Login/signup
│   ├── dashboard/      # Project management
│   └── editor/         # Document editor workspace
│       └── components/ # Editor sub-components
├── context/            # React context providers
│   ├── AuthContext     # Authentication state
│   └── ThemeContext    # Theme management
└── utils/              # Utilities
    └── persistence     # Storage abstraction
```

## 🎨 Design System

The app uses a custom CSS design system with:
- Color palette optimized for dark mode
- Typography scales (Inter, JetBrains Mono, Merriweather)
- Spacing and border radius tokens
- Transition timing constants

## 🚧 Future Enhancements

- Real AI integration (OpenAI, Anthropic)
- Vector database for semantic search
- Supabase backend for multi-device sync
- Export to Markdown/PDF
- Collaborative editing
- Mobile responsive improvements

## 📝 License

MIT

---

Built with ❤️ for accelerated thinking