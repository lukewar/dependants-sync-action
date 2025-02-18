const { run } = require("../../src/dependants-sync");
const core = require("@actions/core");
const github = require("@actions/github");

jest.mock("@actions/core");
jest.mock("@actions/github");

describe("dependants-sync integration tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should successfully synchronize fields", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.PROJECT_URL = "https://github.com/orgs/my-org/projects/1";

    const mockGraphql = jest
      .fn()
      .mockResolvedValueOnce({
        organization: {
          projectV2: {
            id: "project-id",
            fields: {
              nodes: [
                {
                  id: "field-id",
                  name: "Initiative",
                  options: [{ id: "option-id", name: "Option" }],
                },
              ],
            },
            items: {
              nodes: [],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        organization: {
          projectV2: {
            items: {
              nodes: [
                {
                  id: "item-id-1",
                  fieldValues: {
                    nodes: [],
                  },
                  content: {
                    id: "issue-id-1",
                  },
                },
                {
                  id: "item-id-2",
                  fieldValues: {
                    nodes: [
                      {
                        field: {
                          name: "Initiative",
                        },
                        optionId: "option-id",
                      },
                    ],
                  },
                  content: {
                    id: "issue-id-2",
                  },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        node: {
          id: "issue-id-1",
          parent: {
            id: "parent-issue-id-1",
            issueType: {
              name: "Initiative",
            },
          },
        },
      })
      .mockResolvedValueOnce({
        node: {
          id: "issue-id-2",
          parent: {
            id: "parent-issue-id-2",
            issueType: {
              name: "Initiative",
            },
          },
        },
      });

    github.getOctokit.mockReturnValue({
      graphql: mockGraphql,
    });

    await run();

    expect(core.info).toHaveBeenCalledWith("Querying project details...");
    expect(core.info).toHaveBeenCalledWith("Found project id: project-id");
    expect(core.info).toHaveBeenCalledWith("Loading all project items...");
    expect(core.info).toHaveBeenCalledWith("Loaded 2 project items.");
    expect(core.info).toHaveBeenCalledWith(
      "Found Initiative field with id: field-id"
    );
    expect(core.info).toHaveBeenCalledWith(
      "Processing project item item-id-1 linked to issue issue-id-1"
    );
    expect(core.info).toHaveBeenCalledWith(
      'Parent parent-issue-id-1 has issue type "Initiative"'
    );
    expect(core.info).toHaveBeenCalledWith(
      "Found parent initiative issue with id: parent-issue-id-1"
    );
    expect(core.info).toHaveBeenCalledWith(
      "No project item found for parent initiative issue parent-issue-id-1. Skipping update."
    );
    expect(core.info).toHaveBeenCalledWith(
      "Processing project item item-id-2 linked to issue issue-id-2"
    );
    expect(core.info).toHaveBeenCalledWith(
      'Parent parent-issue-id-2 has issue type "Initiative"'
    );
    expect(core.info).toHaveBeenCalledWith(
      "Found parent initiative issue with id: parent-issue-id-2"
    );
    expect(core.info).toHaveBeenCalledWith(
      "No project item found for parent initiative issue parent-issue-id-2. Skipping update.",
    );
    expect(core.info).toHaveBeenCalledWith(
      "Update process completed for all project items."
    );

    expect(mockGraphql).toHaveBeenCalledTimes(4);
  });

  test("should handle missing fields gracefully", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.PROJECT_URL = "https://github.com/orgs/my-org/projects/1";

    const mockGraphql = jest.fn().mockResolvedValueOnce({
      organization: {
        projectV2: {
          id: "project-id",
          fields: {
            nodes: [],
          },
          items: {
            nodes: [],
          },
        },
      },
    });

    github.getOctokit.mockReturnValue({
      graphql: mockGraphql,
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      "Cannot read properties of undefined (reading 'organization')"
    );
  });

  test("should traverse parent issues structure for 3 levels deep", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.PROJECT_URL = "https://github.com/orgs/my-org/projects/1";

    const mockGraphql = jest
      .fn()
      .mockResolvedValueOnce({
        organization: {
          projectV2: {
            id: "project-id",
            fields: {
              nodes: [
                {
                  id: "field-id",
                  name: "Initiative",
                  options: [{ id: "option-id", name: "Option" }],
                },
              ],
            },
            items: {
              nodes: [],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        organization: {
          projectV2: {
            items: {
              nodes: [
                {
                  id: "item-id-1",
                  fieldValues: {
                    nodes: [],
                  },
                  content: {
                    id: "issue-id-1",
                  },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        node: {
          id: "issue-id-1",
          parent: {
            id: "parent-issue-id-1",
            issueType: {
              name: "Task",
            },
          },
        },
      })
      .mockResolvedValueOnce({
        node: {
          id: "parent-issue-id-1",
          parent: {
            id: "grandparent-issue-id-1",
            issueType: {
              name: "Task",
            },
          },
        },
      })
      .mockResolvedValueOnce({
        node: {
          id: "grandparent-issue-id-1",
          parent: {
            id: "greatgrandparent-issue-id-1",
            issueType: {
              name: "Initiative",
            },
          },
        },
      });

    github.getOctokit.mockReturnValue({
      graphql: mockGraphql,
    });

    await run();

    expect(core.info).toHaveBeenCalledWith("Querying project details...");
    expect(core.info).toHaveBeenCalledWith("Found project id: project-id");
    expect(core.info).toHaveBeenCalledWith("Loading all project items...");
    expect(core.info).toHaveBeenCalledWith("Loaded 1 project items.");
    expect(core.info).toHaveBeenCalledWith(
      "Found Initiative field with id: field-id"
    );
    expect(core.info).toHaveBeenCalledWith(
      "Processing project item item-id-1 linked to issue issue-id-1"
    );
    expect(core.info).toHaveBeenCalledWith(
      'Parent parent-issue-id-1 has issue type "Task"'
    );
    expect(core.info).toHaveBeenCalledWith(
      'Parent grandparent-issue-id-1 has issue type "Task"'
    );
    expect(core.info).toHaveBeenCalledWith(
      'Parent greatgrandparent-issue-id-1 has issue type "Initiative"'
    );
    expect(core.info).toHaveBeenCalledWith(
      "Found parent initiative issue with id: greatgrandparent-issue-id-1"
    );
    expect(core.info).toHaveBeenCalledWith(
      "No project item found for parent initiative issue greatgrandparent-issue-id-1. Skipping update."
    );
    expect(core.info).toHaveBeenCalledWith(
      "Update process completed for all project items."
    );

    expect(mockGraphql).toHaveBeenCalledTimes(5);
  });
});
