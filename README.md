# 🚀 Dependants Sync Action

Automates the synchronization of fields in GitHub Projects between parent issues and their dependents.

## 📦 Features
- Syncs Project single-select fields, such as `Initiative`, `Team`, and `Quarter`, copying them from the top-level parent (identified by `TOP_PARENT_ISSUE_TYPE`)
- Uses GitHub GraphQL API with `sub_issues` and `issue_types`.

## ⚡ Usage

1. Fork the repo or clone it locally.
2. Add the following secrets to your environment:
   - `GITHUB_TOKEN` - GitHub token with project access.
   - `PROJECT_URL` - The URL of your GitHub Project.
   - `SYNC_FIELDS` - Comma-separated list of single select fields to synchronize.
   - `TOP_PARENT_ISSUE_TYPE` - The Issue Type to use to determine the top parent issue (default: `Initiative`).

3. Run the script locally.

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

## 📄 Using the action.yml file

The `action.yml` file defines the metadata for the Dependants Sync Action, including the inputs and the main entry point for the action. This file is essential for integrating the action with GitHub Actions.

### Example Workflow

Here is an example of how to use the Dependants Sync Action in a GitHub Actions workflow:

```yaml
name: Dependants Sync Action

on:
  schedule:
    - cron: '*/15 * * * *'  # Runs every 15 minutes
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Dependants Sync Action
        uses: lukewar/dependants-sync-action@e7a0754016569c060a1e7931a533271543ef7d51
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PROJECT_URL: ${{ secrets.PROJECT_URL }}
          SYNC_FIELDS: ${{ secrets.SYNC_FIELDS }}
          TOP_PARENT_ISSUE_TYPE: ${{ secrets.TOP_PARENT_ISSUE_TYPE }}
```
