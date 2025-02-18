# 🚀 Dependants Sync Action

Automates the synchronization of fields in GitHub Projects between parent issues and their dependents.

## 📦 Features
- Syncs Project single-select fields, such as `Initiative`, `Team`, and `Quarter`, copying them from the top-level parent (identified by `TOP_PARENT_ISSUE_TYPE`)
- Uses GitHub GraphQL API with `sub_issues` and `issue_types`.

## ⚡ Usage

1. Fork the repo or install as a GitHub Action.
2. Add the following secrets to your repository:
   - `GITHUB_TOKEN` - GitHub token with project access.
   - `PROJECT_URL` - The URL of your GitHub Project.
   - `SYNC_FIELDS` - Comma-separated list of single select fields to synchronize.
   - `TOP_PARENT_ISSUE_TYPE` - The Issue Type to use to determine the top parent issue (default: `Initiative`).

3. Run workflow every X minutes.

## 🔧 Local Testing

```bash
npm install
GITHUB_TOKEN=your_token PROJECT_URL=https://github.com/orgs/my-org/projects/1 SYNC_FIELDS=Initiative,Team TOP_PARENT_ISSUE_TYPE=Initiative node src/dependants-sync.js
```

## 🧪 Running Tests

To run tests locally, use the following command:

```bash
npm test
```
