# Cloud Sync Setup Guide

Enable multi-device synchronization using Firebase Firestore (100% FREE for your use case).

## Why Cloud Sync?

✅ **Edit from any device** - Changes sync automatically  
✅ **No manual file management** - No more downloading/uploading JSON  
✅ **Real-time updates** - See changes instantly  
✅ **100% Free** - Firebase free tier is more than enough  

---

## Quick Setup (5 minutes)

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name: `tinker-tasker` (or whatever you like)
4. Disable Google Analytics (not needed) or leave it enabled
5. Click **"Create project"**

### Step 2: Enable Firestore Database

1. In your Firebase project, click **"Firestore Database"** in the left menu
2. Click **"Create database"**
3. Choose **"Start in test mode"** (we'll secure it later)
4. Select your region (choose closest to you)
5. Click **"Enable"**

### Step 3: Register Your Web App

1. Click the **gear icon** ⚙️ next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to "Your apps"
4. Click the **web icon** `</>`
5. Enter app nickname: `Tinker Tasker`
6. Check **"Also set up Firebase Hosting"** (optional)
7. Click **"Register app"**

### Step 4: Copy Your Firebase Config

You'll see something like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Step 5: Add Config to Your App

**Option A: Environment Variables (Recommended)**

1. Create a file `.env` in your `my-tracker` folder:

```bash
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123
```

2. **Important**: Add `.env` to your `.gitignore`:

```bash
# .gitignore
.env
```

**Option B: Direct Config (Quick Test)**

Edit `src/firebase.ts` and replace the placeholder values:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Step 6: Restart Your App

```bash
npm start
```

You should now see **"Cloud Sync On"** in green at the top right! ☁️✅

---

## Initial Data Upload

The first time you run with cloud sync enabled, your Firestore database will be empty. To upload your current curriculum:

1. Click **"Edit Mode"**
2. Make any small change (or don't)
3. Click **"Save to Cloud"**
4. Done! Your data is now in the cloud

---

## Security Rules (Optional but Recommended)

By default, Firestore is in "test mode" which allows anyone to read/write for 30 days.

### Basic Security (Anyone can read, but only you can edit)

1. Go to Firebase Console → **Firestore Database** → **Rules**
2. Replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to READ curriculum
    match /curriculum/{document=**} {
      allow read: if true;
      allow write: if false; // Only you can edit via Firebase Console
    }
  }
}
```

3. Click **"Publish"**

**How to edit with this setup:**
- You can still edit in Edit Mode (but saves will fail for others)
- Only edit from devices you trust
- Or manually edit in Firebase Console

### Advanced: Add Password Protection

If you want to add simple password protection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /curriculum/{document=**} {
      allow read: if true;
      allow write: if request.auth != null; // Requires authentication
    }
  }
}
```

Then add Firebase Authentication (see Firebase docs).

---

## Troubleshooting

### "Cloud Sync Off" shows up

**Cause**: Firebase config is missing or incorrect

**Fix**:
1. Check your `.env` file has all values
2. Restart `npm start` after adding `.env`
3. Check browser console for Firebase errors

### "Permission denied" error

**Cause**: Firestore security rules are blocking you

**Fix**:
1. Go to Firebase Console → Firestore → Rules
2. Temporarily set to test mode:
   ```javascript
   allow read, write: if true;
   ```
3. Remember to secure it later!

### Data not syncing

**Cause**: Network or Firebase quota

**Fix**:
1. Check internet connection
2. Check browser console for errors
3. Verify Firebase project is active

---

## Cost

**You will NOT be charged.** Firebase free tier includes:

- ✅ **50,000 reads/day**
- ✅ **20,000 writes/day**
- ✅ **1 GB storage**

Your app will use approximately:
- **1 read on page load** (~30/day if you check 30 times)
- **1 write per save** (~5/day)
- **~5 KB storage** (total)

**You'd need to refresh the page 50,000+ times per day to hit limits!**

---

## Multi-Device Usage

Once set up:

1. **Device 1**: Make changes → Click "Save to Cloud" ✅
2. **Device 2**: Refresh page → Changes appear automatically! 🎉

No file transfers, no emails, no USB drives. Just works.

---

## Need Help?

- [Firebase Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Console](https://console.firebase.google.com/)
- Check browser console for error messages

---

## Alternative: No Cloud Sync

If you don't want to set up Firebase, the app still works! It will:
- Load from `public/curriculum.json`
- Save to localStorage (device-only)
- Download `curriculum.json` when you click save
- Show "Local Only" mode

You can always enable cloud sync later.

