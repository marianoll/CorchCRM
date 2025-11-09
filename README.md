# CorchCRM — The Customer Orchestrator

CorchCRM is a zero-click, voice-and-AI powered CRM built with Next.js, Firebase, and Google's Genkit. It's designed to automatically capture and structure customer interactions from sources like voice notes and emails, preventing customer leakage and keeping your sales pipeline effortlessly up-to-date.

## ✨ Features

- **Zero-Click Data Entry**: Transcribe voice notes or connect your Gmail to automatically extract and suggest new contacts, deals, and tasks.
- **AI-Powered Suggestions**: An AI orchestrator analyzes interactions and provides actionable suggestions in a "Zero-Click Inbox" for you to approve or reject.
- **Natural Language Search**: Use plain English to search your CRM data (e.g., "show me deals over $20k closing next month").
- **Automated Actions**: Approve AI suggestions to automatically update deal stages, schedule meetings, and log follow-up emails.
- **Comprehensive CRM Views**: Manage your **Deals**, **Contacts**, **Companies**, and **Tasks** in a clean, table-based interface.
- **Complete Audit Trail**: The **Orchestrator** and **Crystals** pages provide an immutable log of all AI extractions and system actions.
- **Extensive Settings**: Customize your sales pipeline, automation rules, AI communication tone, and more.

## 🚀 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **UI**: [React](https://reactjs.org/) & [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [ShadCN UI](https://ui.shadcn.com/)
- **Backend & DB**: [Firebase](https://firebase.google.com/) (Authentication & Firestore)
- **Generative AI**: [Google's Genkit](https://firebase.google.com/docs/genkit) (with the Gemini family of models)

## 🛠️ Getting Started

Follow these steps to get the project running locally.

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- `npm` or `yarn`

### 2. Installation

Clone the repository and install the dependencies:

```bash
git clone <repository_url>
cd <repository_name>
npm install
```

### 3. Firebase & Google API Setup

This project requires configuration for Firebase and Google APIs to function correctly.

1.  **Firebase Configuration**:
    *   Create a `.env.local` file in the root of the project.
    *   Add your Firebase project configuration keys to this file (e.g., `NEXT_PUBLIC_FIREBASE_API_KEY`, etc.). This ensures your client-side code can connect to your Firebase project.

2.  **Enable Google APIs**:
    *   **Identity Platform API**: This is required for Firebase Authentication. Follow the instructions in `IDENTITY_PLATFORM_SETUP.md` to enable it.
    *   **Gmail API**: This is required for the Gmail integration feature. Follow the instructions in `GMAIL_API_SETUP.md` to configure the OAuth consent screen and get your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Add these to your `.env.local` file.

### 4. Running the Development Server

Once the environment variables are set up, start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:9002`.

## 📂 Project Structure

- `src/app/`: Main application routes, following the Next.js App Router structure.
- `src/components/`: Reusable React components, including UI components from ShadCN.
- `src/firebase/`: Firebase client configuration, custom hooks (`useUser`, `useCollection`), and provider setup.
- `src/ai/`: Contains all Genkit-related code.
  - `src/ai/flows/`: Server-side AI workflows for tasks like email analysis, speech-to-text, and action orchestration.
- `docs/`: Contains the data schema (`backend.json`) that defines the shape of CRM entities.
- `firestore.rules`: Security rules for the Firestore database.
