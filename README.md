# StudyBeam - AI-Powered Study Companion

StudyBeam is a Next.js web application designed to assist students in their learning process by leveraging AI. It allows users to upload lecture notes, generate study materials like summaries, flashcards, and quizzes, and interact with an AI chat assistant for Q&A.

## Key Features

-   **AI Content Generation**:
    -   Upload text files (.txt, .md) or paste lecture notes.
    -   Generate concise summaries.
    -   Create flashcards for quick review.
    -   Generate practice quizzes with multiple-choice questions.
-   **Interactive Learning Tools**:
    -   Review flashcard decks.
    -   Take AI-generated or custom quizzes.
    -   Track quiz progress and scores.
-   **AI Q&A Assistant**:
    -   Chat with an AI that can answer questions based on uploaded documents or general knowledge.
    -   Save AI responses as notes.
-   **User Accounts & Data Management**:
    -   Firebase authentication (Email/Password, Google Sign-In).
    -   Persistent storage for user-generated notes, flashcard decks, quiz decks, and chat history using Firestore.
    -   User profile management with avatar uploads.
-   **Responsive Design**:
    -   User-friendly interface adaptable to various screen sizes.
    -   Dark mode support.

## Tech Stack

-   **Frontend**:
    -   [Next.js](https://nextjs.org/) (App Router)
    -   [React](https://reactjs.org/)
    -   [TypeScript](https://www.typescriptlang.org/)
-   **UI Components**:
    -   [ShadCN UI](https://ui.shadcn.com/)
    -   [Tailwind CSS](https://tailwindcss.com/)
    -   [Lucide React](https://lucide.dev/) (for icons)
    -   [Framer Motion](https://www.framer.com/motion/) (for animations)
    -   [Recharts](https://recharts.org/) (for charts)
-   **Generative AI**:
    -   [Genkit (Firebase Genkit)](https://firebase.google.com/docs/genkit)
    -   Google AI (Gemini models)
-   **Backend & Database**:
    -   [Firebase](https://firebase.google.com/)
        -   Firebase Authentication
        -   Firestore (Database named 'studybeam')
        -   Firebase Storage (for avatars)
-   **State Management & Forms**:
    -   React Context API (for Sidebar state)
    -   React Hook Form (for form handling)
    -   Zod (for schema validation)
-   **Styling**:
    -   Tailwind CSS
    -   CSS Variables for theming (light/dark mode)
    -   `@tailwindcss/typography` for Markdown rendering.

## Getting Started

### Prerequisites

-   Node.js (v18 or later recommended)
-   npm or yarn
-   A Firebase project with the following services enabled:
    -   Authentication (Email/Password and Google providers enabled)
    -   Firestore (Native mode)
    -   Storage

### Setup

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd studybeam-project
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Firebase**:
    -   Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
    -   In your Firebase project, go to Project settings > General.
    -   Under "Your apps", click the Web icon (`</>`) to add a web app.
    -   Register your app and copy the `firebaseConfig` object.
    -   Replace the placeholder `firebaseConfig` in `src/lib/firebase.ts` with your project's configuration.
        ```typescript
        // src/lib/firebase.ts
        const firebaseConfig = {
          apiKey: "YOUR_API_KEY",
          authDomain: "YOUR_AUTH_DOMAIN",
          projectId: "YOUR_PROJECT_ID",
          storageBucket: "YOUR_STORAGE_BUCKET",
          messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
          appId: "YOUR_APP_ID"
        };
        ```
    -   In Firebase Authentication settings, under "Sign-in method", enable "Email/Password" and "Google" providers.
    -   For Google Sign-In to work locally and in deployed environments, add the respective domains to the "Authorized domains" list in Firebase Authentication settings (e.g., `localhost` for local development, your Firebase App Hosting domain for production).
    -   Ensure Firestore is initialized in Native Mode.
    -   Ensure Firebase Storage is set up.

4.  **Configure Genkit (Google AI)**:
    -   Genkit uses Google AI models (like Gemini). Ensure you have a Google Cloud project with the Vertex AI API enabled.
    -   Set up authentication for Genkit. Typically, this involves setting the `GOOGLE_API_KEY` environment variable or configuring Application Default Credentials (ADC). Create a `.env` file in the root of the project:
        ```env
        GOOGLE_API_KEY=your_google_ai_api_key
        ```
    -   The Genkit initialization is in `src/ai/genkit.ts`.

### Running the Development Server

1.  **Start the Next.js app**:
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    The application will typically be available at `http://localhost:9002`.

2.  **Start the Genkit development server (optional, for local flow testing)**:
    In a separate terminal, run:
    ```bash
    npm run genkit:dev
    # or for watching changes
    npm run genkit:watch
    ```
    This starts the Genkit developer UI, usually on `http://localhost:4000`, where you can test your AI flows.

## Genkit AI Flows

The application uses Genkit to define and manage AI-powered flows:

-   `src/ai/flows/generate-study-materials.ts`: Handles the generation of flashcards, summaries, and practice questions from input text.
-   `src/ai/flows/answer-questions.ts`: Powers the AI chat assistant, enabling it to answer questions based on provided context, files, or general knowledge.

These flows are configured to use Google AI models (e.g., Gemini Flash).

## Building for Production

To build the application for production:

```bash
npm run build
# or
yarn build
```

This will create an optimized production build in the `.next` folder.

## Deployment

This application is structured for deployment with [Firebase App Hosting](https://firebase.google.com/docs/app-hosting).

-   The `apphosting.yaml` file contains basic configuration for App Hosting.
-   Connect your Firebase project to your Git repository (e.g., GitHub) and configure App Hosting to deploy on commits to your main branch.

## Project Structure Overview

```
.
├── public/                 # Static assets
├── src/
│   ├── ai/                 # Genkit AI flows and configuration
│   │   ├── flows/          # Specific AI flow implementations
│   │   └── genkit.ts       # Genkit initialization
│   ├── app/                # Next.js App Router pages and layouts
│   │   ├── (app)/          # Authenticated app routes
│   │   │   ├── dashboard/
│   │   │   ├── qa/         # Chat interface
│   │   │   ├── notes/
│   │   │   ├── flashcards/
│   │   │   ├── quiz/
│   │   │   ├── profile/
│   │   │   └── layout.tsx  # Layout for authenticated routes
│   │   ├── (auth)/         # Authentication routes (login, signup)
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── layout.tsx  # Layout for auth routes
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Landing page
│   ├── components/         # Reusable UI components
│   │   ├── ui/             # ShadCN UI components
│   │   └── app-sidebar.tsx # Main application sidebar
│   │   └── logo.tsx        # Logo component
│   ├── hooks/              # Custom React hooks (e.g., useToast, useMobile)
│   ├── lib/                # Utility functions, Firebase setup, type definitions
│   │   ├── firebase.ts     # Firebase initialization and exports
│   │   ├── utils.ts        # General utility functions (e.g., cn)
│   │   └── *-data.ts       # Type definitions for Firestore data
├── next.config.ts          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── components.json         # ShadCN UI configuration
├── package.json
├── README.md               # This file
└── ...                     # Other configuration files
```

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

---

Powered by StudyBeam.
