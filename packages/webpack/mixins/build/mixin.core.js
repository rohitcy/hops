const debug = require('debug')('hops:webpack:stats');
const { sync, async } = require('mixinable');
const { Mixin, internal: bootstrap } = require('hops-bootstrap');
const { createChildCompiler } = require('./compiler');

const { sequence } = sync;
const { callable } = async;
const {
  validate, invariant
} = bootstrap;

class WebpackBuildMixin extends Mixin {
  clean() {
    const rimraf = require('rimraf');
    const { buildDir, serverDir } = this.config;

    return Promise.all([
      new Promise((resolve, reject) =>
        rimraf(buildDir, (error) => (error ? reject(error) : resolve()))
      ),
      new Promise((resolve, reject) =>
        rimraf(serverDir, (error) => (error ? reject(error) : resolve()))
      ),
    ]);
  }

  build() {
    const { options, config } = this;
    const { _overrides: overrides } = config;

    return Promise.all([
      createChildCompiler(['build'], options, overrides).then(this.inspectBuild),
      createChildCompiler(['node'], options, overrides).then(this.inspectBuild),
    ]);
  }

  inspectBuild(stats) {
    debug(stats);
  }

  registerCommands(yargs) {
    const { name } = this.config;
    yargs.command(
      this.configureCommand({
        command: 'build',
        describe: `Build ${name}`,
        builder: {
          production: {
            alias: 'p',
            default: false,
            describe: 'Enable production mode',
            type: 'boolean',
          },
          clean: {
            alias: 'c',
            default: true,
            describe: 'Clean up before building',
            type: 'boolean',
          },
          profile: {
            default: false,
            describe: 'Print performance profiling stats after each build',
            type: 'boolean',
          },
        },
        handler: (argv) =>
          Promise.resolve(argv.clean && this.clean())
            .then(() => this.build())
            .catch(this.handleError),
      })
    );
  }

  diagnose({ detectDuplicatePackages }) {
    detectDuplicatePackages('webpack');
  }
}

WebpackBuildMixin.strategies = {
  clean: validate(
    callable,
    ({ length }) => {
      invariant(length === 0, 'clean(): Received unexpected argument(s)');
    },
    (result, isAsync) => {
      invariant(isAsync, 'clean(): Did not return a Promise');
    }
  ),
  build: validate(
    callable,
    ({ length }) => {
      invariant(length === 0, 'build(): Received unexpected argument(s)');
    },
    (result, isAsync) => {
      invariant(isAsync, 'build(): Did not return a Promise');
    }
  ),
  inspectBuild: validate(sequence, ([stats]) => {
    invariant(
      stats && typeof stats.toString === 'function',
      'inspectBuild(): Received invalid Webpack Stats object'
    );
  }),
};

module.exports = WebpackBuildMixin;
