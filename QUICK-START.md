# 🚀 Quick Start Guide

## Running the App

```bash
cd my-tracker
npm start
```

Opens at `http://localhost:3000`

---

## Current Mode: Local Only 📁

Your app is currently in **Local Only** mode, which means:

- ✅ **Works immediately** - no setup needed
- ✅ **Edit and track tasks**
- ⚠️ **Changes only save on this device**
- ⚠️ **Must manually download/upload JSON files to sync**

You'll see **"Local Only"** indicator in the top right.

---

## Want Multi-Device Sync? ☁️

Enable **Cloud Sync** to edit from any device without manual file management!

### Benefits:
- 📱 Edit from phone, tablet, or any computer
- 🔄 Changes sync automatically
- 💾 No more downloading/uploading files
- 🆓 **100% FREE** with Firebase

### Setup (5 minutes):

Follow the step-by-step guide in **[CLOUD-SYNC-SETUP.md](./CLOUD-SYNC-SETUP.md)**

**TLDR:**
1. Create free Firebase project
2. Copy 6 config values
3. Create `.env` file with those values
4. Restart app
5. Done! See "Cloud Sync On" ✅

---

## Features

### Track Progress
- ✅ Click tasks to mark complete
- 📊 See progress percentage
- 🏆 Week completion badges

### View Subtasks
- Click ▶ chevron to expand detailed steps
- Each task has specific sub-actions

### Edit Mode
- Click **"Edit Mode"** button
- Modify task descriptions
- Add/remove subtasks
- Create new tasks
- **With Cloud Sync**: Saves to cloud automatically
- **Without Cloud Sync**: Downloads updated `curriculum.json`

---

## Files

```
my-tracker/
├── public/
│   └── curriculum.json          # Your curriculum data (local fallback)
├── src/
│   ├── AIEnablementTracker.tsx  # Main component
│   ├── firebase.ts              # Firebase config
│   └── index.css                # Styles with animations
├── CLOUD-SYNC-SETUP.md          # Detailed Firebase setup guide
├── CURRICULUM-GUIDE.md          # How to manage tasks manually
└── QUICK-START.md               # This file
```

---

## Need Help?

**Multi-Device Sync**: Read [CLOUD-SYNC-SETUP.md](./CLOUD-SYNC-SETUP.md)  
**Manual Editing**: Read [CURRICULUM-GUIDE.md](./CURRICULUM-GUIDE.md)  
**Issues**: Check browser console for errors

---

## Next Steps

1. **Try it out**: `npm start` and play with the app
2. **Enable cloud sync** (if you want multi-device)
3. **Start tracking** your AI learning journey!

Happy learning! 🎓

