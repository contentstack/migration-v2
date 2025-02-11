# @contentstack/cli

Use Contentstack Command-line Interface to command Contentstack for executing a set of operations from the terminal. To get started with CLI, refer to the [CLI’s documentation](https://www.contentstack.com/docs/developers/cli)

[![License](https://img.shields.io/npm/l/@contentstack/cli)](https://github.com/contentstack/cli/blob/main/LICENSE)

<!-- toc -->
* [@contentstack/cli](#contentstackcli)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g @contentstack/cli
$ csdx COMMAND
running command...
$ csdx (--version|-v)
@contentstack/cli/1.23.0 darwin-arm64 node-v20.9.0
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`csdx audit`](#csdx-audit)
* [`csdx audit:fix`](#csdx-auditfix)
* [`csdx auth:login`](#csdx-authlogin)
* [`csdx auth:logout`](#csdx-authlogout)
* [`csdx auth:tokens`](#csdx-authtokens)
* [`csdx auth:tokens:add [-a <value>] [--delivery] [--management] [-e <value>] [-k <value>] [-y] [--token <value>]`](#csdx-authtokensadd--a-value---delivery---management--e-value--k-value--y---token-value)
* [`csdx auth:tokens:remove`](#csdx-authtokensremove)
* [`csdx auth:whoami`](#csdx-authwhoami)
* [`csdx cm:stacks:import [-c <value>] [-k <value>] [-d <value>] [-a <value>] [--module <value>] [--backup-dir <value>] [--branch <value>] [--import-webhook-status disable|current]`](#csdx-cmstacksimport--c-value--k-value--d-value--a-value---module-value---backup-dir-value---branch-value---import-webhook-status-disablecurrent)
* [`csdx cm:stacks:audit`](#csdx-cmstacksaudit)
* [`csdx cm:stacks:audit:fix`](#csdx-cmstacksauditfix)
* [`csdx cm:stacks:import [-c <value>] [-k <value>] [-d <value>] [-a <value>] [--module <value>] [--backup-dir <value>] [--branch <value>] [--import-webhook-status disable|current]`](#csdx-cmstacksimport--c-value--k-value--d-value--a-value---module-value---backup-dir-value---branch-value---import-webhook-status-disablecurrent-1)
* [`csdx config:get:base-branch`](#csdx-configgetbase-branch)
* [`csdx config:get:ea-header`](#csdx-configgetea-header)
* [`csdx config:get:early-access-header`](#csdx-configgetearly-access-header)
* [`csdx config:get:region`](#csdx-configgetregion)
* [`csdx config:remove:base-branch`](#csdx-configremovebase-branch)
* [`csdx config:remove:ea-header`](#csdx-configremoveea-header)
* [`csdx config:remove:early-access-header`](#csdx-configremoveearly-access-header)
* [`csdx config:set:base-branch`](#csdx-configsetbase-branch)
* [`csdx config:set:ea-header`](#csdx-configsetea-header)
* [`csdx config:set:early-access-header`](#csdx-configsetearly-access-header)
* [`csdx config:set:region [REGION]`](#csdx-configsetregion-region)
* [`csdx help [COMMANDS]`](#csdx-help-commands)
* [`csdx login`](#csdx-login)
* [`csdx logout`](#csdx-logout)
* [`csdx plugins`](#csdx-plugins)
* [`csdx plugins:add PLUGIN`](#csdx-pluginsadd-plugin)
* [`csdx plugins:inspect PLUGIN...`](#csdx-pluginsinspect-plugin)
* [`csdx plugins:install PLUGIN`](#csdx-pluginsinstall-plugin)
* [`csdx plugins:link PATH`](#csdx-pluginslink-path)
* [`csdx plugins:remove [PLUGIN]`](#csdx-pluginsremove-plugin)
* [`csdx plugins:reset`](#csdx-pluginsreset)
* [`csdx plugins:uninstall [PLUGIN]`](#csdx-pluginsuninstall-plugin)
* [`csdx plugins:unlink [PLUGIN]`](#csdx-pluginsunlink-plugin)
* [`csdx plugins:update`](#csdx-pluginsupdate)
* [`csdx tokens`](#csdx-tokens)
* [`csdx whoami`](#csdx-whoami)

## `csdx audit`

Perform audits and find possible errors in the exported Contentstack data

```
USAGE
  $ csdx audit [--report-path <value>] [--modules
    content-types|global-fields|entries|extensions|workflows...] [--columns <value> | ] [--sort <value>] [--filter
    <value>] [--csv | --no-truncate]

FLAGS
  --modules=<option>...  Provide the list of modules to be audited
                         <options: content-types|global-fields|entries|extensions|workflows>
  --report-path=<value>  Path to store the audit reports

TABLE FLAGS
  --columns=<value>  Show only the specified columns (comma-separated)
  --csv              The output is in the CSV format [alias: --output=csv]
  --filter=<value>   Filter property by partial string matching. For example: name=foo
  --no-truncate      The output is not truncated to fit the screen
  --sort=<value>     Property to sort by (prepend '-' for descending)

DESCRIPTION
  Perform audits and find possible errors in the exported Contentstack data

ALIASES
  $ csdx audit
  $ csdx cm:stacks:audit

EXAMPLES
  $ csdx audit

  $ csdx audit --report-path=<path>

  $ csdx audit --report-path=<path> --csv

  $ csdx audit --report-path=<path> --filter="name=<filter-value>"

  $ csdx audit --report-path=<path> --modules=content-types --filter="name="<filter-value>"
```

## `csdx audit:fix`

Perform audits and fix possible errors in the exported Contentstack data.

```
USAGE
  $ csdx audit:fix [--report-path <value>] [--modules
    content-types|global-fields|entries|extensions|workflows...] [--copy-path <value> --copy-dir] [--fix-only
    reference|global_field|json:rte|json:extension|blocks|group|content_types...] [--columns <value> | ] [--sort
    <value>] [--filter <value>] [--csv | --no-truncate]

FLAGS
  --copy-dir              Create backup from the original data.
  --copy-path=<value>     Provide the path to backup the copied data
  --fix-only=<option>...  Provide the list of fix options
                          <options: reference|global_field|json:rte|json:extension|blocks|group|content_types>
  --modules=<option>...   Provide the list of modules to be audited
                          <options: content-types|global-fields|entries|extensions|workflows>
  --report-path=<value>   Path to store the audit reports

TABLE FLAGS
  --columns=<value>  Show only the specified columns (comma-separated)
  --csv              The output is in the CSV format [alias: --output=csv]
  --filter=<value>   Filter property by partial string matching. For example: name=foo
  --no-truncate      The output is not truncated to fit the screen
  --sort=<value>     Property to sort by (prepend '-' for descending)

DESCRIPTION
  Perform audits and fix possible errors in the exported Contentstack data.

ALIASES
  $ csdx audit:fix
  $ csdx cm:stacks:audit:fix

EXAMPLES
  $ csdx audit:fix --copy-dir

  $ csdx audit:fix --report-path=<path> --copy-dir

  $ csdx audit:fix --report-path=<path> --copy-dir --csv

  $ csdx audit:fix --fix-only=reference,global_field --copy-dir

  $ csdx audit:fix --report-path=<path> --filter="name=<filter-value>"

  $ csdx audit:fix --report-path=<path> --modules=content-types --filter="name="<filter-value>" --copy-dir --copy-path=<path>
```

## `csdx auth:login`

User sessions login

```
USAGE
  $ csdx auth:login [-u <value> | --oauth] [-p <value> | ]

FLAGS
  -p, --password=<value>  Password
  -u, --username=<value>  User name
      --oauth             Enables single sign-on (SSO) in Contentstack CLI

DESCRIPTION
  User sessions login

ALIASES
  $ csdx login

EXAMPLES
  $ csdx auth:login

  $ csdx auth:login -u <username>

  $ csdx auth:login -u <username> -p <password>

  $ csdx auth:login --username <username>

  $ csdx auth:login --username <username> --password <password>
```

_See code: [@contentstack/cli-auth](https://github.com/contentstack/cli/blob/main/packages/contentstack-auth/src/commands/auth/login.ts)_

## `csdx auth:logout`

User session logout

```
USAGE
  $ csdx auth:logout [-y]

FLAGS
  -y, --yes  Force log out by skipping the confirmation

DESCRIPTION
  User session logout

ALIASES
  $ csdx logout

EXAMPLES
  $ csdx auth:logout

  $ csdx auth:logout -y

  $ csdx auth:logout --yes
```

_See code: [@contentstack/cli-auth](https://github.com/contentstack/cli/blob/main/packages/contentstack-auth/src/commands/auth/logout.ts)_

## `csdx auth:tokens`

Lists all existing tokens added to the session

```
USAGE
  $ csdx auth:tokens [--columns <value> | -x] [--filter <value>] [--no-header | [--csv | --no-truncate]]
    [--output csv|json|yaml |  | ] [--sort <value>]

FLAGS
  -x, --extended         show extra columns
      --columns=<value>  only show provided columns (comma-separated)
      --csv              output is csv format [alias: --output=csv]
      --filter=<value>   filter property by partial string matching, ex: name=foo
      --no-header        hide table header from output
      --no-truncate      do not truncate output to fit screen
      --output=<option>  output in a more machine friendly format
                         <options: csv|json|yaml>
      --sort=<value>     property to sort by (prepend '-' for descending)

DESCRIPTION
  Lists all existing tokens added to the session

ALIASES
  $ csdx tokens

EXAMPLES
  $ csdx auth:tokens
```

_See code: [@contentstack/cli-auth](https://github.com/contentstack/cli/blob/main/packages/contentstack-auth/src/commands/auth/tokens/index.ts)_

## `csdx auth:tokens:add [-a <value>] [--delivery] [--management] [-e <value>] [-k <value>] [-y] [--token <value>]`

Adds management/delivery tokens to your session to use it with other CLI commands

```
USAGE
  $ csdx auth:tokens:add [-a <value>] [--delivery] [--management] [-e <value>] [-k <value>] [-y] [--token <value>]

FLAGS
  -a, --alias=<value>          Name of the token alias
  -d, --delivery               Set this flag to save delivery token
  -e, --environment=<value>    Environment name for delivery token
  -k, --stack-api-key=<value>  Stack API Key
  -m, --management             Set this flag to save management token
  -t, --token=<value>          Add the token name
  -y, --yes                    Use this flag to skip confirmation

DESCRIPTION
  Adds management/delivery tokens to your session to use it with other CLI commands

EXAMPLES
  $ csdx auth:tokens:add

  $ csdx auth:tokens:add -a <alias>

  $ csdx auth:tokens:add -k <stack api key>

  $ csdx auth:tokens:add --delivery

  $ csdx auth:tokens:add --management

  $ csdx auth:tokens:add -e <environment>

  $ csdx auth:tokens:add --token <token>

  $ csdx auth:tokens:add -a <alias> -k <stack api key> --management --token <management token>

  $ csdx auth:tokens:add -a <alias> -k <stack api key> --delivery -e <environment> --token <delivery token>

  $ csdx auth:tokens:add --alias <alias> --stack-api-key <stack api key> --management --token <management token>

  $ csdx auth:tokens:add --alias <alias> --stack-api-key <stack api key> --delivery -e <environment> --token <delivery token>
```

_See code: [@contentstack/cli-auth](https://github.com/contentstack/cli/blob/main/packages/contentstack-auth/src/commands/auth/tokens/add.ts)_

## `csdx auth:tokens:remove`

Removes selected tokens

```
USAGE
  $ csdx auth:tokens:remove [-a <value>] [-i]

FLAGS
  -a, --alias=<value>  Token alias
  -i, --ignore         Ignore

DESCRIPTION
  Removes selected tokens

EXAMPLES
  $ csdx auth:tokens:remove

  $ csdx auth:tokens:remove -a <alias>
```

_See code: [@contentstack/cli-auth](https://github.com/contentstack/cli/blob/main/packages/contentstack-auth/src/commands/auth/tokens/remove.ts)_

## `csdx auth:whoami`

Display current users email address

```
USAGE
  $ csdx auth:whoami

DESCRIPTION
  Display current users email address

ALIASES
  $ csdx whoami

EXAMPLES
  $ csdx auth:whoami
```

_See code: [@contentstack/cli-auth](https://github.com/contentstack/cli/blob/main/packages/contentstack-auth/src/commands/auth/whoami.ts)_

## `csdx cm:stacks:import [-c <value>] [-k <value>] [-d <value>] [-a <value>] [--module <value>] [--backup-dir <value>] [--branch <value>] [--import-webhook-status disable|current]`

Import content from a stack

```
USAGE
  $ csdx cm:import cm:stacks:import [-c <value>] [-k <value>] [-d <value>] [-a <value>] [--module <value>]
    [--backup-dir <value>] [--branch <value>] [--import-webhook-status disable|current]

FLAGS
  -B, --branch=<value>                  [optional] branch name
  -a, --alias=<value>                   alias of the management token
  -b, --backup-dir=<value>              [optional] backup directory name when using specific module
  -c, --config=<value>                  [optional] path of config file
  -d, --data-dir=<value>                path and location where data is stored
  -k, --stack-api-key=<value>           API key of the target stack
  -m, --module=<value>                  [optional] specific module name
  -y, --yes                             [optional] Override marketplace prompts
      --exclude-global-modules          Excludes the branch-independent module from the import operation
      --import-webhook-status=<option>  [default: disable] [optional] Webhook state
                                        <options: disable|current>
      --replace-existing                Replaces the existing module in the target stack.
      --skip-app-recreation             [optional] Skip private apps recreation if already exist
      --skip-audit                      Skips the audit fix.
      --skip-existing                   Skips the module exists warning messages.

DESCRIPTION
  Import content from a stack

ALIASES
  $ csdx cm:import

EXAMPLES
  $ csdx cm:stacks:import --stack-api-key <stack_api_key> --data-dir <path/of/export/destination/dir>

  $ csdx cm:stacks:import --config <path/of/config/dir>

  $ csdx cm:stacks:import --module <single module name>

  $ csdx cm:stacks:import --module <single module name> --backup-dir <backup dir>

  $ csdx cm:stacks:import --alias <management_token_alias>

  $ csdx cm:stacks:import --alias <management_token_alias> --data-dir <path/of/export/destination/dir>

  $ csdx cm:stacks:import --alias <management_token_alias> --config <path/of/config/file>

  $ csdx cm:stacks:import --branch <branch name>  --yes --skip-audit
```

## `csdx cm:stacks:audit`

Perform audits and find possible errors in the exported Contentstack data

```
USAGE
  $ csdx cm:stacks:audit [--report-path <value>] [--modules
    content-types|global-fields|entries|extensions|workflows...] [--columns <value> | ] [--sort <value>] [--filter
    <value>] [--csv | --no-truncate]

FLAGS
  --modules=<option>...  Provide the list of modules to be audited
                         <options: content-types|global-fields|entries|extensions|workflows>
  --report-path=<value>  Path to store the audit reports

TABLE FLAGS
  --columns=<value>  Show only the specified columns (comma-separated)
  --csv              The output is in the CSV format [alias: --output=csv]
  --filter=<value>   Filter property by partial string matching. For example: name=foo
  --no-truncate      The output is not truncated to fit the screen
  --sort=<value>     Property to sort by (prepend '-' for descending)

DESCRIPTION
  Perform audits and find possible errors in the exported Contentstack data

ALIASES
  $ csdx audit
  $ csdx cm:stacks:audit

EXAMPLES
  $ csdx cm:stacks:audit

  $ csdx cm:stacks:audit --report-path=<path>

  $ csdx cm:stacks:audit --report-path=<path> --csv

  $ csdx cm:stacks:audit --report-path=<path> --filter="name=<filter-value>"

  $ csdx cm:stacks:audit --report-path=<path> --modules=content-types --filter="name="<filter-value>"
```

_See code: [@contentstack/cli-audit](https://github.com/contentstack/audit/blob/main/packages/contentstack-audit/src/commands/cm/stacks/audit/index.ts)_

## `csdx cm:stacks:audit:fix`

Perform audits and fix possible errors in the exported Contentstack data.

```
USAGE
  $ csdx cm:stacks:audit:fix [--report-path <value>] [--modules
    content-types|global-fields|entries|extensions|workflows...] [--copy-path <value> --copy-dir] [--fix-only
    reference|global_field|json:rte|json:extension|blocks|group|content_types...] [--columns <value> | ] [--sort
    <value>] [--filter <value>] [--csv | --no-truncate]

FLAGS
  --copy-dir              Create backup from the original data.
  --copy-path=<value>     Provide the path to backup the copied data
  --fix-only=<option>...  Provide the list of fix options
                          <options: reference|global_field|json:rte|json:extension|blocks|group|content_types>
  --modules=<option>...   Provide the list of modules to be audited
                          <options: content-types|global-fields|entries|extensions|workflows>
  --report-path=<value>   Path to store the audit reports

TABLE FLAGS
  --columns=<value>  Show only the specified columns (comma-separated)
  --csv              The output is in the CSV format [alias: --output=csv]
  --filter=<value>   Filter property by partial string matching. For example: name=foo
  --no-truncate      The output is not truncated to fit the screen
  --sort=<value>     Property to sort by (prepend '-' for descending)

DESCRIPTION
  Perform audits and fix possible errors in the exported Contentstack data.

ALIASES
  $ csdx audit:fix
  $ csdx cm:stacks:audit:fix

EXAMPLES
  $ csdx cm:stacks:audit:fix --copy-dir

  $ csdx cm:stacks:audit:fix --report-path=<path> --copy-dir

  $ csdx cm:stacks:audit:fix --report-path=<path> --copy-dir --csv

  $ csdx cm:stacks:audit:fix --fix-only=reference,global_field --copy-dir

  $ csdx cm:stacks:audit:fix --report-path=<path> --filter="name=<filter-value>"

  $ csdx cm:stacks:audit:fix --report-path=<path> --modules=content-types --filter="name="<filter-value>" --copy-dir --copy-path=<path>
```

_See code: [@contentstack/cli-audit](https://github.com/contentstack/audit/blob/main/packages/contentstack-audit/src/commands/cm/stacks/audit/fix.ts)_

## `csdx cm:stacks:import [-c <value>] [-k <value>] [-d <value>] [-a <value>] [--module <value>] [--backup-dir <value>] [--branch <value>] [--import-webhook-status disable|current]`

Import content from a stack

```
USAGE
  $ csdx cm:stacks:import [-c <value>] [-k <value>] [-d <value>] [-a <value>] [--module <value>] [--backup-dir
    <value>] [--branch <value>] [--import-webhook-status disable|current]

FLAGS
  -B, --branch=<value>                  [optional] branch name
  -a, --alias=<value>                   alias of the management token
  -b, --backup-dir=<value>              [optional] backup directory name when using specific module
  -c, --config=<value>                  [optional] path of config file
  -d, --data-dir=<value>                path and location where data is stored
  -k, --stack-api-key=<value>           API key of the target stack
  -m, --module=<value>                  [optional] specific module name
  -y, --yes                             [optional] Override marketplace prompts
      --exclude-global-modules          Excludes the branch-independent module from the import operation
      --import-webhook-status=<option>  [default: disable] [optional] Webhook state
                                        <options: disable|current>
      --replace-existing                Replaces the existing module in the target stack.
      --skip-app-recreation             [optional] Skip private apps recreation if already exist
      --skip-audit                      Skips the audit fix.
      --skip-existing                   Skips the module exists warning messages.

DESCRIPTION
  Import content from a stack

ALIASES
  $ csdx cm:import

EXAMPLES
  $ csdx cm:stacks:import --stack-api-key <stack_api_key> --data-dir <path/of/export/destination/dir>

  $ csdx cm:stacks:import --config <path/of/config/dir>

  $ csdx cm:stacks:import --module <single module name>

  $ csdx cm:stacks:import --module <single module name> --backup-dir <backup dir>

  $ csdx cm:stacks:import --alias <management_token_alias>

  $ csdx cm:stacks:import --alias <management_token_alias> --data-dir <path/of/export/destination/dir>

  $ csdx cm:stacks:import --alias <management_token_alias> --config <path/of/config/file>

  $ csdx cm:stacks:import --branch <branch name>  --yes --skip-audit
```

_See code: [@contentstack/cli-cm-import](https://github.com/contentstack/cli/blob/main/packages/contentstack-import/src/commands/cm/stacks/import.ts)_

## `csdx config:get:base-branch`

Get current branch set for CLI

```
USAGE
  $ csdx config:get:base-branch

DESCRIPTION
  Get current branch set for CLI

EXAMPLES
  $ csdx config:get:base-branch
```

_See code: [@contentstack/cli-config](https://github.com/contentstack/cli/blob/main/packages/contentstack-config/src/commands/config/get/base-branch.ts)_

## `csdx config:get:ea-header`

Display Early Access headers

```
USAGE
  $ csdx config:get:ea-header

DESCRIPTION
  Display Early Access headers

ALIASES
  $ csdx config:get:ea-header

EXAMPLES
  $ csdx config:get:ea-header
```

## `csdx config:get:early-access-header`

Display Early Access headers

```
USAGE
  $ csdx config:get:early-access-header

DESCRIPTION
  Display Early Access headers

ALIASES
  $ csdx config:get:ea-header

EXAMPLES
  $ csdx config:get:early-access-header
```

_See code: [@contentstack/cli-config](https://github.com/contentstack/cli/blob/main/packages/contentstack-config/src/commands/config/get/early-access-header.ts)_

## `csdx config:get:region`

Get current region set for CLI

```
USAGE
  $ csdx config:get:region

DESCRIPTION
  Get current region set for CLI

EXAMPLES
  $ csdx config:get:region
```

_See code: [@contentstack/cli-config](https://github.com/contentstack/cli/blob/main/packages/contentstack-config/src/commands/config/get/region.ts)_

## `csdx config:remove:base-branch`

Remove branch config for CLI

```
USAGE
  $ csdx config:remove:base-branch [-k <value>] [-y]

FLAGS
  -k, --stack-api-key=<value>  Stack API Key
  -y, --yes                    Force Remove

DESCRIPTION
  Remove branch config for CLI

EXAMPLES
  $ csdx config:remove:base-branch

  $ csdx config:remove:base-branch --stack-api-key <value>
```

_See code: [@contentstack/cli-config](https://github.com/contentstack/cli/blob/main/packages/contentstack-config/src/commands/config/remove/base-branch.ts)_

## `csdx config:remove:ea-header`

Remove Early Access header

```
USAGE
  $ csdx config:remove:ea-header [--header-alias <value>] [-y]

FLAGS
  -y, --yes                   Force Remove
      --header-alias=<value>  Early access header alias

DESCRIPTION
  Remove Early Access header

ALIASES
  $ csdx config:remove:ea-header

EXAMPLES
  $ csdx config:remove:ea-header

  $ csdx config:remove:ea-header --header-alias <value>
```

## `csdx config:remove:early-access-header`

Remove Early Access header

```
USAGE
  $ csdx config:remove:early-access-header [--header-alias <value>] [-y]

FLAGS
  -y, --yes                   Force Remove
      --header-alias=<value>  Early access header alias

DESCRIPTION
  Remove Early Access header

ALIASES
  $ csdx config:remove:ea-header

EXAMPLES
  $ csdx config:remove:early-access-header

  $ csdx config:remove:early-access-header --header-alias <value>
```

_See code: [@contentstack/cli-config](https://github.com/contentstack/cli/blob/main/packages/contentstack-config/src/commands/config/remove/early-access-header.ts)_

## `csdx config:set:base-branch`

Set branch for CLI

```
USAGE
  $ csdx config:set:base-branch [-k <value>] [--base-branch <value>]

FLAGS
  -k, --stack-api-key=<value>  Stack API Key
      --base-branch=<value>    Base Branch

DESCRIPTION
  Set branch for CLI

EXAMPLES
  $ csdx config:set:base-branch

  $ csdx config:set:base-branch --stack-api-key <value> --base-branch <value>
```

_See code: [@contentstack/cli-config](https://github.com/contentstack/cli/blob/main/packages/contentstack-config/src/commands/config/set/base-branch.ts)_

## `csdx config:set:ea-header`

Set Early Access header

```
USAGE
  $ csdx config:set:ea-header [--header-alias <value>] [--header <value>]

FLAGS
  --header=<value>        Early access header value
  --header-alias=<value>  Early access header alias

DESCRIPTION
  Set Early Access header

ALIASES
  $ csdx config:set:ea-header

EXAMPLES
  $ csdx config:set:ea-header

  $ csdx config:set:ea-header --header <value> --header-alias <value>
```

## `csdx config:set:early-access-header`

Set Early Access header

```
USAGE
  $ csdx config:set:early-access-header [--header-alias <value>] [--header <value>]

FLAGS
  --header=<value>        Early access header value
  --header-alias=<value>  Early access header alias

DESCRIPTION
  Set Early Access header

ALIASES
  $ csdx config:set:ea-header

EXAMPLES
  $ csdx config:set:early-access-header

  $ csdx config:set:early-access-header --header <value> --header-alias <value>
```

_See code: [@contentstack/cli-config](https://github.com/contentstack/cli/blob/main/packages/contentstack-config/src/commands/config/set/early-access-header.ts)_

## `csdx config:set:region [REGION]`

Set region for CLI

```
USAGE
  $ csdx config:set:region [REGION] [-d <value> -m <value> --ui-host <value> -n <value>]

ARGUMENTS
  REGION  Name for the region

FLAGS
  -d, --cda=<value>      Custom host to set for content delivery API, if this flag is added then cma, ui-host and name
                         flags are required
  -m, --cma=<value>      Custom host to set for content management API, , if this flag is added then cda, ui-host and
                         name flags are required
  -n, --name=<value>     Name for the region, if this flag is added then cda, cma and ui-host flags are required
      --ui-host=<value>  Custom UI host to set for CLI, if this flag is added then cda, cma and name flags are required

DESCRIPTION
  Set region for CLI

EXAMPLES
  $ csdx config:set:region

  $ csdx config:set:region NA

  $ csdx config:set:region EU

  $ csdx config:set:region AZURE-NA

  $ csdx config:set:region AZURE-EU

  $ csdx config:set:region GCP-NA

  $ csdx config:set:region --cma <contentstack_cma_endpoint> --cda <contentstack_cda_endpoint> --ui-host <contentstack_ui_host_endpoint> --name "India"
```

_See code: [@contentstack/cli-config](https://github.com/contentstack/cli/blob/main/packages/contentstack-config/src/commands/config/set/region.ts)_

## `csdx help [COMMANDS]`

Display help for csdx.

```
USAGE
  $ csdx help [COMMANDS...] [-n]

ARGUMENTS
  COMMANDS...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for csdx.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.20/src/commands/help.ts)_

## `csdx login`

User sessions login

```
USAGE
  $ csdx login [-u <value> | --oauth] [-p <value> | ]

FLAGS
  -p, --password=<value>  Password
  -u, --username=<value>  User name
      --oauth             Enables single sign-on (SSO) in Contentstack CLI

DESCRIPTION
  User sessions login

ALIASES
  $ csdx login

EXAMPLES
  $ csdx auth:login

  $ csdx auth:login -u <username>

  $ csdx auth:login -u <username> -p <password>

  $ csdx auth:login --username <username>

  $ csdx auth:login --username <username> --password <password>
```

## `csdx logout`

User session logout

```
USAGE
  $ csdx logout [-y]

FLAGS
  -y, --yes  Force log out by skipping the confirmation

DESCRIPTION
  User session logout

ALIASES
  $ csdx logout

EXAMPLES
  $ csdx auth:logout

  $ csdx auth:logout -y

  $ csdx auth:logout --yes
```

## `csdx plugins`

List installed plugins.

```
USAGE
  $ csdx plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ csdx plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.6/src/commands/plugins/index.ts)_

## `csdx plugins:add PLUGIN`

Installs a plugin into csdx.

```
USAGE
  $ csdx plugins:add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into csdx.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CSDX_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CSDX_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ csdx plugins:add

EXAMPLES
  Install a plugin from npm registry.

    $ csdx plugins:add myplugin

  Install a plugin from a github url.

    $ csdx plugins:add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ csdx plugins:add someuser/someplugin
```

## `csdx plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ csdx plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ csdx plugins:inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.6/src/commands/plugins/inspect.ts)_

## `csdx plugins:install PLUGIN`

Installs a plugin into csdx.

```
USAGE
  $ csdx plugins:install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into csdx.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CSDX_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CSDX_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ csdx plugins:add

EXAMPLES
  Install a plugin from npm registry.

    $ csdx plugins:install myplugin

  Install a plugin from a github url.

    $ csdx plugins:install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ csdx plugins:install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.6/src/commands/plugins/install.ts)_

## `csdx plugins:link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ csdx plugins:link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ csdx plugins:link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.6/src/commands/plugins/link.ts)_

## `csdx plugins:remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ csdx plugins:remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ csdx plugins:unlink
  $ csdx plugins:remove

EXAMPLES
  $ csdx plugins:remove myplugin
```

## `csdx plugins:reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ csdx plugins:reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.6/src/commands/plugins/reset.ts)_

## `csdx plugins:uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ csdx plugins:uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ csdx plugins:unlink
  $ csdx plugins:remove

EXAMPLES
  $ csdx plugins:uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.6/src/commands/plugins/uninstall.ts)_

## `csdx plugins:unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ csdx plugins:unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ csdx plugins:unlink
  $ csdx plugins:remove

EXAMPLES
  $ csdx plugins:unlink myplugin
```

## `csdx plugins:update`

Update installed plugins.

```
USAGE
  $ csdx plugins:update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.6/src/commands/plugins/update.ts)_

## `csdx tokens`

Lists all existing tokens added to the session

```
USAGE
  $ csdx tokens [--columns <value> | -x] [--filter <value>] [--no-header | [--csv | --no-truncate]]
    [--output csv|json|yaml |  | ] [--sort <value>]

FLAGS
  -x, --extended         show extra columns
      --columns=<value>  only show provided columns (comma-separated)
      --csv              output is csv format [alias: --output=csv]
      --filter=<value>   filter property by partial string matching, ex: name=foo
      --no-header        hide table header from output
      --no-truncate      do not truncate output to fit screen
      --output=<option>  output in a more machine friendly format
                         <options: csv|json|yaml>
      --sort=<value>     property to sort by (prepend '-' for descending)

DESCRIPTION
  Lists all existing tokens added to the session

ALIASES
  $ csdx tokens

EXAMPLES
  $ csdx auth:tokens
```

## `csdx whoami`

Display current users email address

```
USAGE
  $ csdx whoami

DESCRIPTION
  Display current users email address

ALIASES
  $ csdx whoami

EXAMPLES
  $ csdx auth:whoami
```
<!-- commandsstop -->

```

```
