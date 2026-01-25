/**
 * T-Hub CLI Commands
 * Implementation of all CLI commands using API client
 */

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const THubAPIClient = require('./api-client');

const client = new THubAPIClient();

// ============================================================================
// Authentication Commands
// ============================================================================

async function login() {
  console.log(chalk.cyan('\n🔐 Login to T-Hub\n'));

  await client.loadConfig();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      validate: (input) => input.includes('@') || 'Please enter a valid email'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '*'
    }
  ]);

  const spinner = ora('Logging in...').start();

  try {
    const result = await client.login(answers.email, answers.password);

    spinner.succeed(chalk.green('Successfully logged in!'));
    console.log(chalk.gray(`\n  Welcome, ${result.user.username}!`));
    console.log(chalk.gray(`  Email: ${result.user.email}`));
  } catch (error) {
    spinner.fail(chalk.red('Login failed'));
    console.error(chalk.red(`  ${error.message}`));
    process.exit(1);
  }
}

async function register() {
  console.log(chalk.cyan('\n📝 Register for T-Hub\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'Username:',
      validate: (input) => input.length >= 3 || 'Username must be at least 3 characters'
    },
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      validate: (input) => input.includes('@') || 'Please enter a valid email'
    },
    {
      type: 'input',
      name: 'full_name',
      message: 'Full name:'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '*',
      validate: (input) => input.length >= 8 || 'Password must be at least 8 characters'
    },
    {
      type: 'password',
      name: 'confirmPassword',
      message: 'Confirm password:',
      mask: '*',
      validate: (input, answers) => input === answers.password || 'Passwords do not match'
    }
  ]);

  const spinner = ora('Creating account...').start();

  try {
    const result = await client.register({
      username: answers.username,
      email: answers.email,
      full_name: answers.full_name,
      password: answers.password
    });

    spinner.succeed(chalk.green('Account created successfully!'));
    console.log(chalk.gray(`\n  Username: ${result.user.username}`));
    console.log(chalk.gray(`  Email: ${result.user.email}`));
    console.log(chalk.gray('\n  You are now logged in.'));
  } catch (error) {
    spinner.fail(chalk.red('Registration failed'));
    console.error(chalk.red(`  ${error.message}`));
    process.exit(1);
  }
}

async function whoami() {
  await client.loadConfig();

  if (!client.token) {
    console.log(chalk.yellow('\nNot logged in.'));
    console.log(chalk.gray('Run "thub login" to authenticate.\n'));
    return;
  }

  const spinner = ora('Fetching user info...').start();

  try {
    const result = await client.getMe();

    spinner.stop();

    console.log(chalk.cyan('\n👤 Current User\n'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.bold('Username:')} ${result.user.username}`);
    console.log(`${chalk.bold('Email:')} ${result.user.email}`);
    console.log(`${chalk.bold('Full Name:')} ${result.user.full_name || 'N/A'}`);
    console.log(`${chalk.bold('Role:')} ${result.user.role}`);
    console.log(`${chalk.bold('Verified:')} ${result.user.is_verified ? '✓' : '✗'}`);
    console.log();
  } catch (error) {
    spinner.fail(chalk.red('Failed to get user info'));
    console.error(chalk.red(`  ${error.message}`));

    if (error.status === 401) {
      console.log(chalk.yellow('\nYour session may have expired. Please login again.'));
    }
  }
}

async function logout() {
  await client.loadConfig();

  if (!client.token) {
    console.log(chalk.yellow('\nAlready logged out.\n'));
    return;
  }

  await client.logout();
  console.log(chalk.green('\n✓ Logged out successfully.\n'));
}

// ============================================================================
// Component Commands
// ============================================================================

async function publish(file, options) {
  await client.loadConfig();

  if (!client.token) {
    console.log(chalk.yellow('\nYou must be logged in to publish components.'));
    console.log(chalk.gray('Run "thub login" to authenticate.\n'));
    process.exit(1);
  }

  const spinner = ora('Publishing component...').start();

  try {
    // Read file
    const code = await fs.readFile(file, 'utf-8');
    const stats = await fs.stat(file);

    // Extract metadata from file if exists (JSDoc comments)
    const metadata = extractMetadata(code);

    // Prepare component data
    const componentData = {
      name: options.name || metadata.name || path.basename(file, path.extname(file)),
      version: options.version || metadata.version || '1.0.0',
      description: options.description || metadata.description || '',
      readme: metadata.readme || `# ${options.name || path.basename(file)}\n\n${options.description || ''}`,
      category: options.category || metadata.category || 'Utilities',
      language: options.language || detectLanguage(file) || 'JavaScript',
      license: options.license || metadata.license || 'MIT',
      code: code
    };

    const result = await client.createComponent(componentData);

    spinner.succeed(chalk.green('Component published successfully!'));

    console.log(chalk.gray('\n  Component Details:'));
    console.log(chalk.gray(`  ├─ ID: ${result.component.id}`));
    console.log(chalk.gray(`  ├─ Name: ${result.component.name}`));
    console.log(chalk.gray(`  ├─ Version: ${result.component.version}`));
    console.log(chalk.gray(`  ├─ Category: ${result.component.category}`));
    console.log(chalk.gray(`  ├─ Language: ${result.component.language}`));
    console.log(chalk.gray(`  ├─ Size: ${stats.size} bytes`));
    console.log(chalk.gray(`  └─ Hash: ${result.component.content_hash.substring(0, 16)}...`));
    console.log();
  } catch (error) {
    spinner.fail(chalk.red('Publication failed'));
    console.error(chalk.red(`  ${error.message}`));

    if (error.data?.existing) {
      console.log(chalk.yellow('\n  This code already exists as:'));
      console.log(chalk.gray(`  ${error.data.existing.name}@${error.data.existing.version}`));
    }

    process.exit(1);
  }
}

async function search(query, options) {
  const spinner = ora('Searching components...').start();

  try {
    const result = await client.search(query, {
      category: options.category,
      language: options.language,
      limit: parseInt(options.limit) || 10
    });

    spinner.succeed(chalk.green(`Found ${result.total} component(s)\n`));

    if (result.results.length === 0) {
      console.log(chalk.yellow('No components found. Try a different query.'));
      return;
    }

    result.results.forEach((comp, index) => {
      console.log(chalk.cyan(`${index + 1}. ${comp.name}@${comp.version}`));
      console.log(chalk.gray(`   ${comp.description || 'No description'}`));
      console.log(chalk.gray(`   Category: ${comp.category} | Language: ${comp.language}`));
      console.log(chalk.gray(`   ⬇ ${(comp.downloads || 0).toLocaleString()} | ⭐ ${(comp.stars || 0).toLocaleString()}`));
      console.log();
    });
  } catch (error) {
    spinner.fail(chalk.red('Search failed'));
    console.error(chalk.red(`  ${error.message}`));
  }
}

async function install(componentName, options) {
  await client.loadConfig();

  const spinner = ora(`Installing ${componentName}...`).start();

  try {
    // Search for component
    spinner.text = 'Finding component...';
    const searchResult = await client.search(componentName, { limit: 1 });

    if (searchResult.results.length === 0) {
      spinner.fail(chalk.red(`Component "${componentName}" not found`));
      return;
    }

    const component = searchResult.results[0];

    // Get full component details
    spinner.text = 'Fetching component details...';
    const details = await client.getComponent(component.id);

    // Download component code
    spinner.text = 'Downloading component...';
    const code = await client.downloadComponent(component.id);

    // Create components directory
    const componentsDir = path.join(process.cwd(), 'thub_components');
    await fs.mkdir(componentsDir, { recursive: true });

    // Write component file
    const filename = `${details.name}-${details.version}.js`;
    const filepath = path.join(componentsDir, filename);
    await fs.writeFile(filepath, code);

    // Update thub.json manifest
    await updateManifest(details);

    spinner.succeed(chalk.green(`${componentName} installed successfully!`));

    console.log(chalk.gray('\n  Installed:'));
    console.log(chalk.gray(`  ├─ Name: ${details.name}@${details.version}`));
    console.log(chalk.gray(`  ├─ Category: ${details.category}`));
    console.log(chalk.gray(`  ├─ License: ${details.license}`));
    console.log(chalk.gray(`  ├─ Size: ${details.size_bytes} bytes`));
    console.log(chalk.gray(`  └─ Location: ${filepath}`));
    console.log();
  } catch (error) {
    spinner.fail(chalk.red('Installation failed'));
    console.error(chalk.red(`  ${error.message}`));
    process.exit(1);
  }
}

async function info(componentName) {
  const spinner = ora('Fetching component info...').start();

  try {
    // Search for component
    const searchResult = await client.search(componentName, { limit: 1 });

    if (searchResult.results.length === 0) {
      spinner.fail(chalk.red(`Component "${componentName}" not found`));
      return;
    }

    // Get full details
    const details = await client.getComponent(searchResult.results[0].id);

    spinner.stop();

    console.log(chalk.cyan(`\n${details.name}@${details.version}`));
    console.log(chalk.gray('─'.repeat(60)));

    console.log(`${chalk.bold('Description:')} ${details.description || 'N/A'}`);
    console.log(`${chalk.bold('Author:')} ${details.author_username || 'Unknown'}`);
    console.log(`${chalk.bold('License:')} ${details.license}`);
    console.log(`${chalk.bold('Category:')} ${details.category}`);
    console.log(`${chalk.bold('Language:')} ${details.language}`);
    console.log(`${chalk.bold('Downloads:')} ${(details.downloads || 0).toLocaleString()}`);
    console.log(`${chalk.bold('Stars:')} ${(details.stars || 0).toLocaleString()}`);
    console.log(`${chalk.bold('Size:')} ${((details.size_bytes || 0) / 1024).toFixed(2)} KB`);
    console.log(`${chalk.bold('Created:')} ${new Date(details.created_at).toLocaleDateString()}`);

    if (details.tags && details.tags.length > 0) {
      console.log(`\n${chalk.bold('Tags:')}`);
      console.log(chalk.gray(`  ${details.tags.join(', ')}`));
    }

    if (details.exports && details.exports.length > 0) {
      console.log(`\n${chalk.bold('Exports:')}`);
      details.exports.forEach(exp => {
        console.log(chalk.gray(`  • ${exp.name} (${exp.type})`));
      });
    }

    if (details.dependencies && details.dependencies.length > 0) {
      console.log(`\n${chalk.bold('Dependencies:')}`);
      details.dependencies.forEach(dep => {
        console.log(chalk.gray(`  • ${dep.name}@${dep.version}`));
      });
    }

    console.log();
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch info'));
    console.error(chalk.red(`  ${error.message}`));
  }
}

async function stats() {
  const spinner = ora('Fetching statistics...').start();

  try {
    const result = await client.getStats();

    spinner.stop();

    console.log(chalk.cyan('\n📊 T-Hub Statistics\n'));
    console.log(chalk.gray('─'.repeat(50)));

    console.log(`${chalk.bold('Total Components:')} ${result.totalComponents.toLocaleString()}`);
    console.log(`${chalk.bold('Total Downloads:')} ${result.totalDownloads.toLocaleString()}`);
    console.log(`${chalk.bold('Total Stars:')} ${result.totalStars.toLocaleString()}`);

    if (result.categories && Object.keys(result.categories).length > 0) {
      console.log(chalk.cyan('\n📂 By Category:\n'));
      Object.entries(result.categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([category, count]) => {
          console.log(chalk.gray(`  ${category.padEnd(20)} ${count.toString().padStart(5)} components`));
        });
    }

    if (result.languages && Object.keys(result.languages).length > 0) {
      console.log(chalk.cyan('\n💻 By Language:\n'));
      Object.entries(result.languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([language, count]) => {
          console.log(chalk.gray(`  ${language.padEnd(20)} ${count.toString().padStart(5)} components`));
        });
    }

    console.log();
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch statistics'));
    console.error(chalk.red(`  ${error.message}`));
  }
}

async function trending(options) {
  const spinner = ora('Fetching trending components...').start();

  try {
    const result = await client.getTrending(options.period, parseInt(options.limit));

    spinner.succeed(chalk.green(`🔥 Top ${result.trending.length} trending components (${options.period})\n`));

    result.trending.forEach((comp, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;

      console.log(chalk.cyan(`${medal} ${comp.name}@${comp.version}`));
      console.log(chalk.gray(`   ${comp.description || 'No description'}`));
      console.log(chalk.gray(`   ⬇ ${(comp.downloads || 0).toLocaleString()} | ⭐ ${(comp.stars || 0).toLocaleString()} | 🔥 Score: ${comp.trending_score || 0}`));
      console.log();
    });
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch trending'));
    console.error(chalk.red(`  ${error.message}`));
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function extractMetadata(code) {
  const metadata = {};

  // Extract JSDoc @component metadata
  const componentMatch = code.match(/@component\s+(\S+)/);
  if (componentMatch) metadata.name = componentMatch[1];

  const versionMatch = code.match(/@version\s+(\S+)/);
  if (versionMatch) metadata.version = versionMatch[1];

  const categoryMatch = code.match(/@category\s+(\S+)/);
  if (categoryMatch) metadata.category = categoryMatch[1];

  const licenseMatch = code.match(/@license\s+(\S+)/);
  if (licenseMatch) metadata.license = licenseMatch[1];

  const descMatch = code.match(/@description\s+([^\n]+)/);
  if (descMatch) metadata.description = descMatch[1].trim();

  return metadata;
}

function detectLanguage(filename) {
  const ext = path.extname(filename).toLowerCase();
  const langMap = {
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.cpp': 'C++',
    '.c': 'C'
  };
  return langMap[ext] || 'Unknown';
}

async function updateManifest(component) {
  const manifestPath = path.join(process.cwd(), 'thub.json');

  let manifest = {
    name: path.basename(process.cwd()),
    version: '1.0.0',
    components: [],
    dependencies: {}
  };

  try {
    const existing = await fs.readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(existing);
  } catch (error) {
    // Manifest doesn't exist, use default
  }

  // Add component if not already present
  const existingIndex = manifest.components.findIndex(c => c.name === component.name);

  const componentEntry = {
    name: component.name,
    version: component.version,
    id: component.id
  };

  if (existingIndex >= 0) {
    manifest.components[existingIndex] = componentEntry;
  } else {
    manifest.components.push(componentEntry);
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

module.exports = {
  login,
  register,
  whoami,
  logout,
  publish,
  search,
  install,
  info,
  stats,
  trending
};
