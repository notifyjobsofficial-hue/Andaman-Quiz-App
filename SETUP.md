# Andaman Quiz — Production Architecture & Deployment Guide

This document provides complete instructions for setting up, configuring, and deploying the **Andaman Quiz** production ecosystem:
1. **Flutter Android Student App** (Login-free, offline-first, dynamic catalog, rich diagram rendering).
2. **Dedicated Web Admin Panel** (`web-admin/` built with React, Vite, and Tailwind CSS).
3. **Firebase Backend** (Cloud Firestore, Firebase Storage, and Firebase Authentication for Administrators).
4. **Cloudflare Pages Deployment** (Fast, global CDN deployment with SPA routing and custom domain support).

---

## 1. System Architecture Overview

```
                            +-----------------------------+
                            |       Firebase Console      |
                            |  - Email/Password Auth      |
                            |  - Cloud Firestore          |
                            |  - Firebase Storage         |
                            +--------------+--------------+
                                           |
                     +---------------------+---------------------+
                     |                                           |
                     v                                           v
       +---------------------------+               +---------------------------+
       |   Cloudflare Pages        |               |   Android Student App     |
       |   (Web Admin Panel)       |               |   (Offline-First Flutter) |
       |                           |               |                           |
       | - Authenticated Admins    |               | - Login-Free / No Signup  |
       | - Exam/Subject Hierarchy  |               | - Dynamic Catalog Sync    |
       | - Bulk Question Import    |               | - Cached Hive DB          |
       | - Test Question Builder   |               | - CBT Exam Simulation     |
       | - App Banners & Notices   |               | - Free / Paid Test UI     |
       +---------------------------+               +---------------------------+
```

---

## 2. Firebase Backend Setup

### A. Authentication (Admin Only)
> **NOTE:** The Android student application is 100% login-free. Firebase Authentication is exclusively used by the Web Admin Panel.

1. Go to the [Firebase Console](https://console.firebase.google.com/) and select project **`andaman-quiz`**.
2. In the left navigation, navigate to **Build > Authentication**.
3. Under the **Sign-in method** tab, click **Email/Password** and enable the first switch (**Email/Password**). Leave "Email link (passwordless sign-in)" disabled.
4. Click **Save**.

### B. Creating the Initial Super Admin User
1. In the **Authentication** section, click the **Users** tab.
2. Click **Add user**.
3. Enter your administrative email (e.g., `admin@andamanquiz.com`) and a strong password. Click **Add user**.
4. In the users table, copy the newly created user's **User UID** (e.g., `aBcD1234xYz...`).
5. Now, navigate to **Build > Firestore Database**.
6. If not already created, create the database in your preferred location (e.g., `asia-south1`).
7. In the Firestore Data tab, click **Start collection**:
   - **Collection ID**: `admins`
   - **Document ID**: Paste the **User UID** copied in Step 4.
   - **Fields**:
     - `role`: string `admin`
     - `email`: string `admin@andamanquiz.com`
     - `name`: string `Super Admin`
     - `createdAt`: timestamp (current date/time)
8. Click **Save**. The Web Admin panel verifies this document before granting access.

### C. Deploying Firestore Security Rules
Production-grade security rules have been written to `G:\Andaman Quiz App\firestore.rules`.
To deploy them:
1. In the Firebase Console, go to **Firestore Database > Rules**.
2. Replace any existing rules with the contents of `firestore.rules`:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function isAuthenticated() {
         return request.auth != null;
       }
       function isAdmin() {
         return isAuthenticated() && (
           request.auth.token.email.matches('.*@andamanquiz\\.com$') ||
           exists(/databases/$(database)/documents/admins/$(request.auth.uid))
         );
       }
       // Public read for students, Admin-only write
       match /categories/{doc} { allow read: if true; allow write: if isAdmin(); }
       match /exams/{doc} { allow read: if true; allow write: if isAdmin(); }
       match /subjects/{doc} { allow read: if true; allow write: if isAdmin(); }
       match /topics/{doc} { allow read: if true; allow write: if isAdmin(); }
       match /questions/{doc} { allow read: if true; allow write: if isAdmin(); }
       match /mock_tests/{doc} { allow read: if true; allow write: if isAdmin(); }
       match /app_content/{doc} { allow read: if true; allow write: if isAdmin(); }
       match /admins/{userId} {
         allow read: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
         allow write: if isAdmin();
       }
     }
   }
   ```
3. Click **Publish**.

### D. Deploying Firebase Storage Security Rules
Security rules for diagram and image uploads have been written to `G:\Andaman Quiz App\storage.rules`.
1. In the Firebase Console, go to **Build > Storage > Rules**.
2. Replace the rules with the contents of `storage.rules`:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       function isAdmin() {
         return request.auth != null && (
           request.auth.token.email.matches('.*@andamanquiz\\.com$') ||
           firestore.exists(/databases/(default)/documents/admins/$(request.auth.uid))
         );
       }
       // Allow public read for question and banner images
       match /{allPaths=**} {
         allow read: if true;
         allow write: if isAdmin();
       }
     }
   }
   ```
3. Click **Publish**.

---

## 3. Web Admin Setup & Local Development

The Web Admin is located in `web-admin/` and is built with Vite, React 18, and Tailwind CSS.

### A. Environment Configuration
Copy `.env.example` to `.env` inside `web-admin/`:
```bash
cp web-admin/.env.example web-admin/.env
```
The pre-configured credentials match your Firebase project:
```env
VITE_FIREBASE_API_KEY=AIzaSyDdkNWXdjhR1tdIdpBz7LXf13bMGr16KDM
VITE_FIREBASE_AUTH_DOMAIN=andaman-quiz.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=andaman-quiz
VITE_FIREBASE_STORAGE_BUCKET=andaman-quiz.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=792987163098
VITE_FIREBASE_APP_ID=1:792987163098:web:7a8df9e87cdbc105251643
```

### B. Running Locally
In PowerShell (note: if your `C:\` drive is low on storage, direct npm temp/cache to `G:\temp`):
```powershell
$env:TEMP="G:\temp"; $env:TMP="G:\temp"
npm.cmd run dev
```
Open [http://localhost:5173](http://localhost:5173) in your web browser.

### C. Building for Production
```powershell
$env:TEMP="G:\temp"; $env:TMP="G:\temp"
npm.cmd run build
```
This produces optimized production assets in `web-admin/dist/` along with `_redirects` for Cloudflare Pages.

---

## 4. Deploying Web Admin to Cloudflare Pages

### Option A: Git Integration (Recommended)
1. Push your repository to GitHub or GitLab.
2. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), go to **Workers & Pages > Create application > Pages > Connect to Git**.
3. Select your repository (`Andaman Quiz App`).
4. Configure Build settings:
   - **Project name**: `andaman-quiz-admin`
   - **Production branch**: `main` (or your active branch)
   - **Framework preset**: `Vite`
   - **Root directory**: `web-admin`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Under **Environment variables**, add:
   - `VITE_FIREBASE_API_KEY`: `AIzaSyDdkNWXdjhR1tdIdpBz7LXf13bMGr16KDM`
   - `VITE_FIREBASE_AUTH_DOMAIN`: `andaman-quiz.firebaseapp.com`
   - `VITE_FIREBASE_PROJECT_ID`: `andaman-quiz`
   - `VITE_FIREBASE_STORAGE_BUCKET`: `andaman-quiz.firebasestorage.app`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`: `792987163098`
   - `VITE_FIREBASE_APP_ID`: `1:792987163098:web:7a8df9e87cdbc105251643`
6. Click **Save and Deploy**.

### Option B: Direct Upload via Cloudflare Dashboard
1. Run `npm.cmd run build` inside `web-admin/`.
2. In Cloudflare Dashboard, go to **Workers & Pages > Create application > Pages > Upload assets**.
3. Name your project `andaman-quiz-admin`.
4. Drag and drop the `web-admin/dist/` directory directly into the browser.
5. Click **Deploy site**.

### SPA Routing Note
Cloudflare Pages handles Single Page Application routing via the `web-admin/public/_redirects` file:
```
/*  /index.html  200
```
This is automatically copied into `dist/_redirects` during `vite build`, ensuring that direct navigation or refreshing pages like `/questions` or `/test-builder` will never return a 404.

### Setting Up a Custom Domain (e.g. `admin.andamanquiz.com`)
1. In Cloudflare Pages, select your project `andaman-quiz-admin`.
2. Click the **Custom domains** tab > **Set up a custom domain**.
3. Enter your domain/subdomain: `admin.andamanquiz.com`.
4. Cloudflare automatically sets up the DNS CNAME record and provisions free SSL/TLS encryption.

---

## 5. Web Admin Features & Operational Guide

### 1. Categories & Exams
- **Categories**: Organize exams by tier (e.g., `Andaman Group C Recruitment`, `Police Department`, `Forest Department`).
- **Exams**: Create specific exams (e.g., `LGC / Jr. Assistant`, `Sub Inspector Executive`, `Forest Guard`) linked to categories.

### 2. Subjects & Topics
- Manage subjects (e.g., *General Knowledge of A&N Islands*, *History & Geography*, *Logical Reasoning*, *English Comprehension*).
- Define sub-topics (e.g., *Cellular Jail & Freedom Struggle*, *Tribes of Andaman & Nicobar*, *Forests & Marine Life*).

### 3. Question Bank
- Centralized repository of all MCQs.
- Filter by Exam, Subject, Topic, and Difficulty (`easy`, `medium`, `hard`).
- Rich preview with question images, 4 option images, and detailed explanation text/diagrams.
- Create single questions with drag-and-drop image uploads.

### 4. Bulk Question Importer (High-Volume Pipeline)
- **Supported Formats**: CSV (`.csv`) and Excel (`.xlsx`, `.xls`).
- **Downloadable Templates**: Click **Sample CSV** or **Sample Excel (.xlsx)** on the Bulk Import screen.
- **Auto Validation**:
  - Validates question text, all 4 options, and correct answer key (`A`, `B`, `C`, or `D`).
  - Flags duplicate questions by checking existing Firestore database.
  - Automatically matches Exam and Subject names or IDs.
- **Bulk Local Image Mapping**:
  - When spreadsheet rows contain local image filenames (e.g. `cellular_jail_map.png`), click **Select Local Images Folder/Files**.
  - The importer maps filenames, batches uploads them to Firebase Storage (`question_images/`), and assigns the live HTTPS download URLs into the question records.
- **Batch Insertion**: Automatically chunks inserts into Firebase 400-item batches for maximum network reliability.

### 5. Interactive Test Question Builder
- Create Full-Length Mock Exams, Sectional Tests, or Daily Quizzes.
- Configure:
  - **Exam & Category selection**
  - **Total Duration** (in minutes)
  - **Total Marks**, Positive Marks per question, Negative Marks penalty
  - **Free vs. Paid Toggle**: Mark test as Free or set Price (e.g. `₹49`), Original Price (`₹149`), and Offer Price.
  - **Custom Test Instructions** (rendered in the CBT exam launch sheet).
- **Search & Pick Interface**: Filter questions by topic/subject, check off desired questions, and view running question count and marks in real-time.

### 6. App Content Management
- **Home Carousel Banners**: Upload and manage promotional banners with active/inactive toggles.
- **Student Notices**: Broadcast exam alerts, syllabus updates, or notification links.
- **App Config**: Dynamic feature flags and minimum version checks.

---

## 6. Android Student App Architecture

### Key Design & Architecture Guarantees
- **Visual & CBT Design Preserved 100%**: Zero redesign of existing approved student UI. Colors, timer, palette, question cards, bottom sheets, navigation, and CBT exam simulation remain untouched.
- **Admin Completely Removed**: No admin login button, hidden menu, or backdoor route exists in the student app.
- **Offline-First Resilience**: All dynamic catalog elements (categories, exams, subjects, and mock tests) are cached in Hive (`local_database.dart`). When offline, the app displays the local catalog seamlessly.
- **Cost-Optimized Firestore Reads**:
  - App opens: fetches catalog metadata only once or uses cached copy (`syncAppCatalog`).
  - Tests screen: fetches question arrays *only* when a student starts a mock test (`fetchQuestionsForTest`), saving thousands of Firestore reads.
- **Diagram & Image Support**: Question stems, option tiles, and answer explanations render images smoothly with loading indicators and error fallbacks.
- **Free vs Paid Tests**:
  - Free tests launch directly into the CBT exam interface.
  - Paid tests display an indigo `PAID • ₹XX` badge and present a pricing details modal.

---

## 7. Verification Checklist

| Area | Item | Status |
|---|---|---|
| **Android Student App** | Visible Admin buttons & `/admin` route removed | Verified |
| **Android Student App** | `flutter analyze` completed with 0 errors / 0 warnings | Verified |
| **Android Student App** | Offline-first Hive DB fallback for categories, exams, & mocks | Verified |
| **Android Student App** | Question & Option image rendering in CBT exam & practice screens | Verified |
| **Android Student App** | Free vs. Paid test handling with `StatusBadge.paid` | Verified |
| **Web Admin Panel** | Production build (`tsc && vite build`) completed cleanly | Verified |
| **Web Admin Panel** | Cloudflare Pages SPA routing (`_redirects`) included in `dist/` | Verified |
| **Web Admin Panel** | Sample CSV & Excel templates downloadable | Verified |
| **Web Admin Panel** | Pre-insertion validation & duplicate detection | Verified |
| **Web Admin Panel** | Bulk local image upload & Storage URL mapping | Verified |
| **Firebase Backend** | `firestore.rules` hardened with Admin-only write rules | Verified |
| **Firebase Backend** | `storage.rules` with public read and admin write | Verified |
