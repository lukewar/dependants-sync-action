#!/usr/bin/env node

/*
  This script updates the "Initiative" field on project items (linked to issues)
  by copying the Initiative value from the top-level parent initiative issue.

  The logic is as follows:
  1. Retrieve the project details (fields and id) using the PROJECT_URL environment variable.
  2. Locate the Initiative field (by name "Initiative") and its options.
  3. Load all project items (with pagination).
  4. Iterate over every project item linked to an issue.
  5. For each issue, traverse its parent chain (using the sub_issues and issue_types APIs)
     until you find a parent whose Issue Type is "Initiative".
  6. If a parent initiative issue is found, locate its project item in the project and retrieve its
     Initiative field value.
  7. Update the currently processed project item to use that Initiative field value.
*/

const core = require("@actions/core");
const github = require("@actions/github");
const { URL } = require("url");

//
// Helper function to load all project items using pagination.
//
async function loadAllProjectItems(octokit, org, projectNumber) {
  let items = [];
  let after = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const itemsQuery = `
      query ($org: String!, $number: Int!, $after: String) {
         organization(login: $org) {
           projectV2(number: $number) {
             items(first: 100, after: $after) {
               nodes {
                 id
                 fieldValues(first: 10) {
                   nodes {
                     ... on ProjectV2ItemFieldSingleSelectValue {
                       field {
                         ... on ProjectV2SingleSelectField {
                           name
                           id
                         }
                       }
                       optionId
                     }
                   }
                 }
                 content {
                   ... on Issue {
                     id
                   }
                 }
               }
               pageInfo {
                 hasNextPage
                 endCursor
               }
             }
           }
         }
      }
    `;
    const variables = { org, number: projectNumber, after };
    const result = await octokit.graphql(itemsQuery, variables);
    const currentItems = result.organization.projectV2.items.nodes;
    items = items.concat(currentItems);
    const pageInfo = result.organization.projectV2.items.pageInfo;
    hasNextPage = pageInfo.hasNextPage;
    after = pageInfo.endCursor;
  }
  return items;
}

async function run() {
  try {
    // Ensure required environment variables are provided.
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is required");
    }
    const octokit = github.getOctokit(token);

    // ─── STEP 1. Retrieve project details (fields and id) using PROJECT_URL ─────
    const projectUrl = process.env.PROJECT_URL;
    if (!projectUrl) {
      throw new Error("PROJECT_URL is required in the environment.");
    }
    // Example URL (Organization project): https://github.com/orgs/my-org/projects/1
    const parsedUrl = new URL(projectUrl);
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    if (!(pathParts[0] === "orgs" && pathParts.length >= 3)) {
      throw new Error(`Cannot parse PROJECT_URL: ${projectUrl}`);
    }
    const orgLogin = pathParts[1];
    const projectNumber = parseInt(pathParts[3], 10);

    const projectDetailsQuery = `
      query ($org: String!, $number: Int!) {
        organization(login: $org) {
          projectV2(number: $number) {
            id
            fields(first: 20) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
                ... on ProjectV2FieldCommon {
                  id
                  name
                  __typename
                }
              }
            }
          }
        }
      }
    `;
    const projectDetailsVariables = { org: orgLogin, number: projectNumber };
    core.info("Querying project details...");
    const projectDetailsResult = await octokit.graphql(
      projectDetailsQuery,
      projectDetailsVariables
    );
    const projectData = projectDetailsResult.organization.projectV2;
    if (!projectData) {
      throw new Error("Unable to retrieve project details from the given URL.");
    }
    const projectId = projectData.id;
    core.info(`Found project id: ${projectId}`);

    // ─── STEP 2. Locate the Initiative field by name ─────────────────────────────
    const syncFields = process.env.SYNC_FIELDS ? process.env.SYNC_FIELDS.split(',').map(field => field.trim()) : [];
    const fieldsToSync = projectData.fields.nodes.filter(
      (field) => syncFields.includes(field.name) && field.__typename === "ProjectV2SingleSelectField"
    );

    if (fieldsToSync.length === 0) {
      throw new Error(
        'Could not find any valid single select fields to sync in the project.'
      );
    }
    core.info(`Found fields to sync: ${fieldsToSync.map(field => field.name).join(', ')}`);

    // ─── STEP 3. Load all project items with pagination ───────────────────────────
    core.info("Loading all project items...");
    const allItems = await loadAllProjectItems(
      octokit,
      orgLogin,
      projectNumber
    );
    projectData.items = { nodes: allItems };

    if (!projectData.items || projectData.items.nodes.length === 0) {
      core.info("No project items found in this project. Exiting.");
      return;
    }

    core.info(`Loaded ${allItems.length} project items.`);

    /**
     * Traverses an issue’s parent chain (using the sub_issues API) until it finds a parent
     * whose Issue Type is "Initiative". Returns the GraphQL id of that parent, or null if not found.
     *
     * @param {string} currentId - The current issue’s GraphQL node id.
     * @returns {Promise<string|null>}
     */
    async function findParentInitiativeIssue(currentId) {
      const topParentIssueType = process.env.TOP_PARENT_ISSUE_TYPE || "Initiative";
      const query = `
        query ($id: ID!) {
          node(id: $id) {
            ... on Issue {
              id
              number
              repository {
                nameWithOwner
              }
              parent {
                id
                number
                repository {
                  nameWithOwner
                }
                issueType {
                  id
                  name
                }
              }
            }
          }
        }
      `;
      const visited = new Set();
      const maxDepth = 50;
      let depth = 0;
      while (true) {
        if (visited.has(currentId)) {
          core.info(`Cycle detected at issue ${currentId}.`);
          return null;
        }
        if (depth > maxDepth) {
          core.info(`Maximum traversal depth of ${maxDepth} reached.`);
          return null;
        }
        visited.add(currentId);
        depth++;
        const result = await octokit.graphql(query, {
          id: currentId,
          headers: {
            "GraphQL-Features": "sub_issues,issue_types",
          },
        });
        const issue = result.node;
        if (!issue || !issue.parent) {
          core.info("No parent found.");
          return null;
        }
        const parent = issue.parent;
        try {
          const parentType = issue.parent.issueType;
          core.info(`Parent ${parent.id} has issue type "${parentType.name}"`);
          if (parentType.name === topParentIssueType) {
            return parent.id;
          }
        } catch (e) {
          core.info(
            `Failed to get issue type for parent ${parent.id}: ${e.message}`
          );
        }
        // Continue traversing upward.
        currentId = parent.id;
      }
    }

    /**
     * Retrieves the Initiative field value (option id) from a given project item.
     *
     * @param {object} projectItem - A project item node.
     * @param {string} fieldName - The name of the field to retrieve.
     * @returns {string|null} - The field value (option id), or null if not set.
     */
    function getFieldOptionIdFromItem(projectItem, fieldName) {
      if (!projectItem.fieldValues) return null;
      const fieldValue = projectItem.fieldValues.nodes.find(
        (node) => node.field && node.field.name === fieldName
      );
      return fieldValue && fieldValue.optionId
        ? fieldValue.optionId
        : null;
    }

    /**
     * Updates a field on a project item.
     *
     * @param {string} projectId - The project’s GraphQL id.
     * @param {string} itemId - The project item’s GraphQL id.
     * @param {string} fieldId - The field’s GraphQL id.
     * @param {string} optionId - The single-select option id to set.
     */
    async function updateProjectField(projectId, itemId, fieldId, optionId) {
      const mutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: $value
          }) {
            projectV2Item {
              id
            }
          }
        }
      `;
      const variables = {
        projectId,
        itemId,
        fieldId,
        value: { singleSelectOptionId: optionId },
      };
      const res = await octokit.graphql(mutation, variables);
      core.info(
        `Updated project item ${itemId} with field option id: ${optionId}.`
      );
      return res;
    }

    // Process each project item (child).
    for (const projectItem of projectData.items.nodes) {
      if (!projectItem.content) {
        core.info(
          `Skipping project item ${projectItem.id} because it has no linked content.`
        );
        continue;
      }
      const issueNodeId = projectItem.content.id;
      if (!issueNodeId) {
        core.info(
          `Skipping project item ${projectItem.id} because it has no issue content.`
        );
        continue;
      }
      core.info(
        `Processing project item ${projectItem.id} linked to issue ${issueNodeId}`
      );

      // Traverse the parent's chain until an Initiative is found.
      const parentInitiativeIssueId = await findParentInitiativeIssue(
        issueNodeId
      );
      if (!parentInitiativeIssueId) {
        core.info(
          `No Initiative parent found for issue ${issueNodeId}. Skipping update.`
        );
        continue;
      }
      core.info(
        `Found parent initiative issue with id: ${parentInitiativeIssueId}`
      );

      // Look up the Initiative parent's project item from the project data.
      const parentInitiativeProjectItem = projectData.items.nodes.find(
        (item) => item.content && item.content.id === parentInitiativeIssueId
      );
      if (!parentInitiativeProjectItem) {
        core.info(
          `No project item found for parent initiative issue ${parentInitiativeIssueId}. Skipping update.`
        );
        continue;
      }

      // Update the child project item with the field values from the parent initiative issue.
      for (const field of fieldsToSync) {
        const parentFieldValue = getFieldOptionIdFromItem(
          parentInitiativeProjectItem,
          field.name
        );
        if (!parentFieldValue) {
          core.info(
            `Parent initiative issue ${parentInitiativeIssueId} does not have a value set for field ${field.name}. Skipping update.`
          );
          continue;
        }
        core.info(
          `Parent initiative issue's ${field.name} field option id: ${parentFieldValue}`
        );

        await updateProjectField(
          projectId,
          projectItem.id,
          field.id,
          parentFieldValue
        );
      }
    }

    core.info("Update process completed for all project items.");
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = { run };

run();
