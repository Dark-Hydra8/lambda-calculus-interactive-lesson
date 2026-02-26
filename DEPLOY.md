# Deploying to GitHub Pages

This app can be deployed as a static site to **GitHub Pages** so it’s available at `https://<your-username>.github.io/lambda-calculus-interactive-lesson/`.

## 1. One-time setup

1. **Create a GitHub repo** (if you haven’t already) and push your code:
   ```bash
   git remote add origin https://github.com/yourusername/lambda-calculus-interactive-lesson.git
   git push -u origin main
   ```

2. **Set the `homepage` in `package.json`**  
   Replace `yourusername` with your GitHub username so it matches your repo:
   ```json
   "homepage": "https://yourusername.github.io/lambda-calculus-interactive-lesson"
   ```

3. **Install the deployment package:**
   ```bash
   npm install --save-dev gh-pages
   ```
   (The `deploy` and `predeploy` scripts are already in `package.json`.)

## 2. Deploy

From the project root:

```bash
npm run deploy
```

This will:

- Run `npm run build` (creates the `build` folder)
- Publish the contents of `build` to the `gh-pages` branch of your repo

## 3. Turn on GitHub Pages

1. On GitHub, open your repo → **Settings** → **Pages**.
2. Under **Source**, choose **Deploy from a branch**.
3. Branch: **gh-pages** (or **main** if you use that for the built site).
4. Folder: **/ (root)**.
5. Save. After a minute or two the site will be at:
   `https://yourusername.github.io/lambda-calculus-interactive-lesson/`

## 4. Later deployments

After the first time, you only need:

```bash
npm run deploy
```

whenever you want to update the live site.

## Optional: Deploy from GitHub Actions

To build and deploy on every push to `main` instead of running `npm run deploy` locally, you can add a workflow that builds the app and pushes to `gh-pages`. If you want that, say so and we can add the workflow file and steps.
