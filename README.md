# Personal Budgeting App

A sleek, modern, and powerful personal budgeting web application built with **Next.js**, **Supabase**, and **Vanilla CSS**. This app helps you track your daily expenses, manage monthly budgets, and keep a clear record of debts and credits (splits).

## ✨ Features

- **📊 Dynamic Dashboard**: Get a quick overview of your today's spending, daily budget targets, and overall monthly P/L.
- **💸 Expense Management**: Log daily expenses with categories and descriptions.
- **🔄 Expense Splitting**: Automatically calculate shares when paying for others. Integrated credit/debit tracking.
- **🤝 Debt Tracker**: Keep track of who owes you (credits) and who you owe (debits) with a dedicated status-based view.
- **📅 Monthly Budgeting**: Set monthly targets and see your "Adjusted Remaining Budget" based on open debts.
- **🎨 Premium UI**: A clean, responsive design with dark mode support, smooth transitions, and intuitive navigation.

## 🚀 Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Styling**: Vanilla CSS (CSS Variables, Flex/Grid)
- **Icons**: Semantic Emojis & Custom CSS
- **Utilities**: `date-fns` for date manipulation, `papaparse` & `xlsx` for potential data exports.

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js 18+
- A Supabase account and project.

### 2. Environment Setup
Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Initialization
Run the SQL script found in `supabase/schema.sql` in your Supabase SQL Editor. This will set up the necessary tables, indexes, and stored procedures (like `log_expense_with_splits`).

### 4. Local Development
```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## 📂 Project Structure

- `src/app/`: Next.js pages and API routes.
- `src/components/`: Reusable UI components (Shared layout, Toasts, Modals).
- `src/lib/`: Utility functions, types, and database clients.
- `supabase/`: SQL schema and database migrations.
- `public/`: Static assets.

## 📄 License
This project is private and for personal use.
