#!/usr/bin/env node

/**
 * T-Hub CLI - Updated with API Integration
 *
 * Интерфейс командной строки для работы с T-Hub
 */

const { Command } = require('commander');
const chalk = require('chalk');
const commands = require('./commands');

const program = new Command();

program
  .name('thub')
  .description('T-Hub - Thesaurus Hub for Software Components')
  .version('0.2.0');

// ============================================================================
// Authentication Commands
// ============================================================================

program
  .command('login')
  .description('Login to T-Hub')
  .action(commands.login);

program
  .command('register')
  .description('Create a new T-Hub account')
  .action(commands.register);

program
  .command('whoami')
  .description('Show current user')
  .action(commands.whoami);

program
  .command('logout')
  .description('Logout from T-Hub')
  .action(commands.logout);

// ============================================================================
// Component Commands
// ============================================================================

program
  .command('publish <file>')
  .description('Publish a component to T-Hub')
  .option('-n, --name <name>', 'Component name')
  .option('-v, --version <version>', 'Component version')
  .option('-d, --description <description>', 'Component description')
  .option('-c, --category <category>', 'Component category')
  .option('-l, --language <language>', 'Programming language')
  .option('--license <license>', 'License type', 'MIT')
  .action(commands.publish);

program
  .command('search <query>')
  .description('Search for components')
  .option('-c, --category <category>', 'Filter by category')
  .option('-l, --language <language>', 'Filter by language')
  .option('-n, --limit <number>', 'Number of results', '10')
  .action(commands.search);

program
  .command('install <component>')
  .description('Install a component from T-Hub')
  .option('-v, --version <version>', 'Component version', 'latest')
  .action(commands.install);

program
  .command('info <component>')
  .description('Show detailed information about a component')
  .action(commands.info);

// ============================================================================
// Statistics Commands
// ============================================================================

program
  .command('stats')
  .description('Show T-Hub statistics')
  .action(commands.stats);

program
  .command('trending')
  .description('Show trending components')
  .option('-p, --period <period>', 'Time period (day|week|month)', 'week')
  .option('-n, --limit <number>', 'Number of results', '10')
  .action(commands.trending);

// ============================================================================
// Utility Commands
// ============================================================================

program
  .command('init')
  .description('Initialize a new T-Hub project')
  .action(async () => {
    console.log(chalk.cyan('\n🚀 Initializing T-Hub project...\n'));

    const fs = require('fs').promises;
    const path = require('path');
    const inquirer = require('inquirer');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: path.basename(process.cwd())
      },
      {
        type: 'input',
        name: 'version',
        message: 'Version:',
        default: '1.0.0'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:'
      },
      {
        type: 'list',
        name: 'language',
        message: 'Primary language:',
        choices: ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java']
      }
    ]);

    const manifest = {
      name: answers.name,
      version: answers.version,
      description: answers.description,
      language: answers.language,
      components: [],
      dependencies: {},
      created: new Date().toISOString()
    };

    await fs.writeFile('thub.json', JSON.stringify(manifest, null, 2));

    console.log(chalk.green('\n✓ Project initialized successfully!'));
    console.log(chalk.gray('  Created: thub.json'));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  1. Run "thub login" to authenticate'));
    console.log(chalk.gray('  2. Run "thub search <query>" to find components'));
    console.log(chalk.gray('  3. Run "thub install <component>" to install components\n'));
  });

program
  .command('config')
  .description('Show configuration')
  .action(async () => {
    const os = require('os');
    const path = require('path');
    const fs = require('fs').promises;

    const configPath = path.join(os.homedir(), '.thub', 'config.json');

    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

      console.log(chalk.cyan('\n⚙️  T-Hub Configuration\n'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`${chalk.bold('API URL:')} ${config.apiUrl || 'http://localhost:3000'}`);
      console.log(`${chalk.bold('User:')} ${config.user?.username || 'Not logged in'}`);
      console.log(`${chalk.bold('Email:')} ${config.user?.email || 'N/A'}`);
      console.log(`${chalk.bold('Config file:')} ${configPath}`);
      console.log();
    } catch (error) {
      console.log(chalk.yellow('\nNo configuration found.'));
      console.log(chalk.gray('Run "thub login" to create configuration.\n'));
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log(chalk.cyan('\n🌟 Welcome to T-Hub CLI\n'));
  program.outputHelp();

  console.log(chalk.gray('\nQuick start:'));
  console.log(chalk.gray('  $ thub register       # Create an account'));
  console.log(chalk.gray('  $ thub search jwt     # Search for components'));
  console.log(chalk.gray('  $ thub install jwt    # Install a component'));
  console.log(chalk.gray('  $ thub publish app.js # Publish your own component\n'));
}
