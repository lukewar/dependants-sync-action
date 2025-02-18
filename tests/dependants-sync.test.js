const { run } = require('../src/dependants-sync');
const core = require('@actions/core');
const github = require('@actions/github');

jest.mock('@actions/core');
jest.mock('@actions/github');

describe('dependants-sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should throw an error if GITHUB_TOKEN is not provided', async () => {
    process.env.GITHUB_TOKEN = '';
    await run()
    expect(core.setFailed).toHaveBeenCalledWith('GITHUB_TOKEN is required');
  });

  test('should throw an error if PROJECT_URL is not provided', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.PROJECT_URL = '';
    await run()
    expect(core.setFailed).toHaveBeenCalledWith('PROJECT_URL is required in the environment.');
  });

  test('should throw an error if PROJECT_URL is invalid', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.PROJECT_URL = 'https://github.com/my-org/projects/1';
    await run()
    expect(core.setFailed).toHaveBeenCalledWith('Cannot parse PROJECT_URL: https://github.com/my-org/projects/1');
  });

  test('should log project details', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.PROJECT_URL = 'https://github.com/orgs/my-org/projects/1';

    github.getOctokit.mockReturnValue({
      graphql: jest.fn().mockResolvedValue({
        organization: {
          projectV2: {
            id: 'project-id',
            fields: {
              nodes: [
                {
                  id: 'field-id',
                  name: 'Initiative',
                  options: [
                    { id: 'option-id', name: 'Option' }
                  ],
                  __typename: 'ProjectV2SingleSelectField'
                }
              ]
            },
            items: {
              nodes: []
            }
          }
        }
      })
    });

    await run();

    expect(core.info).toHaveBeenCalledWith('Querying project details...');
    expect(core.info).toHaveBeenCalledWith('Found project id: project-id');
  });

  test('should use TOP_PARENT_ISSUE_TYPE environment variable', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.PROJECT_URL = 'https://github.com/orgs/my-org/projects/1';
    process.env.TOP_PARENT_ISSUE_TYPE = 'Epic';

    github.getOctokit.mockReturnValue({
      graphql: jest.fn().mockResolvedValue({
        organization: {
          projectV2: {
            id: 'project-id',
            fields: {
              nodes: [
                {
                  id: 'field-id',
                  name: 'Initiative',
                  options: [
                    { id: 'option-id', name: 'Option' }
                  ],
                  __typename: 'ProjectV2SingleSelectField'
                }
              ]
            },
            items: {
              nodes: []
            }
          }
        }
      })
    });

    await run();

    expect(core.info).toHaveBeenCalledWith('Querying project details...');
    expect(core.info).toHaveBeenCalledWith('Found project id: project-id');
  });
});
