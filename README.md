# 🚀 Dependants Sync Action

Automates the synchronization of fields in GitHub Projects between parent issues and their dependents.

## 📦 Features
- Syncs fields like `Initiative`, `Labels`, `Assignees`, etc. (TODO: currenlty hardcoded to `Initiative`)
- Uses GitHub GraphQL API with `sub_issues` and `issue_types`.

## ⚡ Usage

1. Fork the repo or install as a GitHub Action.
2. Add the following secrets to your repository:
   - `GITHUB_TOKEN` - GitHub token with project access.
   - `PROJECT_URL` - The URL of your GitHub Project.
   - `SYNC_FIELDS` - Comma-separated list of single select fields to synchronize.

3. The workflow runs every 15 minutes automatically.

## 🔧 Local Testing

```bash
npm install
GITHUB_TOKEN=your_token PROJECT_URL=https://github.com/orgs/my-org/projects/1 SYNC_FIELDS=Initiative,Labels node src/dependants-sync.js
```

## 🧪 Running Tests

To run tests locally, use the following command:

```bash
npm test
```
