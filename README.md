# RastriyaSenaa Store — Fixed FINAL

## Admin protection
- `/admin/index.html`, `/admin/products.html`, `/admin/orders.html`, `/admin/admins.html`, and `/admin/settings.html` now redirect to `/admin/login.html` when no valid local admin session exists.
- Logout clears the session and redirects to login.
- Admin login requires the Google Apps Script API to be configured; there is no insecure demo-login fallback.

## Connect API
Edit `js/app.js`:
`const API_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL";`

Then deploy `backend/Code.gs` as a Google Apps Script Web App.

## First Super Admin
Run `setupStore()` once. Create the first Super Admin in the `Admins` sheet using a SHA-256 password hash, or use the secured admin-creation endpoint after your initial setup.

Do not publish `ADMIN_SECRET` or your spreadsheet ID publicly.

## Important production note
The browser-side local session is only a frontend gate. For a real production store, every admin mutation must also be authorized server-side using a signed/session token; never trust a role stored only in localStorage.


## Secure product image upload
- Admin Panel no longer asks for an image URL.
- Product form has a file upload field.
- The image is sent to Apps Script and stored in a configured Google Drive folder.
- Only JPG/PNG/WEBP/GIF images under 5 MB are accepted.
- Product sheet stores the generated Drive view URL.
- Admin mutations use a short-lived server-side Apps Script session token stored in CacheService.

### Configure Drive
In `backend/Code.gs` set:
`DRIVE_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID';`

Create a dedicated Drive folder for store product images. Apps Script will upload images there.

### Important security note
The public product image needs to be readable by website visitors, so uploaded product files are set to `Anyone with the link: Viewer`. The Drive folder itself does not need to be public. Admin write operations are authenticated server-side with the session token.
